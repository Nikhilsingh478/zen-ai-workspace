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
  CheckCircle2,
  ListTodo,
  Target,
  BarChart3,
  Bell,
  BellOff,
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { getInsightsData, type InsightsData } from "@/lib/usage-tracking";
import { useHorizon, formatDateKey } from "@/lib/horizon";
import { useFCMStatus } from "@/lib/fcm";
import { faviconFor } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [{ title: "Insights — AI Metrics" }],
  }),
  component: InsightsPage,
});

// ─── Custom tooltip ───────────────────────────────────────────────────────────

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
    <div className="rounded-xl border border-white/[0.09] bg-[#111113] px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.6)] text-xs">
      <p className="text-white/40 mb-1.5">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-medium mb-0.5" style={{ color: p.color }}>
          {p.name}: <span className="text-white/80">{p.value}</span>
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
  accent = "rgba(255,255,255,0.45)",
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
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className="rounded-2xl p-4 md:p-5 flex flex-col gap-3 transition-all duration-300 min-w-0"
      style={{
        background: `${accent}0d`,
        border: `1px solid ${accent}28`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = `${accent}50`;
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 32px ${accent}14`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = `${accent}28`;
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/35 uppercase tracking-widest font-medium truncate">{label}</span>
        <div
          className="h-7 w-7 rounded-lg grid place-items-center shrink-0"
          style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-lg md:text-2xl font-bold tracking-tight leading-tight truncate" style={{ color: accent }}>
          {value}
        </p>
        {sub && <p className="text-[10px] md:text-[11px] text-white/30 mt-1 truncate">{sub}</p>}
      </div>
    </motion.div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  children,
  className,
  delay = 0,
  accent,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  delay?: number;
  accent?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn("rounded-2xl border border-white/[0.07] bg-[#18181B] p-4 md:p-5 overflow-hidden", className)}
      style={accent ? { borderColor: `${accent}28`, borderLeftColor: `${accent}70`, borderLeftWidth: "3px" } : undefined}
    >
      <h2
        className="text-[11px] font-semibold uppercase tracking-widest mb-4"
        style={{ color: accent ? `${accent}` : "rgba(255,255,255,0.35)" }}
      >
        {title}
      </h2>
      {children}
    </motion.div>
  );
}

// ─── Rank row ─────────────────────────────────────────────────────────────────

function RankRow({
  rank,
  name,
  sub,
  count,
  unit,
  url,
  accent,
}: {
  rank: number;
  name: string;
  sub?: string;
  count: number;
  unit: string;
  url?: string;
  accent?: string;
}) {
  const [faviconErr, setFaviconErr] = useState(false);
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
      <span className="w-5 text-center text-xs text-white/20 font-mono shrink-0">{rank}</span>
      {url ? (
        <div className="h-7 w-7 rounded-lg bg-[#111113] border border-white/[0.06] flex items-center justify-center shrink-0 overflow-hidden">
          {faviconErr ? (
            <span className="text-[11px] font-bold text-white/30">{name.charAt(0).toUpperCase()}</span>
          ) : (
            <img src={faviconFor(url, 32)} alt="" className="h-4 w-4 object-contain" onError={() => setFaviconErr(true)} />
          )}
        </div>
      ) : (
        <div className="h-7 w-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
          <Copy className="h-3 w-3 text-white/25" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground truncate">{name}</p>
        {sub && <p className="text-[10px] text-white/25 truncate">{sub}</p>}
      </div>
      <div className="text-right shrink-0">
        <span className="text-sm font-bold" style={{ color: accent ?? "rgba(255,255,255,0.75)" }}>{count}</span>
        <span className="text-[10px] text-white/25 ml-1">{unit}</span>
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
      className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] px-5 py-4 flex items-start gap-3"
    >
      <AlertCircle className="h-4 w-4 text-amber-400/60 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-amber-400/70">One-time setup required</p>
        <p className="text-xs text-white/30 mt-1 leading-relaxed">
          Run <code className="font-mono bg-white/[0.06] px-1 rounded text-white/50">SETUP.sql</code> and{" "}
          <code className="font-mono bg-white/[0.06] px-1 rounded text-white/50">HORIZON_SETUP.sql</code> in
          your Supabase dashboard → SQL Editor to enable all features.
        </p>
      </div>
    </motion.div>
  );
}

// ─── Horizon analytics hook ───────────────────────────────────────────────────

type HorizonStats = {
  completedToday: number;
  completedThisWeek: number;
  upcomingToday: number;
  upcomingThisWeek: number;
  totalTasks: number;
  completedTotal: number;
  completionRate: number;
  priorityDist: { name: string; value: number; color: string }[];
  busiestDay: { label: string; count: number } | null;
  weeklyTrend: { label: string; completed: number; added: number }[];
  tasks: import("@/lib/horizon").HorizonTask[];
};

function useHorizonStats(): HorizonStats {
  const { tasks } = useHorizon();
  const today = new Date();
  const todayKey = formatDateKey(today);

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekStartKey = formatDateKey(weekStart);

  const completedToday = tasks.filter((t) => t.completed && t.taskDate === todayKey).length;
  const completedThisWeek = tasks.filter((t) => t.completed && t.taskDate >= weekStartKey && t.taskDate <= todayKey).length;
  const upcomingToday = tasks.filter((t) => !t.completed && t.taskDate === todayKey).length;
  const upcomingThisWeek = tasks.filter((t) => !t.completed && t.taskDate >= todayKey).length;

  const totalTasks = tasks.length;
  const completedTotal = tasks.filter((t) => t.completed).length;
  const completionRate = totalTasks === 0 ? 0 : Math.round((completedTotal / totalTasks) * 100);

  const priorityMap: Record<string, number> = { low: 0, medium: 0, high: 0 };
  tasks.forEach((t) => { priorityMap[t.priority] = (priorityMap[t.priority] ?? 0) + 1; });
  const priorityDist = [
    { name: "Low",    value: priorityMap.low,    color: "#60A5FA" },
    { name: "Medium", value: priorityMap.medium, color: "#FBBF24" },
    { name: "High",   value: priorityMap.high,   color: "#F87171" },
  ];

  const dowCounts = [0, 0, 0, 0, 0, 0, 0];
  tasks.forEach((t) => {
    const [y, m, d] = t.taskDate.split("-").map(Number);
    dowCounts[new Date(y, m - 1, d).getDay()]++;
  });
  const dowLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let busiestIdx = 0;
  for (let i = 1; i < 7; i++) if (dowCounts[i] > dowCounts[busiestIdx]) busiestIdx = i;
  const busiestDay = dowCounts[busiestIdx] > 0 ? { label: dowLabels[busiestIdx], count: dowCounts[busiestIdx] } : null;

  const weeklyTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const key = formatDateKey(d);
    const label = i === 6 ? "Today" : i === 5 ? "Yest" : dowLabels[d.getDay()];
    return {
      label,
      completed: tasks.filter((t) => t.completed && t.taskDate === key).length,
      added: tasks.filter((t) => t.taskDate === key).length,
    };
  });

  return { completedToday, completedThisWeek, upcomingToday, upcomingThisWeek, totalTasks, completedTotal, completionRate, priorityDist, busiestDay, weeklyTrend, tasks };
}

// ─── Main page ────────────────────────────────────────────────────────────────

function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const horizon = useHorizonStats();
  const notifStatus = useFCMStatus();

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
    <div className="px-4 md:px-10 py-6 md:py-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-7">
        <div className="min-w-0">
          <h1 className="text-xl md:text-3xl font-semibold tracking-tight">Insights</h1>
          <p className="text-xs md:text-sm text-white/35 mt-1">
            How you use AI and track your work
            {lastRefreshed && (
              <span className="ml-2 text-white/20 hidden sm:inline">· updated {formatTime(lastRefreshed)}</span>
            )}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 text-xs text-white/25 hover:text-white/60 transition px-3 py-2 rounded-xl hover:bg-white/[0.04] shrink-0"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {!d.tablesExist && <SetupBanner />}

      {/* ── Horizon section header ─────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="h-5 w-5 rounded-lg grid place-items-center" style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.2)" }}>
          <Target className="h-2.5 w-2.5" style={{ color: "#34D399" }} />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#34D399" }}>Horizon — Task Analytics</span>
      </div>

      {/* ── Horizon key metrics ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-3 mb-3">
        <MetricCard label="Done Today"       value={horizon.completedToday}            sub="tasks completed"                      icon={CheckCircle2} delay={0}    accent="#34D399" />
        <MetricCard label="Done This Week"   value={horizon.completedThisWeek}         sub="since Sunday"                         icon={CheckCircle2} delay={0.05} accent="#34D399" />
        <MetricCard label="Pending Today"    value={horizon.upcomingToday}             sub="tasks remaining"                      icon={ListTodo}     delay={0.1}  accent="#FBBF24" />
        <MetricCard label="Completion Rate"  value={`${horizon.completionRate}%`}      sub={`${horizon.completedTotal} of ${horizon.totalTasks} total`} icon={Target} delay={0.15} accent="#0EA5E9" />
      </div>

      {/* ── Horizon charts row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
        {/* Weekly trend */}
        <Section title="Task Trend — Last 7 Days" className="lg:col-span-2" delay={0.18} accent="#0EA5E9">
          {horizon.totalTasks === 0 ? (
            <div className="flex items-center justify-center h-40 text-white/20 text-sm">No tasks yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={horizon.weeklyTrend} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }} />
                <Bar dataKey="added"     name="Scheduled" fill="rgba(14,165,233,0.45)"  radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Bar dataKey="completed" name="Completed"  fill="rgba(52,211,153,0.75)"  radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        {/* Priority distribution */}
        <Section title="Priority Distribution" delay={0.2} accent="#FBBF24">
          {horizon.totalTasks === 0 ? (
            <div className="flex items-center justify-center h-40 text-white/20 text-sm">No tasks yet</div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie
                    data={horizon.priorityDist}
                    cx="50%"
                    cy="50%"
                    innerRadius={32}
                    outerRadius={52}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {horizon.priorityDist.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 text-xs">
                {horizon.priorityDist.map((p) => (
                  <div key={p.name} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                    <span className="text-white/40">{p.name}</span>
                    <span className="font-bold" style={{ color: p.color }}>{p.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>
      </div>

      {/* ── Additional Horizon stats ────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 mb-8">
        <MetricCard label="Upcoming"     value={horizon.upcomingThisWeek}          sub="tasks this week & beyond"    icon={Calendar}  delay={0.22} accent="#A78BFA" />
        <MetricCard label="Total Tasks"  value={horizon.totalTasks}                sub="all time"                    icon={BarChart3} delay={0.24} accent="#0EA5E9" />
        <MetricCard
          label="Busiest Day"
          value={horizon.busiestDay?.label ?? "—"}
          sub={horizon.busiestDay ? `${horizon.busiestDay.count} tasks` : "No data yet"}
          icon={Calendar}
          delay={0.26}
          accent="#F97316"
        />
      </div>

      {/* ── Notifications section header ─────────────────────────────────── */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="h-5 w-5 rounded-lg grid place-items-center" style={{ background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.2)" }}>
          <Bell className="h-2.5 w-2.5" style={{ color: "#38BDF8" }} />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#38BDF8" }}>Reminders & Notifications</span>
      </div>

      {/* ── Notification metrics ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-3 mb-8">
        <MetricCard
          label="Reminders Set"
          value={horizon.tasks.filter((t) => t.notificationEnabled).length}
          sub="tasks with reminders on"
          icon={Bell}
          delay={0.27}
          accent="#38BDF8"
        />
        <MetricCard
          label="Coverage"
          value={
            horizon.totalTasks === 0
              ? "—"
              : `${Math.round((horizon.tasks.filter((t) => t.notificationEnabled).length / horizon.totalTasks) * 100)}%`
          }
          sub="tasks opted into reminders"
          icon={Target}
          delay={0.28}
          accent="#818CF8"
        />

        {/* Permission status */}
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, delay: 0.29, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ y: -2, transition: { duration: 0.15 } }}
          className="rounded-2xl p-4 md:p-5 flex flex-col gap-3 transition-all duration-300"
          style={{
            background: notifStatus === "granted" ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.06)",
            border: `1px solid ${notifStatus === "granted" ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.2)"}`,
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/35 uppercase tracking-widest font-medium">Permission</span>
            <div
              className="h-7 w-7 rounded-lg grid place-items-center shrink-0"
              style={{
                background: notifStatus === "granted" ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.12)",
                border: `1px solid ${notifStatus === "granted" ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.2)"}`,
              }}
            >
              {notifStatus === "granted" ? (
                <Bell className="h-3.5 w-3.5" style={{ color: "#34D399" }} />
              ) : (
                <BellOff className="h-3.5 w-3.5" style={{ color: "#F87171" }} />
              )}
            </div>
          </div>
          <div>
            <p
              className="text-lg md:text-2xl font-bold tracking-tight leading-tight capitalize"
              style={{ color: notifStatus === "granted" ? "#34D399" : "#F87171" }}
            >
              {notifStatus === "granted" ? "Active" :
               notifStatus === "denied" ? "Blocked" :
               notifStatus === "default" ? "Not set" :
               notifStatus === "unconfigured" ? "Not configured" : "Unsupported"}
            </p>
            <p className="text-[10px] md:text-[11px] text-white/30 mt-1">
              {notifStatus === "granted" ? "Push notifications enabled" :
               notifStatus === "denied" ? "Enable in browser settings" :
               notifStatus === "default" ? "Enable a reminder to prompt" :
               "Browser push not available"}
            </p>
          </div>
        </motion.div>

        <MetricCard
          label="Reminded & Done"
          value={horizon.tasks.filter((t) => t.notificationEnabled && t.completed).length}
          sub="completed reminder tasks"
          icon={CheckCircle2}
          delay={0.3}
          accent="#34D399"
        />
      </div>

      {/* ── AI usage section header ──────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="h-5 w-5 rounded-lg grid place-items-center" style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.2)" }}>
          <ExternalLink className="h-2.5 w-2.5" style={{ color: "#A78BFA" }} />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#A78BFA" }}>AI Tool Usage</span>
      </div>

      {/* ── Tool usage key metrics ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-3 mb-3">
        <MetricCard label="Opens Today"  value={d.todayOpens}  sub="tool launches"   icon={ExternalLink} delay={0.28} accent="#38BDF8" />
        <MetricCard label="Copies Today" value={d.todayCopies} sub="prompt copies"   icon={Copy}         delay={0.3}  accent="#A78BFA" />
        <MetricCard
          label="Streak"
          value={d.streakDays > 0 ? `${d.streakDays}d` : "—"}
          sub={d.streakDays > 0 ? "consecutive active days" : "Start today"}
          icon={Flame}
          delay={0.32}
          accent="#F97316"
        />
        <MetricCard
          label="Week vs Last"
          value={`${d.weekOverWeek.deltaPct >= 0 ? "+" : ""}${d.weekOverWeek.deltaPct}%`}
          sub={`${d.weekOverWeek.thisWeek} vs ${d.weekOverWeek.lastWeek} events`}
          icon={d.weekOverWeek.deltaPct >= 0 ? TrendingUp : TrendingDown}
          delay={0.34}
          accent={d.weekOverWeek.deltaPct >= 0 ? "#34D399" : "#F87171"}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-3 mb-5">
        <MetricCard label="Top Tool"   value={d.mostUsedTool?.name ?? "—"}      sub={d.mostUsedTool   ? `${d.mostUsedTool.count} opens`   : "No data yet"} icon={TrendingUp} delay={0.36} accent="#38BDF8" />
        <MetricCard label="Top Prompt" value={d.mostUsedPrompt?.title ?? "—"}   sub={d.mostUsedPrompt ? `${d.mostUsedPrompt.count} copies` : "No data yet"} icon={Brain}      delay={0.38} accent="#A78BFA" />
        <MetricCard label="Avg / Day"  value={d.avgPerDay}                       sub="events per day (7d)"                                                   icon={Calendar}   delay={0.4}  accent="#FBBF24" />
        <MetricCard
          label="Busiest Day"
          value={d.busiestDayOfWeek?.name ?? "—"}
          sub={d.busiestDayOfWeek ? `${d.busiestDayOfWeek.count} events` : "No data yet"}
          icon={Clock}
          delay={0.42}
          accent="#F97316"
        />
      </div>

      {/* ── Charts: top tools + usage over time ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <Section title="Top Tools" delay={0.44} accent="#38BDF8">
          {d.topTools.length === 0 ? (
            <p className="text-sm text-white/20 py-4 text-center">No tool opens tracked yet</p>
          ) : (
            d.topTools.map((tool, i) => (
              <RankRow key={tool.id} rank={i + 1} name={tool.name} url={tool.url} count={tool.count} unit="opens" accent="#38BDF8" />
            ))
          )}
        </Section>

        <Section title="Usage — Last 7 Days" delay={0.46} accent="#A78BFA">
          {d.usageByDay.every((d) => d.tools === 0 && d.prompts === 0) ? (
            <div className="flex items-center justify-center h-48 text-white/20 text-sm">No activity yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={d.usageByDay} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }} />
                <Line type="monotone" dataKey="tools"   name="Tools"   stroke="#38BDF8" strokeWidth={2} dot={{ r: 3, fill: "#38BDF8" }}   activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="prompts" name="Prompts" stroke="#A78BFA" strokeWidth={2} dot={{ r: 3, fill: "#A78BFA" }}   activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>

      {/* ── Top prompts + daily activity ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <Section title="Top Prompts" delay={0.48} accent="#A78BFA">
          {d.topPrompts.length === 0 ? (
            <p className="text-sm text-white/20 py-4 text-center">No prompt copies tracked yet</p>
          ) : (
            d.topPrompts.map((p, i) => (
              <RankRow key={p.id} rank={i + 1} name={p.title} sub={`Last copied ${new Date(p.lastUsed).toLocaleDateString()}`} count={p.count} unit="copies" accent="#A78BFA" />
            ))
          )}
        </Section>

        <Section title="Daily Activity" delay={0.5} accent="#38BDF8">
          {d.usageByDay.every((d) => d.tools === 0 && d.prompts === 0) ? (
            <div className="flex items-center justify-center h-48 text-white/20 text-sm">No activity yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={d.usageByDay} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }} />
                <Bar dataKey="tools"   name="Tools"   fill="rgba(56,189,248,0.55)"   radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Bar dataKey="prompts" name="Prompts" fill="rgba(167,139,250,0.45)"  radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>

      {/* ── Hour of day distribution ─────────────────────────────────────── */}
      <Section title="Hour of Day — Last 30 Days" className="mb-3" delay={0.52} accent="#FBBF24">
        {d.hourlyDistribution.every((h) => h.count === 0) ? (
          <div className="flex items-center justify-center h-40 text-white/20 text-sm">
            <Clock className="h-4 w-4 mr-2" /> No activity yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={d.hourlyDistribution} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" name="Events" fill="rgba(251,191,36,0.5)" radius={[3, 3, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Section>

      {/* ── AI Insights ──────────────────────────────────────────────────── */}
      <Section title="AI Insights" className="mb-3" delay={0.54} accent="#34D399">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {d.aiInsights.map((insight, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border px-4 py-3" style={{ background: "rgba(52,211,153,0.04)", borderColor: "rgba(52,211,153,0.12)" }}>
              <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "#34D399" }} />
              <p className="text-[13px] text-white/55 leading-relaxed">{insight}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Recent activity feed ─────────────────────────────────────────── */}
      {d.recentLogs.length > 0 && (
        <Section title="Recent Activity" delay={0.56}>
          <div className="space-y-0">
            {d.recentLogs.slice(0, 10).map((log, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
                <div
                  className="h-5 w-5 rounded-md grid place-items-center shrink-0"
                  style={{
                    background: log.type === "tool" ? "rgba(56,189,248,0.1)" : "rgba(167,139,250,0.1)",
                    border: `1px solid ${log.type === "tool" ? "rgba(56,189,248,0.2)" : "rgba(167,139,250,0.2)"}`,
                  }}
                >
                  {log.type === "tool" ? (
                    <ExternalLink className="h-2.5 w-2.5" style={{ color: "#38BDF8" }} />
                  ) : (
                    <Copy className="h-2.5 w-2.5" style={{ color: "#A78BFA" }} />
                  )}
                </div>
                <p className="text-[12px] text-white/40 flex-1 truncate">
                  <span className="text-white/70 font-medium">{log.item_name}</span>
                  <span className="text-white/20 mx-1">·</span>
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
      )}

      <div className="mt-6 text-center text-[11px] text-white/15 pb-4">
        {d.weekEvents} AI events tracked this week · auto-refreshes every 30s
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function InsightsSkeleton() {
  return (
    <div className="px-4 md:px-10 py-10 max-w-7xl mx-auto animate-pulse">
      <div className="h-8 w-40 rounded-xl bg-white/[0.05] mb-3" />
      <div className="h-4 w-64 rounded-lg bg-white/[0.03] mb-8" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-white/[0.04]" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="h-64 rounded-2xl bg-white/[0.04]" />
        <div className="h-64 rounded-2xl bg-white/[0.04]" />
      </div>
    </div>
  );
}
