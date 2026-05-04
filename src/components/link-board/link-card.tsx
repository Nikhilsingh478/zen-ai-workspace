import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { Pencil, Trash2, ExternalLink, GripVertical } from "lucide-react";
import { faviconFor } from "@/lib/store";
import type { LinkItem } from "@/lib/link-board";
import { cn } from "@/lib/utils";

export function LinkCard({
  link,
  onEdit,
  onRemove,
}: {
  link: LinkItem;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: link.id });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) {
      onRemove();
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 2000);
    }
  };

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 30 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-2xl border border-border bg-[var(--surface-2)]",
        "transition-all duration-300",
        "hover:border-white/[0.13] hover:bg-[var(--surface-3)]",
        "hover:shadow-[0_24px_48px_-20px_rgba(0,0,0,0.55)]",
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="absolute left-1.5 top-1/2 -translate-y-1/2 h-7 w-5 grid place-items-center text-copy-muted opacity-0 group-hover:opacity-100 transition cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Actions */}
      <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          whileTap={{ scale: 0.92 }}
          className="h-7 w-7 grid place-items-center rounded-lg text-copy-muted hover:text-foreground hover:bg-white/[0.06] transition"
          aria-label="Edit link"
        >
          <Pencil className="h-3.5 w-3.5" />
        </motion.button>
        <motion.button
          onClick={handleDelete}
          whileTap={{ scale: 0.92 }}
          className={cn(
            "h-7 w-7 grid place-items-center rounded-lg transition-all duration-200",
            confirmDelete
              ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
              : "text-copy-muted hover:text-foreground hover:bg-white/[0.06]",
          )}
          aria-label={confirmDelete ? "Confirm delete" : "Delete link"}
          title={confirmDelete ? "Click again to confirm" : "Delete"}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </motion.button>
      </div>

      <div className="p-4 pl-7">
        <div className="flex items-center gap-3 mb-2.5">
          <div className="h-9 w-9 shrink-0 rounded-lg bg-[var(--surface-3)] border border-border grid place-items-center overflow-hidden">
            <img
              src={faviconFor(link.url, 64)}
              alt=""
              className="h-5 w-5"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <p className="text-[13.5px] font-semibold tracking-tight text-foreground truncate flex-1 pr-12">
            {link.name}
          </p>
        </div>

        <a
          href={link.url}
          target="_blank"
          rel="noreferrer noopener"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-[12px] text-copy-secondary hover:text-foreground transition truncate max-w-full"
        >
          <span className="truncate">{link.url.replace(/^https?:\/\//, "")}</span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>

        {link.description && (
          <p className="mt-2.5 text-[12.5px] leading-[1.55] text-copy-secondary line-clamp-3">
            {link.description}
          </p>
        )}
      </div>
    </div>
  );
}