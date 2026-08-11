/**
 * MoodEntryForm — reusable form for both create and edit
 * Supports quick-log (mood only) or expanded (all optional fields)
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { MOOD_CONFIG, type MoodLevel, type MoodEntry, type MoodEntryInput } from "@/lib/mood";
import { MoodSelector, MetricScale } from "@/components/mood/mood-selector";
import { cn } from "@/lib/utils";
import {
  fieldClass,
  primaryButtonClass,
  ghostButtonClass,
} from "@/components/matrix-modal";

interface MoodEntryFormProps {
  /** Existing entry (edit mode) */
  initialValues?: MoodEntry;
  onSubmit: (input: MoodEntryInput) => Promise<void>;
  onCancel?: () => void;
  /** If true, show all fields expanded from the start */
  expandedByDefault?: boolean;
  loading?: boolean;
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function MoodEntryForm({
  initialValues,
  onSubmit,
  onCancel,
  expandedByDefault = false,
  loading = false,
}: MoodEntryFormProps) {
  const [mood, setMood] = useState<MoodLevel | null>(
    (initialValues?.mood as MoodLevel) ?? null,
  );
  const [stress, setStress] = useState<number | null>(initialValues?.stress ?? null);
  const [energy, setEnergy] = useState<number | null>(initialValues?.energy ?? null);
  const [focus, setFocus] = useState<number | null>(initialValues?.focus ?? null);
  const [sleep, setSleep] = useState<number | null>(initialValues?.sleepQuality ?? null);
  const [reason, setReason] = useState<string>(initialValues?.reason ?? "");
  const [reflection, setReflection] = useState<string>(initialValues?.reflection ?? "");
  const [expanded, setExpanded] = useState(expandedByDefault || !!initialValues);
  const [saving, setSaving] = useState(false);

  const isEditMode = !!initialValues;
  const canSubmit = mood !== null && !saving && !loading;

  const handleMoodSelect = useCallback((level: MoodLevel) => {
    setMood(level);
    // Auto-expand after mood selection on first log
    if (!expanded && !isEditMode) {
      setExpanded(true);
    }
  }, [expanded, isEditMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mood) return;
    setSaving(true);
    try {
      await onSubmit({
        mood,
        moodLabel: MOOD_CONFIG[mood].label,
        stress: stress,
        energy: energy,
        focus: focus,
        sleepQuality: sleep,
        reason: reason.trim() || null,
        reflection: reflection.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  };

  const moodCfg = mood ? MOOD_CONFIG[mood] : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Mood selector */}
      <div className="space-y-2">
        <label className="block text-[11px] font-medium uppercase tracking-wider text-copy-secondary">
          How are you feeling?
        </label>
        <MoodSelector
          value={mood}
          onChange={handleMoodSelect}
          size="lg"
          disabled={saving || loading}
        />
      </div>

      {/* Expand toggle — only show after mood selected in quick-log mode */}
      {!isEditMode && mood && !expanded && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1.5 text-[12px] text-copy-secondary hover:text-foreground transition-colors"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          Add more detail
        </motion.button>
      )}

      {/* Optional fields */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="space-y-5 pt-1">
              {/* Secondary metrics */}
              <div
                className="rounded-xl border border-border p-4 space-y-4"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <p className="text-[11px] uppercase tracking-wider text-copy-muted font-medium">
                  Optional metrics
                </p>
                <MetricScale
                  label="Stress"
                  value={stress}
                  onChange={setStress}
                  disabled={saving || loading}
                  lowLabel="Calm"
                  highLabel="High stress"
                />
                <MetricScale
                  label="Energy"
                  value={energy}
                  onChange={setEnergy}
                  disabled={saving || loading}
                  lowLabel="Drained"
                  highLabel="Energized"
                />
                <MetricScale
                  label="Focus"
                  value={focus}
                  onChange={setFocus}
                  disabled={saving || loading}
                  lowLabel="Scattered"
                  highLabel="Locked in"
                />
                <MetricScale
                  label="Sleep"
                  value={sleep}
                  onChange={setSleep}
                  disabled={saving || loading}
                  lowLabel="Poor"
                  highLabel="Excellent"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-copy-secondary mb-1.5">
                  What&apos;s affecting it?
                  <span className="ml-2 normal-case tracking-normal font-normal text-copy-muted">
                    optional
                  </span>
                </label>
                <input
                  className={fieldClass}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                  placeholder="e.g. Big presentation, poor sleep, finished a project…"
                  disabled={saving || loading}
                />
              </div>

              {/* Reflection */}
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-copy-secondary mb-1.5">
                  Reflection
                  <span className="ml-2 normal-case tracking-normal font-normal text-copy-muted">
                    optional
                  </span>
                </label>
                <textarea
                  className={cn(fieldClass, "min-h-[80px] resize-none")}
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  maxLength={5000}
                  placeholder="Anything you want to remember about today…"
                  disabled={saving || loading}
                />
              </div>

              {/* Collapse link (non-edit mode only) */}
              {!isEditMode && (
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="flex items-center gap-1.5 text-[12px] text-copy-muted hover:text-copy-secondary transition-colors"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                  Show less
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      {mood && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="flex items-center justify-end gap-2 pt-1"
        >
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className={ghostButtonClass}
              disabled={saving || loading}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              primaryButtonClass,
              "min-w-[100px]",
              !canSubmit && "opacity-50 cursor-not-allowed",
            )}
            style={
              moodCfg
                ? {
                    background: `${moodCfg.color}`,
                    color: "#0a0a0a",
                  }
                : {}
            }
          >
            {saving ? "Saving…" : isEditMode ? "Save changes" : "Log mood"}
          </button>
        </motion.div>
      )}
    </form>
  );
}
