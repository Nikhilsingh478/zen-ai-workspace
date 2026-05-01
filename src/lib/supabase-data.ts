import { supabase } from "@/lib/supabase";
import type {
  AppStorage,
  AppDataItem,
  DesktopLayoutEntry,
  DesktopFolder,
  Website,
  Prompt,
} from "@/lib/github-data";

// ─── Row types matching the DB schema ──────────────────────────────────────

type ItemRow = {
  id: string;
  type: string;
  name: string | null;
  url: string | null;
  description: string | null;
  title: string | null;
  body: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};

type LayoutRow = {
  id: string;
  x: number;
  y: number;
};

type FolderRow = {
  id: string;
  name: string;
  children: string[];
  created_at: string;
};

// ─── Row → domain type mappers ──────────────────────────────────────────────

function rowToItem(row: ItemRow): AppDataItem | null {
  if (row.type === "website") {
    return {
      id: row.id,
      type: "website",
      name: row.name ?? "",
      url: row.url ?? "",
      description: row.description ?? "",
      tags: row.tags ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } as Website;
  }
  if (row.type === "prompt") {
    return {
      id: row.id,
      type: "prompt",
      title: row.title ?? "",
      body: row.body ?? "",
      tags: row.tags ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } as Prompt;
  }
  return null;
}

function rowToLayout(row: LayoutRow): DesktopLayoutEntry {
  return { id: row.id, x: row.x, y: row.y };
}

function rowToFolder(row: FolderRow): DesktopFolder {
  return {
    id: row.id,
    name: row.name,
    children: Array.isArray(row.children) ? row.children : [],
  };
}

// ─── Public data functions ─────────────────────────────────────────────────

export async function fetchAllData(): Promise<AppStorage> {
  const [itemsRes, layoutRes, foldersRes] = await Promise.all([
    supabase.from("items").select("*").order("created_at", { ascending: false }),
    supabase.from("desktop_layout").select("*"),
    supabase.from("desktop_folders").select("*").order("created_at", { ascending: true }),
  ]);

  if (itemsRes.error) throw itemsRes.error;
  if (layoutRes.error) throw layoutRes.error;
  if (foldersRes.error) throw foldersRes.error;

  const items = (itemsRes.data as ItemRow[])
    .map(rowToItem)
    .filter((x): x is AppDataItem => x !== null);

  const layout = (layoutRes.data as LayoutRow[]).map(rowToLayout);
  const folders = (foldersRes.data as FolderRow[]).map(rowToFolder);

  return { items, desktop: { layout, folders } };
}

export async function addWebsite(website: Website): Promise<void> {
  const { error: itemErr } = await supabase.from("items").insert({
    id: website.id,
    type: "website",
    name: website.name,
    url: website.url,
    description: website.description,
    tags: website.tags,
    created_at: website.createdAt,
    updated_at: website.updatedAt,
  });
  if (itemErr) throw itemErr;

  const { error: layoutErr } = await supabase.from("desktop_layout").insert({
    id: website.id,
    x: 0,
    y: 0,
  });
  if (layoutErr) throw layoutErr;
}

export async function addPrompt(prompt: Prompt): Promise<void> {
  const { error } = await supabase.from("items").insert({
    id: prompt.id,
    type: "prompt",
    title: prompt.title,
    body: prompt.body,
    tags: prompt.tags,
    created_at: prompt.createdAt,
    updated_at: prompt.updatedAt,
  });
  if (error) throw error;
}

export async function removeItem(
  id: string,
  folders: DesktopFolder[],
): Promise<void> {
  await supabase.from("items").delete().eq("id", id);
  await supabase.from("desktop_layout").delete().eq("id", id);

  for (const folder of folders) {
    if (folder.children.includes(id)) {
      const newChildren = folder.children.filter((c) => c !== id);
      if (newChildren.length === 0) {
        await supabase.from("desktop_folders").delete().eq("id", folder.id);
        await supabase.from("desktop_layout").delete().eq("id", folder.id);
      } else {
        await supabase
          .from("desktop_folders")
          .update({ children: newChildren })
          .eq("id", folder.id);
      }
    }
  }
}

export async function updateLayout(layout: DesktopLayoutEntry[]): Promise<void> {
  if (layout.length === 0) return;
  const { error } = await supabase.from("desktop_layout").upsert(
    layout.map((e) => ({ id: e.id, x: e.x, y: e.y })),
    { onConflict: "id" },
  );
  if (error) throw error;
}

export async function createFolder(id: string, x: number, y: number): Promise<void> {
  const { error: folderErr } = await supabase.from("desktop_folders").insert({
    id,
    name: "New Folder",
    children: [],
  });
  if (folderErr) throw folderErr;

  const { error: layoutErr } = await supabase.from("desktop_layout").insert({ id, x, y });
  if (layoutErr) throw layoutErr;
}

export async function updateFolder(
  id: string,
  updates: { name?: string; children?: string[] },
): Promise<void> {
  const { error } = await supabase.from("desktop_folders").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteFolder(
  id: string,
  childEntries: DesktopLayoutEntry[],
): Promise<void> {
  await supabase.from("desktop_folders").delete().eq("id", id);
  await supabase.from("desktop_layout").delete().eq("id", id);

  if (childEntries.length > 0) {
    const { error } = await supabase.from("desktop_layout").upsert(
      childEntries.map((e) => ({ id: e.id, x: e.x, y: e.y })),
      { onConflict: "id" },
    );
    if (error) throw error;
  }
}
