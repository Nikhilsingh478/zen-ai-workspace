import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";

export function MatrixModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ scale: 0.96, opacity: 0, y: 6 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md rounded-2xl border border-border/70 bg-[var(--surface-2)] p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
              <button
                onClick={onClose}
                className="h-8 w-8 grid place-items-center rounded-lg text-secondary hover:text-foreground hover:bg-white/[0.05] transition"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const fieldClass =
  "w-full rounded-xl bg-[var(--surface-3)]/60 border border-border/60 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-white/20 focus:bg-[var(--surface-3)] transition";

export const labelClass = "block text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5";

export const primaryButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-foreground text-background px-4 py-2.5 text-sm font-medium hover:opacity-90 active:scale-[0.97] transition";

export const ghostButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-transparent text-secondary hover:text-foreground px-4 py-2.5 text-sm font-medium hover:bg-white/[0.04] transition";