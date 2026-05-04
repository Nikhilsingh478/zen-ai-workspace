import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export const IMAGE_BUCKET = "image-board";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type ImageItem = {
  id: string;
  name: string;
  storagePath: string;
  publicUrl: string;
  createdAt: string;
};

type Row = {
  id: string;
  name: string;
  storage_path: string;
  public_url: string;
  created_at: string;
};

type State = {
  images: ImageItem[];
  loaded: boolean;
};

const listeners = new Set<() => void>();
let state: State = { images: [], loaded: false };
let booted = false;

function emit() {
  listeners.forEach((fn) => fn());
}
function setState(next: Partial<State>) {
  state = { ...state, ...next };
  emit();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function getSnapshot(): State {
  return state;
}

function rowToImage(row: Row): ImageItem {
  return {
    id: row.id,
    name: row.name,
    storagePath: row.storage_path,
    publicUrl: row.public_url,
    createdAt: row.created_at,
  };
}

function extOf(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  const fromMime = file.type.split("/").pop();
  return (fromMime ?? "bin").toLowerCase();
}

async function refetch() {
  const { data, error } = await supabase
    .from("image_board")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  setState({ images: (data as Row[]).map(rowToImage), loaded: true });
}

async function ensureBooted() {
  if (booted) return;
  booted = true;
  try {
    await refetch();
  } catch (err) {
    console.error("[image-board] load error", err);
    toast.error("Failed to load images");
    setState({ loaded: true });
  }
}

export function useImageBoard() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    ensureBooted();
  }, []);

  const upload = async (name: string, file: File): Promise<boolean> => {
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image is over 5MB");
      return false;
    }
    const id = crypto.randomUUID();
    const path = `local/${id}.${extOf(file)}`;
    try {
      const { error: upErr } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined,
        });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);

      const { data, error } = await supabase
        .from("image_board")
        .insert({
          name: name.trim(),
          storage_path: path,
          public_url: pub.publicUrl,
        })
        .select("*")
        .single();
      if (error) {
        await supabase.storage.from(IMAGE_BUCKET).remove([path]);
        throw error;
      }
      setState({ images: [rowToImage(data as Row), ...state.images] });
      toast.success("Image uploaded", { duration: 1500 });
      return true;
    } catch (err) {
      console.error("[image-board] upload error", err);
      toast.error("Failed to upload image");
      return false;
    }
  };

  const rename = async (id: string, name: string) => {
    try {
      const { data, error } = await supabase
        .from("image_board")
        .update({ name: name.trim() })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      const updated = rowToImage(data as Row);
      setState({
        images: state.images.map((i) => (i.id === id ? updated : i)),
      });
      toast.success("Renamed", { duration: 1500 });
    } catch (err) {
      console.error("[image-board] rename error", err);
      toast.error("Failed to rename image");
    }
  };

  const remove = async (id: string) => {
    const target = state.images.find((i) => i.id === id);
    if (!target) return;
    try {
      const { error: storageErr } = await supabase.storage
        .from(IMAGE_BUCKET)
        .remove([target.storagePath]);
      if (storageErr) throw storageErr;
      const { error: dbErr } = await supabase
        .from("image_board")
        .delete()
        .eq("id", id);
      if (dbErr) throw dbErr;
      setState({ images: state.images.filter((i) => i.id !== id) });
      toast.success("Image deleted", { duration: 1500 });
    } catch (err) {
      console.error("[image-board] delete error", err);
      toast.error("Failed to delete image");
    }
  };

  return {
    images: snap.images,
    loaded: snap.loaded,
    upload,
    rename,
    remove,
  };
}