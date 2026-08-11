import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import { Activity, ChevronRight } from "lucide-react";
import { useMood, getMoodStats, MOOD_CONFIG, type MoodEntry, type MoodEntryInput } from "@/lib/mood";
import { MoodEntryForm } from "@/components/mood/mood-entry-form";
import { MoodHistory } from "@/components/mood/mood-history";
import { MoodTrendChart } from "@/components/mood/mood-trend-chart";
import { MoodStatsRow } from "@/components/mood/mood-stats";
import { MoodInsights } from "@/components/mood/mood-insights";
import { MoodEntryDetail } from "@/components/mood/mood-entry-detail";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/mood")({
  head: () => ({
    meta: [
      { title: "Mood — AI Metrics" },
      { name: "description", content: "A private place to check in with yourself." },
    ],
  }),
  component: MoodPage,
});

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

type TimeRange = 7 | 30 | 90;

// ─── Section wrapper (matches insights.tsx pattern) ──────────────────────────

function Section({
  title,
  children,
  className,
  delay = 0,
  action,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  delay?: number;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: EASE }}
      className={cn(
        "rounded-2xl border border-white/[0.07] bg-[#18181B] p-4 md:p-5 overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-white/35">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </motion.div>
  );
}

// ─── Range selector ───────────────────────────────────────────────────────────

function RangeSelector({
  value,
  onChange,
}: {
  value: TimeRange;
  onChange: (r: TimeRange) => void;
}) {
  const options: { label: string; value: TimeRange }[] = [
    { label: "7d", value: 7 },
    { label: "30d", value: 30 },
    { label: "90d", value: 90 },
  ];
  return (
    <div
      className="flex items-center rounded-lg border border-border overflow-hidden"
      style={{ background: "rgba(255,255,255,0.02)" }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-2.5 py-1 text-[11px] font-medium transition-colors",
            value === opt.value
              ? "bg-white/10 text-foreground"
              : "text-copy-muted hover:text-copy-secondary",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MoodSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-32 rounded-2xl bg-white/[0.04] animate-pulse"
          style={{ animationDelay: `${i * 0.08}s` }}
        />
      ))}
    </div>
  );
}

// ─── Today card (logged state) ────────────────────────────────────────────────

function TodayCard({
  entry,
  onViewDetail,
}: {
  entry: MoodEntry;
  onViewDetail: (e: MoodEntry) => void;
}) {
  const cfg = MOOD_CONFIG[entry.mood];
  const timeStr = new Date(entry.createdAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="rounded-2xl border p-4 md:p-5"
      style={{
        background: cfg.accent,
        borderColor: `${cfg.color}35`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] uppercase tracking-wider font-medium text-copy-muted">
          Today&apos;s mood
        </p>
        <button
          onClick={() => onViewDetail(entry)}
          className="flex items-center gap-0.5 text-[11px] text-copy-muted hover:text-copy-secondary transition-colors"
          aria-label="View full entry"
        >
          View <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      <div className="flex items-end gap-3">
        <div>
          <p className="text-2xl font-bold tracking-tight" style={{ color: cfg.color }}>
            {cfg.label}
          </p>
          <p className="text-[13px] text-copy-muted mt-0.5">
            {entry.mood} / 5 · logged {timeStr}
          </p>
        </div>
      </div>

      {/* Optional metrics strip */}
      {(entry.stress != null || entry.energy != null || entry.focus != null || entry.sleepQuality != null) && (
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.06]">
          {entry.stress != null && (
            <span className="text-[11px] text-copy-muted">
              Stress <span className="text-copy-secondary font-medium">{entry.stress}</span>
            </span>
          )}
          {entry.energy != null && (
            <span className="text-[11px] text-copy-muted">
              Energy <span className="text-copy-secondary font-medium">{entry.energy}</span>
            </span>
          )}
          {entry.focus != null && (
            <span className="text-[11px] text-copy-muted">
              Focus <span className="text-copy-secondary font-medium">{entry.focus}</span>
            </span>
          )}
          {entry.sleepQuality != null && (
            <span className="text-[11px] text-copy-muted">
              Sleep <span className="text-copy-secondary font-medium">{entry.sleepQuality}</span>
            </span>
          )}
        </div>
      )}

      {/* Reflection preview */}
      {entry.reflection && (
        <p className="mt-3 pt-3 border-t border-white/[0.06] text-[13px] leading-relaxed text-copy-secondary line-clamp-2 italic">
          &ldquo;{entry.reflection}&rdquo;
        </p>
      )}
    </motion.div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="py-14 flex flex-col items-center text-center gap-3"
    >
      <div
        className="h-12 w-12 rounded-2xl grid place-items-center"
        style={{
          background: "rgba(56,189,248,0.07)",
          border: "1px solid rgba(56,189,248,0.12)",
        }}
      >
        <Activity className="h-5 w-5 text-sky-400/50" strokeWidth={1.75} />
      </div>
      <div className="space-y-1">
        <p className="text-[15px] font-medium text-foreground">No mood history yet</p>
        <p className="text-[13px] text-copy-muted max-w-xs leading-relaxed">
          Log a reflection whenever you feel like it.
        </p>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function MoodPage() {
  const { entries, loaded, todayEntry, add, update, remove } = useMood();
  const [range, setRange] = useState<TimeRange>(30);
  const [detailEntry, setDetailEntry] = useState<MoodEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const rangeEntries = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range);
    return entries.filter((e) => new Date(e.createdAt) >= cutoff);
  }, [entries, range]);

  const stats = useMemo(() => getMoodStats(entries, range), [entries, range]);

  const hasAnyEntries = entries.length > 0;

  const handleAdd = async (input: MoodEntryInput) => {
    await add(input);
  };

  const handleUpdate = async (id: string, input: MoodEntryInput) => {
    await update(id, input);
    setDetailOpen(false);
  };

  const handleDelete = async (id: string) => {
    await remove(id);
    setDetailOpen(false);
  };

  const handleViewDetail = (entry: MoodEntry) => {
    setDetailEntry(entry);
    setDetailOpen(true);
  };

  const handleDeleteConfirm = (entry: MoodEntry) => {
    setDetailEntry(entry);
    setDetailOpen(true);
  };

  return (
    <>
      <div className="px-4 md:px-10 py-6 md:py-10 max-w-5xl mx-auto">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="mb-8"
        >
          <h1 className="text-[28px] md:text-[34px] font-semibold tracking-tight leading-none">
            Mood
          </h1>
          <p className="mt-2 text-sm text-copy-secondary max-w-md">
            Notice how you&apos;re feeling. JARVIS will help you see patterns over time.
          </p>
        </motion.div>

        {!loaded ? (
          <MoodSkeleton />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 md:gap-5">

            {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
            <div className="space-y-4 md:space-y-5">

              {/* Today card — logged state */}
              <AnimatePresence mode="wait">
                {todayEntry ? (
                  <div key="today-logged">
                    <TodayCard entry={todayEntry} onViewDetail={handleViewDetail} />
                  </div>
                ) : (
                  /* Quick log form */
                  <motion.div
                    key="log-form"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.28, ease: EASE }}
                    className="rounded-2xl border border-border bg-[#18181B] p-4 md:p-6"
                  >
                    <h2 className="text-[15px] font-semibold mb-4">How are you feeling?</h2>
                    <MoodEntryForm onSubmit={handleAdd} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 7-day trend */}
              <Section title="7-day trend" delay={0.06}>
                <MoodTrendChart entries={entries} />
              </Section>

              {/* Insights */}
              <Section
                title="What JARVIS is noticing"
                delay={0.1}
                className="border-l-[3px] border-l-sky-400/50"
              >
                <MoodInsights entries={rangeEntries} delay={0.14} />
              </Section>
            </div>

            {/* ── RIGHT COLUMN ─────────────────────────────────────────────── */}
            <div className="space-y-4 md:space-y-5">

              {/* Stats with range selector */}
              {hasAnyEntries && (
                <Section
                  title="Averages"
                  delay={0.08}
                  action={
                    <RangeSelector value={range} onChange={setRange} />
                  }
                >
                  {stats.totalEntries > 0 ? (
                    <div className="space-y-4">
                      <MoodStatsRow stats={stats} delay={0.1} />
                      {stats.trendLabel && stats.trendLabel !== "Not enough data yet" && (
                        <p className="text-[12px] text-copy-muted">{stats.trendLabel}</p>
                      )}
                      <p className="text-[11px] text-copy-muted">
                        Based on {stats.totalEntries} {stats.totalEntries === 1 ? "entry" : "entries"}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[13px] text-copy-muted">
                      No entries in this period.
                    </p>
                  )}
                </Section>
              )}

              {/* Recent history */}
              <Section
                title="Recent"
                delay={0.12}
                action={
                  entries.length > 5 && (
                    <button
                      onClick={() => setShowHistory(!showHistory)}
                      className="text-[11px] text-copy-muted hover:text-copy-secondary transition-colors"
                    >
                      {showHistory ? "Show less" : `Show all ${entries.length}`}
                    </button>
                  )
                }
              >
                {!hasAnyEntries ? (
                  <EmptyState />
                ) : (
                  <MoodHistory
                    entries={entries}
                    onEdit={handleViewDetail}
                    onDelete={handleDeleteConfirm}
                    maxItems={showHistory ? 50 : 7}
                  />
                )}
              </Section>
            </div>
          </div>
        )}
      </div>

      {/* ── Entry detail modal ── */}
      <MoodEntryDetail
        entry={detailEntry}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
        }}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </>
  );
}
