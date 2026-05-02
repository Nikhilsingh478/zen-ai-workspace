import { useDraggable, useDroppable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import { Folder } from "lucide-react";
import type { DesktopFolder, Website } from "@/lib/store";
import { faviconFor } from "@/lib/store";
import { cn } from "@/lib/utils";

interface FolderIconProps {
  folder: DesktopFolder;
  children: Website[];
  isActive: boolean;
  animationDelay?: number;
  onOpen: () => void;
  cellPx?: number;
}

export function FolderIcon({
  folder,
  children,
  isActive,
  animationDelay = 0,
  onOpen,
  cellPx = 100,
}: FolderIconProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({ id: folder.id });

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: folder.id });

  const setRef = (node: HTMLDivElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  const preview = children.slice(0, 4);
  const compact = cellPx < 90;
  const wellSize = compact ? "h-10 w-10 rounded-xl" : "h-14 w-14 rounded-2xl";
  const folderIcon = compact ? "h-5 w-5" : "h-7 w-7";
  const childIcon = compact ? "h-3 w-3" : "h-4 w-4";

  return (
    <div
      ref={setRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.25 : 1, transition: "opacity 0.15s" }}
      onClick={(e) => {
        if (isDragging) return;
        e.stopPropagation();
        onOpen();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, delay: animationDelay, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ y: -2 }}
        className={cn(
          "group flex flex-col items-center gap-2 rounded-2xl cursor-grab active:cursor-grabbing select-none transition-colors",
          compact ? "p-2" : "p-3",
          isOver ? "bg-white/10 ring-1 ring-white/20" : "hover:bg-white/[0.04]",
          isActive && "opacity-40",
        )}
      >
        <div
          className={cn(
            "relative flex-shrink-0 overflow-hidden bg-[#18181B] border border-white/[0.12] transition-shadow",
            wellSize,
            "group-hover:shadow-[0_4px_16px_rgba(0,0,0,0.4)] group-hover:border-white/[0.2]",
            isOver && "border-white/30 shadow-[0_4px_20px_rgba(255,255,255,0.1)]",
          )}
        >
          {preview.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center">
              <Folder className={cn("text-white/30", folderIcon)} />
            </div>
          ) : (
            <div className={cn("grid grid-cols-2 gap-px h-full w-full", compact ? "p-1" : "p-1.5")}>
              {[0, 1, 2, 3].map((i) => {
                const child = preview[i];
                return (
                  <div
                    key={i}
                    className="rounded overflow-hidden bg-white/[0.04] flex items-center justify-center"
                  >
                    {child ? (
                      <img
                        src={faviconFor(child.url, 32)}
                        alt=""
                        draggable={false}
                        className={cn("object-contain", childIcon)}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <span className={cn(
          "text-white/70 text-center leading-tight line-clamp-2 w-full",
          compact ? "text-[10px] max-w-[70px]" : "text-[11px] max-w-[80px]",
        )}>
          {folder.name}
        </span>
      </motion.div>
    </div>
  );
}
