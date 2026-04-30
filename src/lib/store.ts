import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  fetchData,
  saveData,
  SEED_DATA,
  type AppStorage,
  type AppDataItem,
  type DesktopFolder,
  type DesktopLayoutEntry,
  type Prompt,
  type Website,
} from "@/lib/github-data";

export type { AppDataItem, AppStorage, DesktopFolder, DesktopLayoutEntry, Prompt, Website };
export type WebsiteInput = Omit<Website, "id" | "type" | "createdAt" | "updatedAt">;
export type PromptInput = Omit<Prompt, "id" | "type" | "tags" | "createdAt" | "updatedAt">;

// ─── External store ────────────────────────────────────────────────────────────
// Server / initial client render always starts with SEED_DATA so SSR HTML
// and the first client render match (no hydration mismatch). After the
// component mounts its useEffect fires and replaces SEED_DATA with whatever
// is actually in localStorage.

type StoreState = {
  storage: AppStorage;
  loaded: boolean;
};

const listeners = new Set<() => void>();
let state: StoreState = { storage: SEED_DATA, loaded: false };

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

/** Called once on first client mount. Reads localStorage and replaces SEED_DATA. */
let clientLoaded = false;
function ensureClientLoaded() {
  if (clientLoaded) return;
  clientLoaded = true;
  const stored = fetchData();
  setState({ storage: stored, loaded: true });
}

/** Synchronously mutate storage + persist to localStorage. */
function updateStorage(updater: (s: AppStorage) => AppStorage) {
  const next = updater(state.storage);
  setState({ storage: next });
  saveData(next);
}

function now() {
  return new Date().toISOString();
}

// ─── Base hook ─────────────────────────────────────────────────────────────────

function useDataStore(): StoreState {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    ensureClientLoaded();
  }, []);
  return snap;
}

// ─── Public hooks ──────────────────────────────────────────────────────────────

export function useSyncStatus() {
  const { loaded } = useDataStore();
  return { status: loaded ? ("synced" as const) : ("loading" as const), error: null };
}

export function useWebsites() {
  const { storage } = useDataStore();
  const websites = useMemo(
    () => storage.items.filter((item): item is Website => item.type === "website"),
    [storage.items],
  );

  const add = (website: WebsiteInput) => {
    const createdAt = now();
    const id = crypto.randomUUID();
    updateStorage((prev) => ({
      ...prev,
      items: [
        {
          ...website,
          id,
          type: "website",
          tags: website.tags ?? [],
          createdAt,
          updatedAt: createdAt,
        },
        ...prev.items,
      ],
      desktop: {
        ...prev.desktop,
        layout: [{ id, x: 0, y: 0 }, ...prev.desktop.layout],
      },
    }));
  };

  const remove = (id: string) => {
    updateStorage((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
      desktop: {
        layout: prev.desktop.layout.filter((entry) => entry.id !== id),
        folders: prev.desktop.folders
          .map((folder) => ({
            ...folder,
            children: folder.children.filter((child) => child !== id),
          }))
          .filter((folder) => folder.children.length > 0),
      },
    }));
  };

  return { websites, add, remove };
}

export function usePrompts() {
  const { storage } = useDataStore();
  const prompts = useMemo(
    () => storage.items.filter((item): item is Prompt => item.type === "prompt"),
    [storage.items],
  );

  const add = (prompt: PromptInput) => {
    const createdAt = now();
    updateStorage((prev) => ({
      ...prev,
      items: [
        {
          ...prompt,
          id: crypto.randomUUID(),
          type: "prompt",
          tags: [],
          createdAt,
          updatedAt: createdAt,
        },
        ...prev.items,
      ],
    }));
  };

  const remove = (id: string) => {
    updateStorage((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
    }));
  };

  return { prompts, add, remove };
}

export function useDesktopStorage() {
  const { storage } = useDataStore();

  const updateLayout = (layout: DesktopLayoutEntry[]) => {
    updateStorage((prev) => ({ ...prev, desktop: { ...prev.desktop, layout } }));
  };

  const removeFromFolder = (folderId: string, childId: string) => {
    updateStorage((prev) => ({
      ...prev,
      desktop: {
        layout: [...prev.desktop.layout, { id: childId, x: 0, y: 0 }],
        folders: prev.desktop.folders
          .map((f) =>
            f.id === folderId ? { ...f, children: f.children.filter((c) => c !== childId) } : f,
          )
          .filter((f) => f.children.length > 0),
      },
    }));
  };

  const createEmptyFolder = (x: number, y: number) => {
    const folderId = crypto.randomUUID();
    updateStorage((prev) => {
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
          folders: [...prev.desktop.folders, { id: folderId, name: "New Folder", children: [] }],
        },
      };
    });
    return folderId;
  };

  const addToFolder = (folderId: string, itemId: string) => {
    updateStorage((prev) => {
      const folder = prev.desktop.folders.find((f) => f.id === folderId);
      if (!folder || folder.children.includes(itemId)) return prev;
      return {
        ...prev,
        desktop: {
          layout: prev.desktop.layout.filter((e) => e.id !== itemId),
          folders: prev.desktop.folders.map((f) =>
            f.id === folderId ? { ...f, children: [...f.children, itemId] } : f,
          ),
        },
      };
    });
  };

  const renameFolder = (folderId: string, name: string) => {
    updateStorage((prev) => ({
      ...prev,
      desktop: {
        ...prev.desktop,
        folders: prev.desktop.folders.map((f) => (f.id === folderId ? { ...f, name } : f)),
      },
    }));
  };

  const deleteFolder = (folderId: string) => {
    updateStorage((prev) => {
      const folder = prev.desktop.folders.find((f) => f.id === folderId);
      if (!folder) return prev;
      const folderEntry = prev.desktop.layout.find((e) => e.id === folderId);
      const baseX = folderEntry?.x ?? 0;
      const baseY = folderEntry?.y ?? 0;
      const occupied = new Set(
        prev.desktop.layout.filter((e) => e.id !== folderId).map((e) => `${e.x}:${e.y}`),
      );
      const childEntries: DesktopLayoutEntry[] = [];
      let slot = 0;
      for (const childId of folder.children) {
        while (occupied.has(`${(baseX + slot) % 8}:${baseY + Math.floor((baseX + slot) / 8)}`)) {
          slot++;
        }
        const cx = (baseX + slot) % 8;
        const cy = baseY + Math.floor((baseX + slot) / 8);
        occupied.add(`${cx}:${cy}`);
        childEntries.push({ id: childId, x: cx, y: cy });
        slot++;
      }
      return {
        ...prev,
        desktop: {
          layout: [...prev.desktop.layout.filter((e) => e.id !== folderId), ...childEntries],
          folders: prev.desktop.folders.filter((f) => f.id !== folderId),
        },
      };
    });
  };

  return {
    items: storage.items,
    desktop: storage.desktop,
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
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function faviconFor(url: string, size = 128): string {
  const domain = getDomain(url);
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}
