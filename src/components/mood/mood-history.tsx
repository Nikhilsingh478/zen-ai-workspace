/**
 * MoodHistory — compact recent entries list
 */

import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Trash2 } from "lucide-react";
import { MOOD_CONFIG, type MoodEntry } from "@/lib/mood";
import { cn } from "@/lib/utils";

interface MoodHistoryProps {
  entries: MoodEntry[];
  onEdit: (entry: MoodEntry) => void;
  onDelete: (entry: MoodEntry) => void;
  maxItems?: number;
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-CA");
  const entryStr = date.toLocaleDateString("en-CA");

  if (entryStr === todayStr) {
    return `Today · ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (entryStr === yesterday.toLocaleDateString("en-CA")) {
    return "Yesterday";
  }

  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function MetricPip({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  return (
    <span className="text-[11px] text-copy-muted">
      {label} <span className="text-copy-secondary font-medium">{value}</span>
    </span>
  );
}

export function MoodHistory({
  entries,
  onEdit,
  onDelete,
  maxItems = 10,
}: MoodHistoryProps) {
  const visible = entries.slice(0, maxItems);

  if (!visible.length) return null;

  return (
    <div className="space-y-0.5">
      <AnimatePresence initial={false} mode="popLayout">
        {visible.map((entry, i) => {
          const cfg = MOOD_CONFIG[entry.mood];
          return (
            <motion.div
              key={entry.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -8, transition: { duration: 0.18 } }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.15), ease: EASE }}
              className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors"
            >
              {/* Mood color indicator */}
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: cfg.color }}
              />

              {/* Date + mood label */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[13px] font-medium text-foreground">
                    {cfg.label}
                  </span>
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: cfg.color }}
                  >
                    {entry.mood} / 5
                  </span>
                  <span className="text-[11px] text-copy-muted">
                    {formatRelativeDate(entry.createdAt)}
                  </span>
                </div>

                {/* Optional metric pills */}
                {(entry.stress != null || entry.energy != null || entry.focus != null || entry.sleepQuality != null) && (
                  <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
                    <MetricPip label="Stress" value={entry.stress} />
                    <MetricPip label="Energy" value={entry.energy} />
                    <MetricPip label="Focus" value={entry.focus} />
                    <MetricPip label="Sleep" value={entry.sleepQuality} />
                  </div>
                )}

                {/* Reason preview */}
                {entry.reason && (
                  <p className="text-[12px] text-copy-muted mt-0.5 truncate max-w-xs">
                    {entry.reason}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className={cn(
                "flex items-center gap-1 shrink-0 transition-opacity",
                "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
              )}>
                <button
                  onClick={() => onEdit(entry)}
                  className="h-7 w-7 grid place-items-center rounded-lg text-copy-secondary hover:text-foreground hover:bg-white/[0.06] transition"
                  aria-label="Edit entry"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onDelete(entry)}
                  className="h-7 w-7 grid place-items-center rounded-lg text-copy-secondary hover:text-red-400 hover:bg-red-400/10 transition"
                  aria-label="Delete entry"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
