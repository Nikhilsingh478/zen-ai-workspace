import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FolderOpen, ExternalLink, Pencil, Check, Trash2 } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { DesktopFolder, Website } from "@/lib/store";
import { faviconFor } from "@/lib/store";
import { cn } from "@/lib/utils";

interface FolderOverlayProps {
  folder: DesktopFolder;
  children: Website[];
  onClose: () => void;
  onRemoveChild: (childId: string) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

const BACKDROP_DROP_ID = "folder-backdrop-drop";

export function FolderOverlay({
  folder,
  children,
  onClose,
  onRemoveChild,
  onRename,
  onDelete,
}: FolderOverlayProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const commitRename = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== folder.name) onRename(trimmed);
    else setName(folder.name);
    setEditing(false);
  };

  const handleDragStart = (e: DragStartEvent) => {
    setDraggingId(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setDraggingId(null);
    if (over && over.id === BACKDROP_DROP_ID) {
      onRemoveChild(String(active.id));
    }
  };

  const draggingItem = draggingId ? children.find((c) => c.id === draggingId) ?? null : null;

  return (
    <AnimatePresence>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <BackdropDropZone onClose={onClose}>
          <motion.div
            className="relative w-full max-w-lg mx-4 rounded-2xl border border-white/10 bg-[#141416] shadow-[0_24px_60px_rgba(0,0,0,0.7)]"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-white/[0.06]">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06]">
                <FolderOpen className="h-4.5 w-4.5 text-white/70" />
              </div>

              {editing ? (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") {
                        setName(folder.name);
                        setEditing(false);
                      }
                    }}
                    className="flex-1 rounded-lg border border-white/20 bg-white/[0.06] px-3 py-1.5 text-sm font-semibold text-white outline-none focus:border-white/40"
                  />
                  <button
                    onClick={commitRename}
                    className="rounded-lg p-1.5 text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-1 items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-white truncate">{folder.name}</span>
                  <button
                    onClick={() => setEditing(true)}
                    className="shrink-0 rounded p-1 text-white/30 hover:text-white/70 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={onDelete}
                  title="Delete folder"
                  className="rounded-lg p-1.5 text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-5">
              {children.length === 0 ? (
                <p className="text-center text-sm text-white/30 py-8">
                  Drag items onto this folder to add them.
                </p>
              ) : (
                <>
                  <p className="text-xs text-white/30 mb-3 text-center">
                    Drag an icon outside this panel to remove it from the folder
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {children.map((item, i) => (
                      <FolderChild
                        key={item.id}
                        item={item}
                        index={i}
                        isDragging={draggingId === item.id}
                        onRemove={() => onRemoveChild(item.id)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </BackdropDropZone>

        <DragOverlay dropAnimation={null}>
          {draggingItem ? <DraggingItemGhost item={draggingItem} /> : null}
        </DragOverlay>
      </DndContext>
    </AnimatePresence>
  );
}

function BackdropDropZone({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: BACKDROP_DROP_ID });

  return (
    <motion.div
      ref={setNodeRef}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-colors duration-150",
        isOver && "bg-black/40",
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {isOver && (
        <div className="pointer-events-none absolute inset-4 rounded-2xl border-2 border-dashed border-white/20 flex items-center justify-center">
          <span className="text-white/30 text-sm font-medium">Release to move to desktop</span>
        </div>
      )}
      {children}
    </motion.div>
  );
}

function FolderChild({
  item,
  index,
  isDragging,
  onRemove,
}: {
  item: Website;
  index: number;
  isDragging: boolean;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: item.id });

  return (
    <motion.div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: isDragging ? 0 : 1, scale: 1 }}
      transition={{ delay: index * 0.04, duration: 0.18 }}
      className="group relative flex flex-col items-center gap-2 rounded-xl p-3 transition-colors hover:bg-white/[0.04] cursor-grab active:cursor-grabbing select-none touch-none"
    >
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute -top-1 -right-1 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-[#141416] border border-white/20 text-white/50 hover:text-white hover:border-white/40 transition-colors z-10"
      >
        <X className="h-3 w-3" />
      </button>
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col items-center gap-2 w-full"
      >
        <div className="relative h-12 w-12 rounded-xl overflow-hidden bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
          <img
            src={faviconFor(item.url, 64)}
            alt=""
            className="h-7 w-7 object-contain"
            draggable={false}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity rounded-xl">
            <ExternalLink className="h-3.5 w-3.5 text-white" />
          </div>
        </div>
        <span className="text-[11px] text-white/70 text-center leading-tight line-clamp-2 w-full">
          {item.name}
        </span>
      </a>
    </motion.div>
  );
}

function DraggingItemGhost({ item }: { item: Website }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl p-3 bg-white/[0.10] ring-1 ring-white/25 shadow-[0_8px_32px_rgba(0,0,0,0.8)] w-[88px]">
      <div className="h-12 w-12 rounded-xl overflow-hidden bg-white/[0.06] border border-white/20 flex items-center justify-center">
        <img
          src={faviconFor(item.url, 64)}
          alt=""
          className="h-7 w-7 object-contain"
          draggable={false}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
      <span className="text-[11px] text-white/90 text-center leading-tight line-clamp-2 w-full">
        {item.name}
      </span>
    </div>
  );
}
