import { useEffect, useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  type AppStorage,
  type AppDataItem,
  type DesktopFolder,
  type DesktopLayoutEntry,
  type Prompt,
  type Website,
} from "@/lib/github-data";
import {
  fetchAllData,
  addWebsite as dbAddWebsite,
  addPrompt as dbAddPrompt,
  removeItem as dbRemoveItem,
  updateLayout as dbUpdateLayout,
  createFolder as dbCreateFolder,
  updateFolder as dbUpdateFolder,
  deleteFolder as dbDeleteFolder,
} from "@/lib/supabase-data";
import { supabase } from "@/lib/supabase";

export type { AppDataItem, AppStorage, DesktopFolder, DesktopLayoutEntry, Prompt, Website };
export type WebsiteInput = Omit<Website, "id" | "type" | "createdAt" | "updatedAt">;
export type PromptInput = Omit<Prompt, "id" | "type" | "tags" | "createdAt" | "updatedAt">;

// ─── Store state ────────────────────────────────────────────────────────────

type SyncStatus = "loading" | "synced" | "error";

type StoreState = {
  storage: AppStorage;
  loaded: boolean;
  status: SyncStatus;
};

const EMPTY_STORAGE: AppStorage = {
  items: [],
  desktop: { layout: [], folders: [] },
};

const listeners = new Set<() => void>();
let state: StoreState = { storage: EMPTY_STORAGE, loaded: false, status: "loading" };

function emit() {
  listeners.forEach((fn) => fn());
}

function setState(next: Partial<StoreState>) {
  state = { ...state, ...next };
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): StoreState {
  return state;
}

function getServerSnapshot(): StoreState {
  return state;
}

// ─── Initial load + realtime ─────────────────────────────────────────────────

let clientLoaded = false;
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

async function refetch() {
  try {
    const storage = await fetchAllData();
    setState({ storage, loaded: true, status: "synced" });
  } catch (err) {
    console.error("[store] refetch error:", err);
    setState({ status: "error" });
  }
}

async function ensureClientLoaded() {
  if (clientLoaded) return;
  clientLoaded = true;

  try {
    const storage = await fetchAllData();
    setState({ storage, loaded: true, status: "synced" });
  } catch (err) {
    console.error("[store] initial load error:", err);
    setState({ loaded: true, status: "error" });
  }

  realtimeChannel = supabase
    .channel("db-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "items" },
      () => refetch(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "desktop_layout" },
      () => refetch(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "desktop_folders" },
      () => refetch(),
    )
    .subscribe();
}

function now() {
  return new Date().toISOString();
}

// ─── Optimistic mutation helper ─────────────────────────────────────────────

function optimistic(
  updater: (s: AppStorage) => AppStorage,
  persist: (next: AppStorage) => Promise<void>,
  successMsg?: string,
) {
  const prev = state.storage;
  const next = updater(prev);
  setState({ storage: next });

  persist(next).then(() => {
    if (successMsg) toast.success(successMsg, { duration: 1500 });
  }).catch((err) => {
    console.error("[store] mutation error:", err);
    setState({ storage: prev });
    toast.error("Failed to save. Please try again.");
  });
}

// ─── Base hook ──────────────────────────────────────────────────────────────

function useDataStore(): StoreState {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    ensureClientLoaded();
    return () => {
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
        clientLoaded = false;
      }
    };
  }, []);
  return snap;
}

// ─── Public hooks ───────────────────────────────────────────────────────────

export function useSyncStatus() {
  const { status } = useDataStore();
  return { status, error: null };
}

export function useWebsites() {
  const { storage, loaded } = useDataStore();
  const websites = useMemo(
    () => storage.items.filter((item): item is Website => item.type === "website"),
    [storage.items],
  );

  const add = (input: WebsiteInput) => {
    const createdAt = now();
    const id = crypto.randomUUID();
    const website: Website = {
      ...input,
      id,
      type: "website",
      tags: input.tags ?? [],
      createdAt,
      updatedAt: createdAt,
    };

    optimistic(
      (prev) => ({
        ...prev,
        items: [website, ...prev.items],
        desktop: {
          ...prev.desktop,
          layout: [{ id, x: 0, y: 0 }, ...prev.desktop.layout],
        },
      }),
      () => dbAddWebsite(website),
      "Saved",
    );
  };

  const remove = (id: string) => {
    const folders = state.storage.desktop.folders;
    optimistic(
      (prev) => ({
        ...prev,
        items: prev.items.filter((item) => item.id !== id),
        desktop: {
          layout: prev.desktop.layout.filter((e) => e.id !== id),
          folders: prev.desktop.folders
            .map((f) => ({ ...f, children: f.children.filter((c) => c !== id) }))
            .filter((f) => f.children.length > 0),
        },
      }),
      () => dbRemoveItem(id, folders),
    );
  };

  return { websites, loaded, add, remove };
}

export function usePrompts() {
  const { storage, loaded } = useDataStore();
  const prompts = useMemo(
    () => storage.items.filter((item): item is Prompt => item.type === "prompt"),
    [storage.items],
  );

  const add = (input: PromptInput) => {
    const createdAt = now();
    const prompt: Prompt = {
      ...input,
      id: crypto.randomUUID(),
      type: "prompt",
      tags: [],
      createdAt,
      updatedAt: createdAt,
    };

    optimistic(
      (prev) => ({ ...prev, items: [prompt, ...prev.items] }),
      () => dbAddPrompt(prompt),
      "Saved",
    );
  };

  const remove = (id: string) => {
    optimistic(
      (prev) => ({ ...prev, items: prev.items.filter((item) => item.id !== id) }),
      () => dbRemoveItem(id, state.storage.desktop.folders),
    );
  };

  return { prompts, loaded, add, remove };
}

export function useDesktopStorage() {
  const { storage, loaded } = useDataStore();

  const updateLayout = (layout: DesktopLayoutEntry[]) => {
    optimistic(
      (prev) => ({ ...prev, desktop: { ...prev.desktop, layout } }),
      () => dbUpdateLayout(layout),
    );
  };

  const removeFromFolder = (folderId: string, childId: string) => {
    const folder = state.storage.desktop.folders.find((f) => f.id === folderId);
    if (!folder) return;
    const newChildren = folder.children.filter((c) => c !== childId);

    optimistic(
      (prev) => ({
        ...prev,
        desktop: {
          layout: [...prev.desktop.layout, { id: childId, x: 0, y: 0 }],
          folders: prev.desktop.folders
            .map((f) =>
              f.id === folderId ? { ...f, children: f.children.filter((c) => c !== childId) } : f,
            )
            .filter((f) => f.children.length > 0),
        },
      }),
      () => dbUpdateFolder(folderId, { children: newChildren }),
    );
  };

  const createEmptyFolder = (x: number, y: number) => {
    const folderId = crypto.randomUUID();

    optimistic(
      (prev) => {
        const occupied = new Set(prev.desktop.layout.map((e) => `${e.x}:${e.y}`));
        let fx = x;
        let fy = y;
        if (occupied.has(`${fx}:${fy}`)) {
          let idx = 0;
          while (occupied.has(`${idx % 8}:${Math.floor(idx / 8)}`)) idx++;
          fx = idx % 8;
          fy = Math.floor(idx / 8);
        }
        return {
          ...prev,
          desktop: {
            layout: [...prev.desktop.layout, { id: folderId, x: fx, y: fy }],
            folders: [
              ...prev.desktop.folders,
              { id: folderId, name: "New Folder", children: [] },
            ],
          },
        };
      },
      (next) => {
        const entry = next.desktop.layout.find((e) => e.id === folderId);
        return dbCreateFolder(folderId, entry?.x ?? x, entry?.y ?? y);
      },
    );

    return folderId;
  };

  const addToFolder = (folderId: string, itemId: string) => {
    const folder = state.storage.desktop.folders.find((f) => f.id === folderId);
    if (!folder || folder.children.includes(itemId)) return;
    const newChildren = [...folder.children, itemId];

    optimistic(
      (prev) => ({
        ...prev,
        desktop: {
          layout: prev.desktop.layout.filter((e) => e.id !== itemId),
          folders: prev.desktop.folders.map((f) =>
            f.id === folderId ? { ...f, children: newChildren } : f,
          ),
        },
      }),
      () => dbUpdateFolder(folderId, { children: newChildren }),
    );
  };

  const renameFolder = (folderId: string, name: string) => {
    optimistic(
      (prev) => ({
        ...prev,
        desktop: {
          ...prev.desktop,
          folders: prev.desktop.folders.map((f) => (f.id === folderId ? { ...f, name } : f)),
        },
      }),
      () => dbUpdateFolder(folderId, { name }),
    );
  };

  const deleteFolder = (folderId: string) => {
    const folder = state.storage.desktop.folders.find((f) => f.id === folderId);
    if (!folder) return;
    const folderEntry = state.storage.desktop.layout.find((e) => e.id === folderId);
    const baseX = folderEntry?.x ?? 0;
    const baseY = folderEntry?.y ?? 0;
    const occupied = new Set(
      state.storage.desktop.layout.filter((e) => e.id !== folderId).map((e) => `${e.x}:${e.y}`),
    );
    const childEntries: DesktopLayoutEntry[] = [];
    let slot = 0;
    for (const childId of folder.children) {
      while (
        occupied.has(`${(baseX + slot) % 8}:${baseY + Math.floor((baseX + slot) / 8)}`)
      ) {
        slot++;
      }
      const cx = (baseX + slot) % 8;
      const cy = baseY + Math.floor((baseX + slot) / 8);
      occupied.add(`${cx}:${cy}`);
      childEntries.push({ id: childId, x: cx, y: cy });
      slot++;
    }

    optimistic(
      (prev) => ({
        ...prev,
        desktop: {
          layout: [
            ...prev.desktop.layout.filter((e) => e.id !== folderId),
            ...childEntries,
          ],
          folders: prev.desktop.folders.filter((f) => f.id !== folderId),
        },
      }),
      () => dbDeleteFolder(folderId, childEntries),
    );
  };

  return {
    items: storage.items,
    desktop: storage.desktop,
    loaded,
    updateLayout,
    removeFromFolder,
    createEmptyFolder,
    addToFolder,
    renameFolder,
    deleteFolder,
  };
}

export function getDomain(url: string): string {
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

export function faviconFor(url: string, size = 128): string {
  const domain = getDomain(url);
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}
