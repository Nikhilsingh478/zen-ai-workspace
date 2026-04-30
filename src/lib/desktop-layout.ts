import type { DesktopFolder, DesktopLayoutEntry, Website } from "@/lib/store";

export type LauncherEntry =
  | {
      kind: "item";
      id: string;
      item: Website;
    }
  | {
      kind: "folder";
      id: string;
      folder: DesktopFolder;
      children: Website[];
    };

export type PositionedLauncherEntry = LauncherEntry & {
  x: number;
  y: number;
  index: number;
};

export const DESKTOP_COLUMNS = 8;
export const DESKTOP_COLUMNS_MOBILE = 4;
export const GRID_GAP = 16;

export function buildLauncherEntries(items: Website[], folders: DesktopFolder[]): LauncherEntry[] {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const folderChildIds = new Set(folders.flatMap((folder) => folder.children));

  const folderEntries = folders
    .map((folder): LauncherEntry => {
      const children = folder.children
        .map((childId) => itemById.get(childId))
        .filter((item): item is Website => Boolean(item));
      return { kind: "folder", id: folder.id, folder, children };
    });

  const itemEntries = items
    .filter((item) => !folderChildIds.has(item.id))
    .map((item): LauncherEntry => ({ kind: "item", id: item.id, item }));

  return [...folderEntries, ...itemEntries];
}

export function normalizeDesktopLayout(
  entries: LauncherEntry[],
  layout: DesktopLayoutEntry[],
  columns = DESKTOP_COLUMNS,
): PositionedLauncherEntry[] {
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const used = new Set<string>();
  const occupied = new Set<string>();
  const positioned: PositionedLauncherEntry[] = [];

  layout.forEach((layoutEntry) => {
    const entry = entryById.get(layoutEntry.id);
    if (!entry || used.has(layoutEntry.id)) return;

    const x = Math.max(0, Math.min(columns - 1, layoutEntry.x));
    const y = Math.max(0, layoutEntry.y);
    const key = `${x}:${y}`;
    if (occupied.has(key)) return;

    used.add(layoutEntry.id);
    occupied.add(key);
    positioned.push({ ...entry, x, y, index: y * columns + x });
  });

  entries.forEach((entry) => {
    if (used.has(entry.id)) return;

    let index = 0;
    while (occupied.has(`${index % columns}:${Math.floor(index / columns)}`)) {
      index += 1;
    }

    const x = index % columns;
    const y = Math.floor(index / columns);
    occupied.add(`${x}:${y}`);
    positioned.push({ ...entry, x, y, index });
  });

  return positioned.sort((a, b) => a.index - b.index);
}

export function toDesktopLayout(entries: PositionedLauncherEntry[]): DesktopLayoutEntry[] {
  return entries.map((entry) => ({
    id: entry.id,
    x: entry.x,
    y: entry.y,
  }));
}

export function moveEntryToIndex(
  entries: PositionedLauncherEntry[],
  activeId: string,
  targetIndex: number,
  columns = DESKTOP_COLUMNS,
) {
  const currentIndex = entries.findIndex((entry) => entry.id === activeId);
  if (currentIndex < 0) return toDesktopLayout(entries);

  const nextEntries = [...entries];
  const [active] = nextEntries.splice(currentIndex, 1);
  nextEntries.splice(Math.max(0, targetIndex), 0, active);

  return toDesktopLayout(
    nextEntries.map((entry, index) => ({
      ...entry,
      x: index % columns,
      y: Math.floor(index / columns),
      index,
    })),
  );
}
