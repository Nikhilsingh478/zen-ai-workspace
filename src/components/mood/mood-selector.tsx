/**
 * MoodSelector — compact 1–5 segmented control
 * Keyboard accessible, no emoji dependency, label-driven
 */

import { motion } from "framer-motion";
import { MOOD_CONFIG, type MoodLevel } from "@/lib/mood";
import { cn } from "@/lib/utils";

interface MoodSelectorProps {
  value: MoodLevel | null;
  onChange: (level: MoodLevel) => void;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

export function MoodSelector({ value, onChange, size = "md", disabled = false }: MoodSelectorProps) {
  const levels: MoodLevel[] = [1, 2, 3, 4, 5];

  const sizeClasses = {
    sm: "py-2 px-1 text-[10px]",
    md: "py-3 px-1 text-[11px]",
    lg: "py-4 px-2 text-[12px]",
  };

  return (
    <div
      role="radiogroup"
      aria-label="Mood level"
      className="grid grid-cols-5 gap-1.5"
    >
      {levels.map((level) => {
        const cfg = MOOD_CONFIG[level];
        const selected = value === level;
        return (
          <motion.button
            key={level}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${level} — ${cfg.label}`}
            disabled={disabled}
            onClick={() => onChange(level)}
            whileHover={!disabled ? { scale: 1.04, y: -1 } : {}}
            whileTap={!disabled ? { scale: 0.96 } : {}}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1 rounded-xl border transition-all duration-200 select-none",
              sizeClasses[size],
              selected
                ? "border-transparent"
                : "border-border bg-[var(--surface-2)] hover:border-white/15 hover:bg-[var(--surface-3)]",
              disabled && "opacity-40 cursor-not-allowed",
            )}
            style={
              selected
                ? {
                    background: cfg.accent,
                    borderColor: `${cfg.color}50`,
                    boxShadow: `0 0 16px ${cfg.color}20`,
                  }
                : {}
            }
          >
            {/* Level number */}
            <span
              className="text-base font-bold leading-none"
              style={{ color: selected ? cfg.color : "rgba(255,255,255,0.4)" }}
            >
              {level}
            </span>
            {/* Label */}
            <span
              className="font-medium leading-tight text-center"
              style={{ color: selected ? cfg.color : "rgba(255,255,255,0.3)", fontSize: size === "lg" ? 11 : 10 }}
            >
              {cfg.label}
            </span>

            {/* Selected indicator dot */}
            {selected && (
              <motion.span
                layoutId="mood-selected-dot"
                className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full"
                style={{ background: cfg.color }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Compact single-stat scale (for stress/energy/focus/sleep) ────────────────

interface MetricScaleProps {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  lowLabel?: string;
  highLabel?: string;
}

export function MetricScale({
  label,
  value,
  onChange,
  disabled = false,
  lowLabel = "Low",
  highLabel = "High",
}: MetricScaleProps) {
  const levels = [1, 2, 3, 4, 5] as const;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-copy-secondary">
          {label}
        </span>
        {value != null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[10px] text-copy-muted hover:text-copy-secondary transition-colors"
            aria-label={`Clear ${label}`}
          >
            clear
          </button>
        )}
      </div>
      <div role="radiogroup" aria-label={label} className="flex gap-1.5">
        {levels.map((level) => {
          const selected = value === level;
          return (
            <motion.button
              key={level}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${label} ${level} of 5`}
              disabled={disabled}
              onClick={() => onChange(selected ? null : level)}
              whileTap={!disabled ? { scale: 0.92 } : {}}
              className={cn(
                "flex-1 h-9 rounded-lg border text-sm font-semibold transition-all duration-150",
                selected
                  ? "bg-white/[0.12] border-white/25 text-foreground"
                  : "bg-transparent border-border text-copy-muted hover:border-white/15 hover:text-copy-secondary",
                disabled && "opacity-40 cursor-not-allowed",
              )}
            >
              {level}
            </motion.button>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-copy-muted">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}
