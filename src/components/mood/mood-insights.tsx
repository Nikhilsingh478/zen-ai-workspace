/**
 * MoodInsights — deterministic pattern observations
 * No fabricated data. Thresholds enforced per spec.
 */

import { motion } from "framer-motion";
import { Eye, TrendingUp } from "lucide-react";
import { getMoodObservations, type MoodEntry } from "@/lib/mood";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface MoodInsightsProps {
  entries: MoodEntry[];
  delay?: number;
}

export function MoodInsights({ entries, delay = 0 }: MoodInsightsProps) {
  const observations = getMoodObservations(entries);

  if (entries.length < 3) {
    return (
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay, ease: EASE }}
        className="text-[13px] text-copy-muted leading-relaxed"
      >
        Log a few more entries and patterns will start to appear here.
      </motion.p>
    );
  }

  if (!observations.length) {
    return (
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay, ease: EASE }}
        className="text-[13px] text-copy-muted leading-relaxed"
      >
        Keep logging — more entries will reveal clearer patterns.
      </motion.p>
    );
  }

  return (
    <div className="space-y-2.5">
      {observations.map((obs, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: delay + i * 0.07, ease: EASE }}
          className="flex items-start gap-2.5"
        >
          <div
            className="h-5 w-5 rounded-md grid place-items-center shrink-0 mt-0.5"
            style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.18)" }}
          >
            {i === 0 ? (
              <TrendingUp className="h-3 w-3 text-sky-400/70" strokeWidth={2} />
            ) : (
              <Eye className="h-3 w-3 text-sky-400/70" strokeWidth={2} />
            )}
          </div>
          <p className="text-[13px] leading-relaxed text-copy-secondary">{obs}</p>
        </motion.div>
      ))}
    </div>
  );
}
