/**
 * MoodStats — compact metric summary row
 */

import { motion } from "framer-motion";
import { type MoodStats } from "@/lib/mood";

interface MoodStatsProps {
  stats: MoodStats;
  delay?: number;
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function StatPill({
  label,
  value,
  delay,
}: {
  label: string;
  value: number | null;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: EASE }}
      className="flex flex-col items-center gap-0.5 min-w-0"
    >
      <span
        className="text-lg font-bold leading-none"
        style={{ color: value != null ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.2)" }}
      >
        {value != null ? value.toFixed(1) : "—"}
      </span>
      <span className="text-[10px] text-copy-muted uppercase tracking-wider font-medium">
        {label}
      </span>
    </motion.div>
  );
}

export function MoodStatsRow({ stats, delay = 0 }: MoodStatsProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      <StatPill label="Mood" value={stats.averageMood} delay={delay + 0.0} />
      <StatPill label="Stress" value={stats.averageStress} delay={delay + 0.06} />
      <StatPill label="Energy" value={stats.averageEnergy} delay={delay + 0.12} />
      <StatPill label="Focus" value={stats.averageFocus} delay={delay + 0.18} />
    </div>
  );
}
