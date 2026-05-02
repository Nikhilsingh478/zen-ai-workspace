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
  dimmed?: boolean;
}

export function FolderIcon({
  folder,
  children,
  isActive,
  animationDelay = 0,
  onOpen,
  cellPx = 100,
  dimmed = false,
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

  // Smaller well to match DesktopItem — containers smaller, icons intact
  const wellSize       = compact ? "h-10 w-10 rounded-xl" : "h-12 w-12 rounded-xl";
  const childIcon      = compact ? "h-3.5 w-3.5" : "h-4 w-4";
  const folderIconSize = compact ? "h-6 w-6" : "h-7 w-7";

  return (
    <div
      ref={setRef}
      {...listeners}
      {...attributes}
      style={{
        opacity: isDragging ? 0 : dimmed ? 0.25 : 1,
        transition: "opacity 0.15s",
        touchAction: "none",
        width: cellPx,
        height: cellPx,
      }}
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
          "group flex flex-col items-center justify-center gap-1 rounded-2xl cursor-grab active:cursor-grabbing select-none transition-colors p-1.5 w-full h-full",
          isOver
            ? "bg-white/10 ring-2 ring-white/30 ring-offset-1 ring-offset-transparent"
            : "hover:bg-white/[0.04]",
          isActive && "opacity-40",
        )}
      >
        <div
          className={cn(
            "relative flex-shrink-0 overflow-hidden bg-[#18181B] border transition-all",
            wellSize,
            isOver
              ? "border-white/30 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
              : "border-white/[0.12] group-hover:border-white/[0.2] group-hover:shadow-[0_4px_16px_rgba(0,0,0,0.4)]",
          )}
        >
          {preview.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center">
              <Folder className={cn("text-white/30", folderIconSize)} />
            </div>
          ) : (
            <div className={cn("grid grid-cols-2 gap-px h-full w-full", compact ? "p-0.5" : "p-1")}>
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

        <span
          className={cn(
            "text-white/70 text-center leading-tight w-full line-clamp-2 break-words px-0.5",
            compact ? "text-[9px]" : "text-[10px]",
          )}
        >
          {folder.name}
        </span>
      </motion.div>
    </div>
  );
}
