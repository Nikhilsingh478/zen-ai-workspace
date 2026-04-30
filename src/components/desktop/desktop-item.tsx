import { useDraggable, useDroppable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import { ExternalLink, Sparkles } from "lucide-react";
import type { Website } from "@/lib/store";
import { faviconFor } from "@/lib/store";
import { cn } from "@/lib/utils";

interface DesktopItemProps {
  id: string;
  item: Website | { type: "prompt"; title: string; id: string };
  isActive: boolean;
  isDragOver: boolean;
  animationDelay?: number;
}

export function DesktopItem({ id, item, isActive, isDragOver, animationDelay = 0 }: DesktopItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({ id });

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id });

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
      style={{ opacity: isDragging ? 0.25 : 1, transition: "opacity 0.15s" }}
      onClick={(e) => {
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
        whileHover={{ y: -2 }}
        className={cn(
          "group relative flex flex-col items-center gap-2 rounded-2xl p-3 cursor-grab active:cursor-grabbing select-none transition-colors",
          isDragOver || isOver ? "bg-white/10 ring-1 ring-white/20" : "hover:bg-white/[0.04]",
          isActive && "opacity-40",
        )}
      >
        <div
          className={cn(
            "relative h-14 w-14 flex-shrink-0 rounded-2xl overflow-hidden bg-[#18181B] border border-white/[0.08] flex items-center justify-center transition-shadow",
            "group-hover:shadow-[0_4px_16px_rgba(0,0,0,0.4)] group-hover:border-white/[0.15]",
          )}
        >
          {isWebsite ? (
            <img
              src={faviconFor(url!, 64)}
              alt=""
              draggable={false}
              className="h-8 w-8 object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
                const fallback = e.currentTarget.nextSibling as HTMLElement;
                if (fallback) fallback.style.display = "flex";
              }}
            />
          ) : null}
          {!isWebsite && (
            <div className="flex items-center justify-center h-full w-full">
              <Sparkles className="h-6 w-6 text-white/50" />
            </div>
          )}
          {isWebsite && (
            <div className="hidden absolute inset-0 items-center justify-center">
              <span className="text-xl font-bold text-white/60">
                {label.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <span className="text-[11px] text-white/70 text-center leading-tight line-clamp-2 w-full max-w-[80px]">
          {label}
        </span>

        {isWebsite && (
          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <ExternalLink className="h-3 w-3 text-white/30" />
          </div>
        )}
      </motion.div>
    </div>
  );
}
