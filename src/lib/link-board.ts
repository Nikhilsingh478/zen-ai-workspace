import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export type LinkItem = {
  id: string;
  name: string;
  url: string;
  description: string | null;
  position: number;
  createdAt: string;
};

export type LinkInput = {
  name: string;
  url: string;
  description?: string | null;
};

type State = {
  links: LinkItem[];
  loaded: boolean;
};

const listeners = new Set<() => void>();
let state: State = { links: [], loaded: false };
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

type Row = {
  id: string;
  name: string;
  url: string;
  description: string | null;
  position: number;
  created_at: string;
};

function rowToLink(row: Row): LinkItem {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    description: row.description,
    position: row.position,
    createdAt: row.created_at,
  };
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

async function refetch() {
  const { data, error } = await supabase
    .from("links")
    .select("*")
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  setState({ links: (data as Row[]).map(rowToLink), loaded: true });
}

async function ensureBooted() {
  if (booted) return;
  booted = true;
  try {
    await refetch();
  } catch (err) {
    console.error("[link-board] load error", err);
    toast.error("Failed to load links");
    setState({ loaded: true });
  }
}

export function useLinkBoard() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    ensureBooted();
  }, []);

  const add = async (input: LinkInput) => {
    const url = normalizeUrl(input.url);
    const nextPosition =
      state.links.length === 0
        ? 0
        : Math.max(...state.links.map((l) => l.position)) + 1;
    try {
      const { data, error } = await supabase
        .from("links")
        .insert({
          name: input.name.trim(),
          url,
          description: input.description?.trim() || null,
          position: nextPosition,
        })
        .select("*")
        .single();
      if (error) throw error;
      setState({ links: [...state.links, rowToLink(data as Row)] });
      toast.success("Link saved", { duration: 1500 });
    } catch (err) {
      console.error("[link-board] add error", err);
      toast.error("Failed to add link");
    }
  };

  const update = async (id: string, input: LinkInput) => {
    const url = normalizeUrl(input.url);
    try {
      const { data, error } = await supabase
        .from("links")
        .update({
          name: input.name.trim(),
          url,
          description: input.description?.trim() || null,
        })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      const updated = rowToLink(data as Row);
      setState({ links: state.links.map((l) => (l.id === id ? updated : l)) });
      toast.success("Link updated", { duration: 1500 });
    } catch (err) {
      console.error("[link-board] update error", err);
      toast.error("Failed to update link");
    }
  };

  const remove = async (id: string) => {
    const prev = state.links;
    setState({ links: state.links.filter((l) => l.id !== id) });
    try {
      const { error } = await supabase.from("links").delete().eq("id", id);
      if (error) throw error;
    } catch (err) {
      console.error("[link-board] remove error", err);
      toast.error("Failed to delete link");
      setState({ links: prev });
    }
  };

  const reorder = async (orderedIds: string[]) => {
    const map = new Map(state.links.map((l) => [l.id, l]));
    const next: LinkItem[] = orderedIds
      .map((id, i) => {
        const item = map.get(id);
        return item ? { ...item, position: i } : null;
      })
      .filter((x): x is LinkItem => x !== null);
    const prev = state.links;
    setState({ links: next });
    try {
      const { error } = await supabase.from("links").upsert(
        next.map((l) => ({
          id: l.id,
          name: l.name,
          url: l.url,
          description: l.description,
          position: l.position,
        })),
        { onConflict: "id" },
      );
      if (error) throw error;
    } catch (err) {
      console.error("[link-board] reorder error", err);
      toast.error("Failed to save order");
      setState({ links: prev });
    }
  };

  return {
    links: snap.links,
    loaded: snap.loaded,
    add,
    update,
    remove,
    reorder,
  };
}