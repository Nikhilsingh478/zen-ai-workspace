import { useDraggable, useDroppable } from "@dnd-kit/core";
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
  isDragOver: boolean;
  animationDelay?: number;
  cellPx?: number;
}

export function DesktopItem({
  id,
  item,
  isActive,
  isDragOver,
  animationDelay = 0,
  cellPx = 100,
}: DesktopItemProps) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id });
  const [faviconError, setFaviconError] = useState(false);

  const isWebsite = item.type === "website";
  const label = isWebsite ? (item as Website).name : (item as { title: string }).title;
  const url = isWebsite ? (item as Website).url : undefined;

  const setRef = (node: HTMLDivElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  return (
    <div
      ref={setRef}
      {...listeners}
      {...attributes}
      style={{
        opacity: isDragging ? 0 : 1,
        transition: "opacity 0.1s",
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
          "group relative flex flex-col items-center justify-center gap-2 rounded-2xl p-2 cursor-grab active:cursor-grabbing select-none transition-colors w-full h-full",
          isDragOver || isOver
            ? "bg-white/10 ring-1 ring-white/20"
            : "hover:bg-white/[0.04]",
        )}
      >
        {/* Icon well */}
        <div
          className={cn(
            "relative h-14 w-14 flex-shrink-0 rounded-2xl overflow-hidden bg-[#18181B] border border-white/[0.08] flex items-center justify-center transition-all duration-150",
            "group-hover:bg-[#1F1F23] group-hover:border-white/[0.15]",
          )}
        >
          {isWebsite && !faviconError ? (
            <img
              src={faviconFor(url!, 64)}
              alt=""
              draggable={false}
              className="h-8 w-8 object-contain"
              onError={() => setFaviconError(true)}
            />
          ) : isWebsite && faviconError ? (
            <span className="text-xl font-bold text-white/60">
              {label.charAt(0).toUpperCase()}
            </span>
          ) : (
            <Sparkles className="h-6 w-6 text-white/50" />
          )}
        </div>

        {/* Label */}
        <span className="text-[11px] text-white/70 text-center leading-tight line-clamp-2 w-full max-w-[80px]">
          {label}
        </span>
      </motion.div>
    </div>
  );
}