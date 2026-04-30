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
import { motion, AnimatePresence } from "framer-motion";
import { FolderPlus } from "lucide-react";
import { useDesktopStorage, type Website } from "@/lib/store";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  buildLauncherEntries,
  normalizeDesktopLayout,
  GRID_GAP,
} from "@/lib/desktop-layout";
import { DesktopItem } from "@/components/desktop/desktop-item";
import { FolderIcon } from "@/components/desktop/folder-icon";
import { FolderOverlay } from "@/components/desktop/folder-overlay";
import { DragGhost } from "@/components/desktop/drag-ghost";

const DESKTOP_COLS = 8;
const MOBILE_COLS = 4;

export function DesktopGrid() {
  const {
    items,
    desktop,
    updateLayout,
    createFolder,
    removeFromFolder,
    createEmptyFolder,
    addToFolder,
    renameFolder,
    deleteFolder,
  } = useDesktopStorage();

  const isMobile = useIsMobile();
  const cols = isMobile ? MOBILE_COLS : DESKTOP_COLS;

  // SSR guard — dnd-kit uses useLayoutEffect internally
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const containerRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; gridX: number; gridY: number } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  const websites = items.filter((item): item is Website => item.type === "website");
  const entries = buildLauncherEntries(websites, desktop.folders);
  const positioned = normalizeDesktopLayout(entries, desktop.layout, cols);

  // Compute grid rows needed
  const maxRow = positioned.reduce((max, e) => Math.max(max, e.y), 0);
  const gridRows = Math.max(maxRow + 2, 4);

  function getCellSize() {
    if (!containerRef.current) return 100;
    const rect = containerRef.current.getBoundingClientRect();
    return (rect.width - (cols - 1) * GRID_GAP) / cols;
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    setContextMenu(null);
  };

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over, delta } = event;
      setActiveId(null);

      const activeIdStr = String(active.id);
      const activeEntry = positioned.find((e) => e.id === activeIdStr);
      if (!activeEntry) return;

      // Dropped onto another item/folder
      if (over && String(over.id) !== activeIdStr) {
        const overIdStr = String(over.id);
        const overEntry = positioned.find((e) => e.id === overIdStr);
        if (overEntry) {
          if (overEntry.kind === "folder") {
            // Add to existing folder
            addToFolder(overIdStr, activeIdStr);
            return;
          }
          if (overEntry.kind === "item" && activeEntry.kind === "item") {
            // Create new folder from two items
            createFolder(activeIdStr, overIdStr);
            return;
          }
          if (activeEntry.kind === "folder" && overEntry.kind === "item") {
            // Add item to folder
            addToFolder(activeIdStr, overIdStr);
            return;
          }
        }
      }

      // Move to new grid position
      const cellSize = getCellSize();
      const stride = cellSize + GRID_GAP;

      const rawNewX = activeEntry.x + delta.x / stride;
      const rawNewY = activeEntry.y + delta.y / stride;
      const newX = Math.max(0, Math.min(cols - 1, Math.round(rawNewX)));
      const newY = Math.max(0, Math.round(rawNewY));

      if (newX === activeEntry.x && newY === activeEntry.y) return;

      // Check if target is occupied → swap
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

      // If active wasn't in layout, add it
      if (!nextLayout.find((e) => e.id === activeIdStr)) {
        nextLayout.push({ id: activeIdStr, x: newX, y: newY });
      }

      updateLayout(nextLayout);
    },
    [positioned, desktop.layout, cols, updateLayout, createFolder, addToFolder],
  );

  // Right-click context menu on desktop
  const handleContextMenu = (e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;
    const cellSize = getCellSize();
    const stride = cellSize + GRID_GAP;
    const gridX = Math.max(0, Math.min(cols - 1, Math.floor(relX / stride)));
    const gridY = Math.max(0, Math.floor(relY / stride));
    setContextMenu({ x: e.clientX, y: e.clientY, gridX, gridY });
  };

  const handleCreateFolder = () => {
    if (contextMenu) {
      createEmptyFolder(contextMenu.gridX, contextMenu.gridY);
      setContextMenu(null);
    } else {
      // Mobile: auto-place
      createEmptyFolder(0, 0);
    }
  };

  // Active dragging item info (for overlay)
  const activePositioned = activeId ? positioned.find((e) => e.id === activeId) : null;

  const openFolder = openFolderId
    ? desktop.folders.find((f) => f.id === openFolderId)
    : null;
  const openFolderChildren = openFolder
    ? openFolder.children
        .map((cid) => websites.find((w) => w.id === cid))
        .filter((w): w is Website => Boolean(w))
    : [];

  // While SSR / before hydration — render a placeholder to avoid useLayoutEffect mismatch
  if (!mounted) {
    return <div className="min-h-[240px] rounded-2xl" />;
  }

  return (
    <div className="relative" onClick={() => setContextMenu(null)}>
      {/* Mobile Create Folder Button */}
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
        {/* Grid */}
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
            if (entry.kind === "item") {
              return (
                <div
                  key={entry.id}
                  style={{
                    gridColumn: entry.x + 1,
                    gridRow: entry.y + 1,
                  }}
                >
                  <DesktopItem
                    id={entry.id}
                    item={entry.item}
                    isActive={isActive}
                    isDragOver={false}
                    animationDelay={i * 0.03}
                  />
                </div>
              );
            }
            if (entry.kind === "folder") {
              return (
                <div
                  key={entry.id}
                  style={{
                    gridColumn: entry.x + 1,
                    gridRow: entry.y + 1,
                  }}
                >
                  <FolderIcon
                    folder={entry.folder}
                    children={entry.children}
                    isActive={isActive}
                    animationDelay={i * 0.03}
                    onOpen={() => setOpenFolderId(entry.id)}
                  />
                </div>
              );
            }
            return null;
          })}
        </div>

        {/* Drag Overlay */}
        <DragOverlay dropAnimation={null}>
          {activePositioned && (
            <div className="rotate-1 pointer-events-none">
              <DragGhost entry={activePositioned} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            style={{ position: "fixed", top: contextMenu.y, left: contextMenu.x, zIndex: 200 }}
            className="overflow-hidden rounded-xl border border-white/10 bg-[#18181B] shadow-[0_8px_30px_rgba(0,0,0,0.6)] py-1 min-w-[160px]"
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

      {/* Folder Overlay */}
      {openFolder && (
        <FolderOverlay
          folder={openFolder}
          children={openFolderChildren}
          onClose={() => setOpenFolderId(null)}
          onRemoveChild={(childId) => {
            removeFromFolder(openFolder.id, childId);
          }}
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
