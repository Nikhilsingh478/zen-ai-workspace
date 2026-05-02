import { useDraggable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { Website } from "@/lib/store";
import { faviconFor } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface DesktopItemProps {
  id: string;
  item: Website | { type: "prompt"; title: string; id: string };
  isActive: boolean;
  isDragOver?: boolean;
  animationDelay?: number;
  cellPx?: number;
  dimmed?: boolean;
}

export function DesktopItem({
  id,
  item,
  isActive,
  animationDelay = 0,
  cellPx = 100,
  dimmed = false,
}: DesktopItemProps) {
  // Items are ONLY draggable — NOT droppable.
  // Only FolderIcon is a drop target so folder detection is unambiguous.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  const [faviconError, setFaviconError] = useState(false);

  const isWebsite = item.type === "website";
  const label = isWebsite ? (item as Website).name : (item as { title: string }).title;
  const url = isWebsite ? (item as Website).url : undefined;

  const compact = cellPx < 90;
  const iconWell = compact ? "h-10 w-10 rounded-xl" : "h-14 w-14 rounded-2xl";
  const iconImg = compact ? "h-8 w-8" : "h-10 w-10";

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        opacity: isDragging ? 0 : dimmed ? 0.25 : 1,
        transition: "opacity 0.2s",
        width: cellPx,
        height: cellPx,
        touchAction: "none",
      }}
      onClick={() => {
        if (isDragging) return;
        if (isWebsite && url) {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, delay: animationDelay, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ scale: 1.06 }}
        className={cn(
          "group relative flex flex-col items-center justify-center gap-1.5 rounded-2xl p-2",
          "cursor-grab active:cursor-grabbing select-none transition-colors w-full h-full",
          isActive ? "opacity-40" : "hover:bg-white/[0.04]",
        )}
      >
        <div
          className={cn(
            "relative flex-shrink-0 overflow-hidden bg-[#18181B] border border-white/[0.08]",
            "flex items-center justify-center transition-all duration-150",
            iconWell,
            "group-hover:bg-[#1F1F23] group-hover:border-white/[0.15]",
          )}
        >
          {isWebsite && !faviconError ? (
            <img
              src={faviconFor(url!, 64)}
              alt=""
              draggable={false}
              className={cn("object-contain", iconImg)}
              onError={() => setFaviconError(true)}
            />
          ) : isWebsite && faviconError ? (
            <span className={cn("font-bold text-white/60", compact ? "text-lg" : "text-xl")}>
              {label.charAt(0).toUpperCase()}
            </span>
          ) : (
            <Sparkles className={cn("text-white/50", compact ? "h-7 w-7" : "h-8 w-8")} />
          )}
        </div>

        <span
          className={cn(
            "text-white/70 text-center leading-tight w-full line-clamp-2 break-words px-0.5",
            compact ? "text-[10px]" : "text-[11px]",
          )}
        >
          {label}
        </span>
      </motion.div>
    </div>
  );
}
