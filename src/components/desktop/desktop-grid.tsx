import { useState, useRef, useCallback, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import { motion, AnimatePresence } from "framer-motion";
import { FolderPlus } from "lucide-react";
import { useDesktopStorage, type Website } from "@/lib/store";
import { useIsMobile } from "@/hooks/use-mobile";
import { buildLauncherEntries, normalizeDesktopLayout, GRID_GAP } from "@/lib/desktop-layout";
import { DesktopItem } from "@/components/desktop/desktop-item";
import { FolderIcon } from "@/components/desktop/folder-icon";
import { FolderOverlay } from "@/components/desktop/folder-overlay";
import { DragGhost } from "@/components/desktop/drag-ghost";

const DESKTOP_COLS = 8;
const MOBILE_COLS = 4;

interface DesktopGridProps {
  searchQuery?: string;
}

export function DesktopGrid({ searchQuery = "" }: DesktopGridProps) {
  const {
    items,
    desktop,
    updateLayout,
    addToFolder,
    removeFromFolder,
    createEmptyFolder,
    renameFolder,
    deleteFolder,
  } = useDesktopStorage();

  const isMobile = useIsMobile();
  const cols = isMobile ? MOBILE_COLS : DESKTOP_COLS;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const containerRef = useRef<HTMLDivElement>(null);
  const [cellPx, setCellPx] = useState(100);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    gridX: number;
    gridY: number;
  } | null>(null);

  useEffect(() => {
    if (!mounted || !containerRef.current) return;
    const update = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setCellPx((rect.width - (cols - 1) * GRID_GAP) / cols);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [mounted, cols]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const websites = items.filter((item): item is Website => item.type === "website");
  const entries = buildLauncherEntries(websites, desktop.folders);
  const positioned = normalizeDesktopLayout(entries, desktop.layout, cols);

  const maxRow = positioned.reduce((max, e) => Math.max(max, e.y), 0);
  const gridRows = Math.max(maxRow + 2, 4);

  const q = searchQuery.trim().toLowerCase();

  const matchesSearch = (entry: (typeof positioned)[number]): boolean => {
    if (!q) return true;
    if (entry.kind === "item") {
      const w = entry.item as Website;
      return (
        w.name.toLowerCase().includes(q) ||
        (w.url ?? "").toLowerCase().includes(q) ||
        (w.description ?? "").toLowerCase().includes(q) ||
        (w.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    }
    if (entry.kind === "folder") {
      return (
        entry.folder.name.toLowerCase().includes(q) ||
        entry.children.some(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.url.toLowerCase().includes(q) ||
            c.tags.some((t) => t.toLowerCase().includes(q)),
        )
      );
    }
    return false;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    setContextMenu(null);
    setOpenFolderId(null);
  };

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over, delta, activatorEvent } = event;
      setActiveId(null);

      const activeIdStr = String(active.id);
      const activeEntry = positioned.find((e) => e.id === activeIdStr);
      if (!activeEntry || !containerRef.current) return;

      // ── Check if dropped directly onto a folder ──────────────────────────
      if (over && String(over.id) !== activeIdStr) {
        const overIdStr = String(over.id);
        const overEntry = positioned.find((e) => e.id === overIdStr);
        if (overEntry?.kind === "folder" && activeEntry.kind === "item") {
          addToFolder(overIdStr, activeIdStr);
          return;
        }
      }

      // ── Cursor-based grid snapping ────────────────────────────────────────
      // Use activatorEvent (pointer-down position) + delta (pointer movement)
      // to get the exact final cursor position. This is completely independent
      // of where the user grabbed the icon, eliminating the ±cellPx/2 error
      // that the translatedRect center approach had.
      const ae = activatorEvent as MouseEvent | TouchEvent;
      let cursorX: number;
      let cursorY: number;
      if ("clientX" in ae) {
        cursorX = ae.clientX + delta.x;
        cursorY = ae.clientY + delta.y;
      } else {
        const touch = ae.changedTouches?.[0] ?? ae.touches?.[0];
        cursorX = touch.clientX + delta.x;
        cursorY = touch.clientY + delta.y;
      }

      const containerRect = containerRef.current.getBoundingClientRect();
      const stride = cellPx + GRID_GAP;

      const newX = Math.max(0, Math.min(cols - 1, Math.round((cursorX - containerRect.left) / stride)));
      const newY = Math.max(0, Math.round((cursorY - containerRect.top) / stride));

      if (newX === activeEntry.x && newY === activeEntry.y) return;

      // Swap with occupant if any
      const occupant = positioned.find(
        (e) => e.id !== activeIdStr && e.x === newX && e.y === newY,
      );

      const nextLayout = desktop.layout.map((entry) => {
        if (entry.id === activeIdStr) return { ...entry, x: newX, y: newY };
        if (occupant && entry.id === occupant.id) {
          return { ...entry, x: activeEntry.x, y: activeEntry.y };
        }
        return entry;
      });

      // Item might not have been in layout yet (new item at 0,0 from removeFromFolder)
      if (!nextLayout.find((e) => e.id === activeIdStr)) {
        nextLayout.push({ id: activeIdStr, x: newX, y: newY });
      }

      updateLayout(nextLayout);
    },
    [positioned, desktop.layout, cols, cellPx, updateLayout, addToFolder],
  );

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;
    const stride = cellPx + GRID_GAP;
    const gridX = Math.max(0, Math.min(cols - 1, Math.floor(relX / stride)));
    const gridY = Math.max(0, Math.floor(relY / stride));
    setContextMenu({ x: e.clientX, y: e.clientY, gridX, gridY });
  };

  const handleCreateFolder = () => {
    if (contextMenu) {
      createEmptyFolder(contextMenu.gridX, contextMenu.gridY);
      setContextMenu(null);
    } else {
      createEmptyFolder(0, 0);
    }
  };

  const activePositioned = activeId ? positioned.find((e) => e.id === activeId) : null;
  const openFolder = openFolderId ? desktop.folders.find((f) => f.id === openFolderId) : null;
  const openFolderChildren = openFolder
    ? openFolder.children
        .map((cid) => websites.find((w) => w.id === cid))
        .filter((w): w is Website => Boolean(w))
    : [];

  if (!mounted) {
    return <div className="min-h-[240px] rounded-2xl" />;
  }

  return (
    <div className="relative" onClick={() => setContextMenu(null)}>
      {isMobile && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={handleCreateFolder}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#141416] px-3 py-2 text-xs text-white/60 hover:text-white hover:border-white/20 transition-colors"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            New Folder
          </button>
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div
          ref={containerRef}
          onContextMenu={handleContextMenu}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${gridRows}, auto)`,
            gap: `${GRID_GAP}px`,
          }}
          className="min-h-[240px] rounded-2xl"
        >
          {positioned.map((entry, i) => {
            const isActive = entry.id === activeId;
            const dimmed = q ? !matchesSearch(entry) : false;

            if (entry.kind === "item") {
              return (
                <div key={entry.id} style={{ gridColumn: entry.x + 1, gridRow: entry.y + 1 }}>
                  <DesktopItem
                    id={entry.id}
                    item={entry.item}
                    isActive={isActive}
                    isDragOver={false}
                    animationDelay={i * 0.03}
                    cellPx={cellPx}
                    dimmed={dimmed}
                  />
                </div>
              );
            }
            if (entry.kind === "folder") {
              return (
                <div key={entry.id} style={{ gridColumn: entry.x + 1, gridRow: entry.y + 1 }}>
                  <FolderIcon
                    folder={entry.folder}
                    children={entry.children}
                    isActive={isActive}
                    animationDelay={i * 0.03}
                    cellPx={cellPx}
                    dimmed={dimmed}
                    onOpen={() => setOpenFolderId(entry.id)}
                  />
                </div>
              );
            }
            return null;
          })}
        </div>

        {/* snapCenterToCursor: ghost center always locks to the cursor, no offset gap */}
        <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
          {activeId && activePositioned ? (
            <div className="opacity-90 rotate-1 scale-105">
              <DragGhost entry={activePositioned} cellPx={cellPx} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            style={{
              position: "fixed",
              top: contextMenu.y,
              left: contextMenu.x,
              zIndex: 200,
            }}
            className="overflow-hidden rounded-xl border border-white/10 bg-[#18181B] shadow-[0_8px_30px_rgba(0,0,0,0.6)] py-1 min-w-[160px]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCreateFolder}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/[0.06] transition-colors text-left"
            >
              <FolderPlus className="h-4 w-4" />
              New Folder
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {openFolder && (
        <FolderOverlay
          folder={openFolder}
          children={openFolderChildren}
          onClose={() => setOpenFolderId(null)}
          onRemoveChild={(childId) => removeFromFolder(openFolder.id, childId)}
          onRename={(name) => renameFolder(openFolder.id, name)}
          onDelete={() => {
            deleteFolder(openFolder.id);
            setOpenFolderId(null);
          }}
        />
      )}
    </div>
  );
}
