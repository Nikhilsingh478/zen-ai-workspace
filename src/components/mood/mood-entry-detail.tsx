/**
 * MoodEntryDetail — full view of a single entry with edit/delete actions
 * Uses MatrixModal for consistency with the rest of the app
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Trash2, AlertTriangle, X } from "lucide-react";
import { createPortal } from "react-dom";
import { MOOD_CONFIG, type MoodEntry, type MoodEntryInput } from "@/lib/mood";
import { MoodEntryForm } from "@/components/mood/mood-entry-form";
import { cn } from "@/lib/utils";
import { ghostButtonClass } from "@/components/matrix-modal";

interface MoodEntryDetailProps {
  entry: MoodEntry | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, input: MoodEntryInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function MetricRow({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-[13px] text-copy-secondary">{label}</span>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((v) => (
          <div
            key={v}
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-all",
              v <= value ? "bg-white/60" : "bg-white/10",
            )}
          />
        ))}
        <span className="text-[13px] font-medium text-foreground ml-1.5">{value}</span>
      </div>
    </div>
  );
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function MoodEntryDetail({
  entry,
  open,
  onClose,
  onUpdate,
  onDelete,
}: MoodEntryDetailProps) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleClose = () => {
    setEditing(false);
    setConfirming(false);
    onClose();
  };

  const handleUpdate = async (input: MoodEntryInput) => {
    if (!entry) return;
    await onUpdate(entry.id, input);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!entry) return;
    setDeleting(true);
    try {
      await onDelete(entry.id);
      handleClose();
    } finally {
      setDeleting(false);
    }
  };

  // Close on escape
  if (typeof window !== "undefined") {
    // handled via portal click-outside
  }

  if (!entry) return null;

  const cfg = MOOD_CONFIG[entry.mood];
  const dateStr = new Date(entry.createdAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = new Date(entry.createdAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onKeyDown={(e) => e.key === "Escape" && handleClose()}
        >
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={handleClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Mood entry — ${cfg.label}`}
            initial={{ scale: 0.96, opacity: 0, y: 6 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="relative w-full max-w-md rounded-2xl border border-border bg-[var(--surface-2)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] overflow-hidden max-h-[90dvh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 pb-0">
              <div>
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ background: cfg.color }}
                  />
                  <h2 className="text-[15px] font-semibold tracking-tight">{cfg.label}</h2>
                  <span
                    className="text-[13px] font-medium"
                    style={{ color: cfg.color }}
                  >
                    {entry.mood} / 5
                  </span>
                </div>
                <p className="text-[12px] text-copy-muted mt-1">
                  {dateStr} · {timeStr}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="h-8 w-8 grid place-items-center rounded-lg text-copy-secondary hover:text-foreground hover:bg-white/[0.05] transition shrink-0"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {editing ? (
                <MoodEntryForm
                  initialValues={entry}
                  onSubmit={handleUpdate}
                  onCancel={() => setEditing(false)}
                  expandedByDefault
                />
              ) : (
                <>
                  {/* Metrics */}
                  {(entry.stress != null || entry.energy != null || entry.focus != null || entry.sleepQuality != null) && (
                    <div
                      className="rounded-xl border border-border p-4"
                      style={{ background: "rgba(255,255,255,0.02)" }}
                    >
                      <MetricRow label="Stress" value={entry.stress} />
                      <MetricRow label="Energy" value={entry.energy} />
                      <MetricRow label="Focus" value={entry.focus} />
                      <MetricRow label="Sleep quality" value={entry.sleepQuality} />
                    </div>
                  )}

                  {/* Reason */}
                  {entry.reason && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-copy-muted font-medium mb-1.5">
                        What affected it
                      </p>
                      <p className="text-[14px] leading-relaxed text-copy-secondary">
                        {entry.reason}
                      </p>
                    </div>
                  )}

                  {/* Reflection */}
                  {entry.reflection && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-copy-muted font-medium mb-1.5">
                        Reflection
                      </p>
                      <p className="text-[14px] leading-relaxed text-foreground/80 whitespace-pre-wrap">
                        {entry.reflection}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  {!confirming ? (
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => setEditing(true)}
                        className={cn(
                          ghostButtonClass,
                          "flex items-center gap-1.5 flex-1 justify-center",
                        )}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirming(true)}
                        className="flex items-center gap-1.5 rounded-xl bg-transparent text-red-400/70 hover:text-red-400 hover:bg-red-400/10 px-4 py-2.5 text-sm font-medium transition flex-1 justify-center"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-red-400/20 bg-red-400/[0.04] p-4 space-y-3"
                    >
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="h-4 w-4 text-red-400/60 shrink-0 mt-0.5" />
                        <p className="text-[13px] text-copy-secondary leading-relaxed">
                          This will permanently delete this mood entry. This can&apos;t be undone.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setConfirming(false)}
                          className={cn(ghostButtonClass, "flex-1 justify-center")}
                          disabled={deleting}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleDelete}
                          disabled={deleting}
                          className="flex items-center gap-1.5 rounded-xl bg-red-500/80 text-white px-4 py-2.5 text-sm font-medium hover:bg-red-500 transition flex-1 justify-center disabled:opacity-50"
                        >
                          {deleting ? "Deleting…" : "Yes, delete"}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
