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

type SyncStatus = "loading" | "syncing" | "synced" | "offline";

type StoreState = {
  storage: AppStorage;
  status: SyncStatus;
  error: string | null;
};

const listeners = new Set<() => void>();
let state: StoreState = {
  storage: SEED_DATA,
  status: "loading",
  error: null,
};
let loadPromise: Promise<void> | null = null;
let savePromise = Promise.resolve();

function emit() {
  listeners.forEach((listener) => listener());
}

function setState(next: Partial<StoreState>) {
  state = { ...state, ...next };
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function ensureLoaded() {
  if (loadPromise) return loadPromise;

  loadPromise = fetchData()
    .then((storage) => {
      setState({ storage, status: "synced", error: null });
    })
    .catch(() => {
      setState({ status: "offline", error: "Using local fallback data." });
    });

  return loadPromise;
}

function updateStorage(updater: (storage: AppStorage) => AppStorage) {
  const nextStorage = updater(state.storage);
  setState({ storage: nextStorage, status: "syncing", error: null });

  savePromise = savePromise
    .catch(() => undefined)
    .then(() => saveData(nextStorage))
    .then(() => {
      if (state.storage === nextStorage) {
        setState({ status: "synced", error: null });
      }
    })
    .catch(() => {
      if (state.storage === nextStorage) {
        setState({
          status: "offline",
          error: "Saved locally. GitHub sync will retry on the next change.",
        });
      }
    });
}

function now() {
  return new Date().toISOString();
}

function useDataStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    void ensureLoaded();
  }, []);

  return snapshot;
}

export function useSyncStatus() {
  const { status, error } = useDataStore();
  return { status, error };
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
    updateStorage((prev) => ({
      ...prev,
      desktop: {
        ...prev.desktop,
        layout,
      },
    }));
  };

  const createFolder = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;

    updateStorage((prev) => {
      const targetItem = prev.items.find((item) => item.id === targetId);
      const name = targetItem && "name" in targetItem ? String(targetItem.name) : "Folder";
      const folderId = crypto.randomUUID();
      const targetEntry = prev.desktop.layout.find((entry) => entry.id === targetId);

      return {
        ...prev,
        desktop: {
          layout: [
            ...prev.desktop.layout.filter(
              (entry) => entry.id !== sourceId && entry.id !== targetId,
            ),
            {
              id: folderId,
              x: targetEntry?.x ?? 0,
              y: targetEntry?.y ?? 0,
            },
          ],
          folders: [
            ...prev.desktop.folders
              .map((folder) => ({
                ...folder,
                children: folder.children.filter(
                  (child) => child !== sourceId && child !== targetId,
                ),
              }))
              .filter((folder) => folder.children.length > 0),
            {
              id: folderId,
              name: `${name} Folder`,
              children: [targetId, sourceId],
            },
          ],
        },
      };
    });
  };

  const removeFromFolder = (folderId: string, childId: string) => {
    updateStorage((prev) => ({
      ...prev,
      desktop: {
        layout: [...prev.desktop.layout, { id: childId, x: 0, y: 0 }],
        folders: prev.desktop.folders
          .map((folder) =>
            folder.id === folderId
              ? { ...folder, children: folder.children.filter((child) => child !== childId) }
              : folder,
          )
          .filter((folder) => folder.children.length > 0),
      },
    }));
  };

  return {
    items: storage.items,
    desktop: storage.desktop,
    updateLayout,
    createFolder,
    removeFromFolder,
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
