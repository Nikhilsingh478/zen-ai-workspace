import { useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Trash2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImportantMessage } from "@/lib/important-messages";

export function MessageCard({
  message,
  onEdit,
  onRemove,
}: {
  message: ImportantMessage;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = () => {
    if (confirmDelete) {
      onRemove();
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 2000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="group relative rounded-2xl border border-border bg-[var(--surface-2)] hover:border-white/[0.13] hover:bg-[var(--surface-3)] transition-colors p-5 md:p-6"
    >
      {/* Actions */}
      <div className="absolute right-3 top-3 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="h-7 w-7 grid place-items-center rounded-lg text-copy-muted hover:text-foreground hover:bg-white/[0.06] transition"
          aria-label="Edit message"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleDelete}
          className={cn(
            "h-7 px-2 grid place-items-center rounded-lg text-xs transition-all",
            confirmDelete
              ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
              : "text-copy-muted hover:text-foreground hover:bg-white/[0.06] w-7",
          )}
          aria-label={confirmDelete ? "Confirm delete" : "Delete message"}
        >
          {confirmDelete ? "Confirm?" : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="pr-20">
        <h3 className="text-[15px] font-semibold tracking-tight text-foreground leading-snug">
          {message.motive}
        </h3>
        <span className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--surface-3)] border border-border text-[11px] font-medium text-copy-secondary">
          <Clock className="h-3 w-3" />
          {message.time}
        </span>
        <p className="mt-3 text-[13.5px] leading-[1.65] text-copy-secondary whitespace-pre-wrap">
          {message.message}
        </p>
      </div>
    </motion.div>
  );
}