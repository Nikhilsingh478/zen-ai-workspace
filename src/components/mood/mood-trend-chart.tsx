/**
 * MoodTrendChart — 7-day mood visualization
 * Gaps preserved for missing days. Uses existing Recharts patterns.
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import { getMoodTrend, MOOD_CONFIG, type MoodEntry } from "@/lib/mood";

interface MoodTrendChartProps {
  entries: MoodEntry[];
}

function MoodTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length || payload[0].value == null) return null;
  const val = payload[0].value;
  const level = Math.round(val) as 1 | 2 | 3 | 4 | 5;
  const cfg = MOOD_CONFIG[Math.max(1, Math.min(5, level)) as 1 | 2 | 3 | 4 | 5];
  return (
    <div className="rounded-xl border border-white/[0.09] bg-[#111113] px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.6)] text-xs">
      <p className="text-white/40 mb-1">{label}</p>
      <p className="font-semibold" style={{ color: cfg.color }}>
        {val.toFixed(1)} — {cfg.label}
      </p>
    </div>
  );
}

export function MoodTrendChart({ entries }: MoodTrendChartProps) {
  const data = getMoodTrend(entries);
  const hasData = data.some((d) => d.mood !== null);

  if (!hasData) {
    return (
      <div className="h-[120px] flex items-center justify-center text-[13px] text-copy-muted">
        Log a few entries to see your trend.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={data} margin={{ top: 8, right: 4, left: -28, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.04)"
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[1, 5]}
          ticks={[1, 2, 3, 4, 5]}
          tick={{ fill: "rgba(255,255,255,0.18)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<MoodTooltip />} />
        <Line
          type="monotone"
          dataKey="mood"
          stroke="#38BDF8"
          strokeWidth={2}
          dot={{ fill: "#38BDF8", r: 3, strokeWidth: 0 }}
          activeDot={{ fill: "#38BDF8", r: 5, strokeWidth: 0 }}
          connectNulls={false} // preserve gaps — no fake interpolation
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
