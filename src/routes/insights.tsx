import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ExternalLink,
  Brain,
  Copy,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  Lightbulb,
  Flame,
  Calendar,
  Clock,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { getInsightsData, type InsightsData } from "@/lib/usage-tracking";
import { faviconFor } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [{ title: "Insights — AI Metrics" }],
  }),
  component: InsightsPage,
});

// ─── Custom chart tooltip ─────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#18181B] px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.5)] text-xs">
      <p className="text-white/50 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  delay,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  delay: number;
  accent?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className="rounded-2xl border border-white/[0.07] bg-[#18181B] p-3.5 md:p-5 flex flex-col gap-2.5 md:gap-3 hover:border-white/[0.13] hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)] transition-all duration-300 min-w-0"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] md:text-xs text-white/40 uppercase tracking-widest font-medium truncate">{label}</span>
        <div
          className={cn(
            "h-7 w-7 rounded-lg grid place-items-center",
            accent ?? "bg-white/[0.06]",
          )}
        >
          <Icon className="h-3.5 w-3.5 text-white/60" />
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-lg md:text-2xl font-semibold tracking-tight text-foreground leading-tight truncate">{value}</p>
        {sub && <p className="text-[10px] md:text-[11px] text-white/35 mt-1 md:mt-1.5 truncate">{sub}</p>}
      </div>
    </motion.div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-white/[0.07] bg-[#18181B] p-3.5 md:p-5", className)}>
      <h2 className="text-[12px] md:text-[13px] font-semibold tracking-tight text-white/70 uppercase tracking-widest mb-3 md:mb-4">
        {title}
      </h2>
      {children}
    </div>
  );
}

// ─── Top tool / prompt row ────────────────────────────────────────────────────

function RankRow({
  rank,
  name,
  sub,
  count,
  unit,
  url,
}: {
  rank: number;
  name: string;
  sub?: string;
  count: number;
  unit: string;
  url?: string;
}) {
  const [faviconErr, setFaviconErr] = useState(false);
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
      <span className="w-5 text-center text-xs text-white/20 font-mono shrink-0">{rank}</span>
      {url && (
        <div className="h-7 w-7 rounded-lg bg-[#111113] border border-white/[0.06] flex items-center justify-center shrink-0 overflow-hidden">
          {faviconErr ? (
            <span className="text-[11px] font-bold text-white/40">
              {name.charAt(0).toUpperCase()}
            </span>
          ) : (
            <img
              src={faviconFor(url, 32)}
              alt=""
              className="h-4 w-4 object-contain"
              onError={() => setFaviconErr(true)}
            />
          )}
        </div>
      )}
      {!url && (
        <div className="h-7 w-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
          <Copy className="h-3 w-3 text-white/30" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground truncate">{name}</p>
        {sub && <p className="text-[10px] text-white/30 truncate">{sub}</p>}
      </div>
      <div className="text-right shrink-0">
        <span className="text-sm font-semibold text-foreground">{count}</span>
        <span className="text-[10px] text-white/30 ml-1">{unit}</span>
      </div>
    </div>
  );
}

// ─── Setup banner ─────────────────────────────────────────────────────────────

function SetupBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-5 py-4 flex items-start gap-3"
    >
      <AlertCircle className="h-4 w-4 text-amber-400/80 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-amber-200/80">One-time setup required</p>
        <p className="text-xs text-amber-200/50 mt-1 leading-relaxed">
          Run <code className="font-mono bg-white/[0.06] px-1 rounded text-amber-200/70">SETUP.sql</code> in your
          Supabase dashboard → SQL Editor to enable usage tracking. Until then, the Insights tab shows demo state.
        </p>
      </div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const result = await getInsightsData();
      setData(result);
      setLastRefreshed(new Date());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  if (loading) return <InsightsSkeleton />;

  const d = data!;

  return (
    <div className="px-4 md:px-12 py-6 md:py-14 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6 md:mb-8">
        <div className="min-w-0">
          <h1 className="text-xl md:text-3xl font-semibold tracking-tight text-foreground">
            Insights
          </h1>
          <p className="text-xs md:text-sm text-white/40 mt-1 truncate">
            How you actually use AI
            {lastRefreshed && (
              <span className="ml-2 text-white/20 hidden sm:inline">· updated {formatTime(lastRefreshed)}</span>
            )}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 text-xs text-white/30 hover:text-white/60 transition px-2.5 md:px-3 py-2 rounded-xl hover:bg-white/[0.04] shrink-0"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {!d.tablesExist && <SetupBanner />}

      {/* ── Section 1: Key Metrics ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-3 mb-4 md:mb-6">
        <MetricCard
          label="Opens Today"
          value={d.todayOpens}
          sub="tool launches"
          icon={ExternalLink}
          delay={0}
        />
        <MetricCard
          label="Copies Today"
          value={d.todayCopies}
          sub="prompt copies"
          icon={Copy}
          delay={0.05}
        />
        <MetricCard
          label="Top Tool"
          value={d.mostUsedTool?.name ?? "—"}
          sub={d.mostUsedTool ? `${d.mostUsedTool.count} opens` : "No data yet"}
          icon={TrendingUp}
          delay={0.1}
          accent="bg-emerald-400/10"
        />
        <MetricCard
          label="Top Prompt"
          value={d.mostUsedPrompt?.title ?? "—"}
          sub={d.mostUsedPrompt ? `${d.mostUsedPrompt.count} copies` : "No data yet"}
          icon={Brain}
          delay={0.15}
          accent="bg-purple-400/10"
        />
      </div>

      {/* ── Section 1b: Advanced Metrics ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-3 mb-4 md:mb-6">
        <MetricCard
          label="Streak"
          value={d.streakDays > 0 ? `${d.streakDays}d` : "—"}
          sub={d.streakDays > 0 ? "consecutive active days" : "Start today"}
          icon={Flame}
          delay={0.18}
          accent="bg-orange-400/10"
        />
        <MetricCard
          label="Avg / Day"
          value={d.avgPerDay}
          sub="events per day (7d)"
          icon={Calendar}
          delay={0.2}
        />
        <MetricCard
          label="Busiest Day"
          value={d.busiestDayOfWeek?.name ?? "—"}
          sub={d.busiestDayOfWeek ? `${d.busiestDayOfWeek.count} events (30d)` : "No data yet"}
          icon={Calendar}
          delay={0.22}
          accent="bg-cyan-400/10"
        />
        <MetricCard
          label="Week vs Last"
          value={`${d.weekOverWeek.deltaPct >= 0 ? "+" : ""}${d.weekOverWeek.deltaPct}%`}
          sub={`${d.weekOverWeek.thisWeek} vs ${d.weekOverWeek.lastWeek} events`}
          icon={d.weekOverWeek.deltaPct >= 0 ? TrendingUp : TrendingDown}
          delay={0.24}
          accent={d.weekOverWeek.deltaPct >= 0 ? "bg-emerald-400/10" : "bg-red-400/10"}
        />
      </div>

      {/* ── Section 2: Top Tools + Usage Over Time ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 mb-3 md:mb-4">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          <Section title="Top Tools">
            {d.topTools.length === 0 ? (
              <p className="text-sm text-white/25 py-4 text-center">
                No tool opens tracked yet
              </p>
            ) : (
              d.topTools.map((tool, i) => (
                <RankRow
                  key={tool.id}
                  rank={i + 1}
                  name={tool.name}
                  url={tool.url}
                  count={tool.count}
                  unit="opens"
                />
              ))
            )}
          </Section>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <Section title="Usage — Last 7 Days">
            {d.usageByDay.every((d) => d.tools === 0 && d.prompts === 0) ? (
              <div className="flex items-center justify-center h-48 text-white/20 text-sm">
                No activity yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={d.usageByDay} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={6}
                    wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="tools"
                    name="Tools"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#60a5fa" }}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="prompts"
                    name="Prompts"
                    stroke="#a78bfa"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#a78bfa" }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Section>
        </motion.div>
      </div>

      {/* ── Section 3: Top Prompts + Activity Bar Chart ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 mb-3 md:mb-4">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.26, ease: [0.22, 1, 0.36, 1] }}
        >
          <Section title="Top Prompts">
            {d.topPrompts.length === 0 ? (
              <p className="text-sm text-white/25 py-4 text-center">
                No prompt copies tracked yet
              </p>
            ) : (
              d.topPrompts.map((p, i) => (
                <RankRow
                  key={p.id}
                  rank={i + 1}
                  name={p.title}
                  sub={`Last copied ${new Date(p.lastUsed).toLocaleDateString()}`}
                  count={p.count}
                  unit="copies"
                />
              ))
            )}
          </Section>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <Section title="Daily Activity">
            {d.usageByDay.every((d) => d.tools === 0 && d.prompts === 0) ? (
              <div className="flex items-center justify-center h-48 text-white/20 text-sm">
                No activity yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={d.usageByDay} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={6}
                    wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}
                  />
                  <Bar dataKey="tools" name="Tools" fill="#60a5fa" radius={[3, 3, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="prompts" name="Prompts" fill="#a78bfa" radius={[3, 3, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Section>
        </motion.div>
      </div>

      {/* ── Section 3b: Hour-of-day distribution ──────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <Section title="Hour of Day — Last 30 Days" className="mb-3 md:mb-4">
          {d.hourlyDistribution.every((h) => h.count === 0) ? (
            <div className="flex items-center justify-center h-40 text-white/20 text-sm">
              <Clock className="h-4 w-4 mr-2" /> No activity yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={d.hourlyDistribution} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={2}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Events" fill="#34d399" radius={[3, 3, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>
      </motion.div>

      {/* ── Section 4: AI Insights ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.34, ease: [0.22, 1, 0.36, 1] }}
      >
        <Section title="AI Insights" className="mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {d.aiInsights.map((insight, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl bg-white/[0.03] border border-white/[0.05] px-4 py-3"
              >
                <Lightbulb className="h-4 w-4 text-amber-400/60 shrink-0 mt-0.5" />
                <p className="text-[13px] text-white/60 leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
        </Section>
      </motion.div>

      {/* ── Section 5: Recent Activity Feed ────────────────────────────────── */}
      {d.recentLogs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.38, ease: [0.22, 1, 0.36, 1] }}
        >
          <Section title="Recent Activity">
            <div className="space-y-0">
              {d.recentLogs.slice(0, 10).map((log, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0"
                >
                  <div
                    className={cn(
                      "h-5 w-5 rounded-md grid place-items-center shrink-0",
                      log.type === "tool" ? "bg-blue-400/10" : "bg-purple-400/10",
                    )}
                  >
                    {log.type === "tool" ? (
                      <ExternalLink className="h-3 w-3 text-blue-400/60" />
                    ) : (
                      <Copy className="h-3 w-3 text-purple-400/60" />
                    )}
                  </div>
                  <p className="text-[12px] text-white/50 flex-1 truncate">
                    <span className="text-white/70 font-medium">{log.item_name}</span>
                    <span className="text-white/25 mx-1">·</span>
                    {log.action === "open" ? "opened" : "copied"}
                  </p>
                  <span className="text-[10px] text-white/20 shrink-0">
                    {new Date(log.timestamp).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </motion.div>
      )}

      {/* Weekly summary footer */}
      <div className="mt-6 text-center text-[11px] text-white/20">
        {d.weekEvents} events tracked in the last 7 days · auto-refreshes every 30s
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function InsightsSkeleton() {
  return (
    <div className="px-6 md:px-12 py-10 md:py-14 max-w-7xl mx-auto animate-pulse">
      <div className="h-8 w-32 bg-white/[0.06] rounded-xl mb-2" />
      <div className="h-4 w-48 bg-white/[0.04] rounded-lg mb-8" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-white/[0.04]" style={{ animationDelay: `${i * 0.05}s` }} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="h-64 rounded-2xl bg-white/[0.04]" />
        <div className="h-64 rounded-2xl bg-white/[0.04]" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-64 rounded-2xl bg-white/[0.04]" />
        <div className="h-64 rounded-2xl bg-white/[0.04]" />
      </div>
    </div>
  );
}
