import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

export type UsageLog = {
  id: string;
  item_id: string;
  item_name: string;
  item_url: string | null;
  type: "tool" | "prompt";
  action: "open" | "copy";
  timestamp: string;
};

export type InsightsData = {
  tablesExist: boolean;
  todayOpens: number;
  todayCopies: number;
  weekEvents: number;
  mostUsedTool: { name: string; url: string; count: number } | null;
  mostUsedPrompt: { title: string; count: number } | null;
  topTools: Array<{ id: string; name: string; url: string; count: number }>;
  topPrompts: Array<{ id: string; title: string; count: number; lastUsed: string }>;
  usageByDay: Array<{ day: string; label: string; tools: number; prompts: number }>;
  recentLogs: UsageLog[];
  aiInsights: string[];
  streakDays: number;
  avgPerDay: number;
  busiestDayOfWeek: { name: string; count: number } | null;
  hourlyDistribution: Array<{ hour: number; label: string; count: number }>;
  weekOverWeek: { thisWeek: number; lastWeek: number; deltaPct: number };
};

// ─── Fire-and-forget log helpers ─────────────────────────────────────────────

export function logToolOpen(itemId: string, itemName: string, itemUrl: string): void {
  supabase
    .from("usage_logs")
    .insert({
      item_id: itemId,
      item_name: itemName,
      item_url: itemUrl,
      type: "tool",
      action: "open",
      timestamp: new Date().toISOString(),
    })
    .then(({ error }) => {
      if (error) console.debug("[usage] log skipped (table may not exist):", error.message);
    });
}

export function logPromptCopy(itemId: string, title: string): void {
  supabase
    .from("usage_logs")
    .insert({
      item_id: itemId,
      item_name: title,
      item_url: null,
      type: "prompt",
      action: "copy",
      timestamp: new Date().toISOString(),
    })
    .then(({ error }) => {
      if (error) console.debug("[usage] log skipped (table may not exist):", error.message);
    });
}

// ─── Data fetching ────────────────────────────────────────────────────────────

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function getLast7Days(): Array<{ date: string; label: string }> {
  const days: Array<{ date: string; label: string }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const label = i === 0 ? "Today" : i === 1 ? "Yesterday" : formatDayLabel(dateStr);
    days.push({ date: dateStr, label });
  }
  return days;
}

function groupBy<T extends Record<string, unknown>>(
  arr: T[],
  key: keyof T,
): Record<string, T[]> {
  return arr.reduce(
    (acc, item) => {
      const k = String(item[key]);
      if (!acc[k]) acc[k] = [];
      acc[k].push(item);
      return acc;
    },
    {} as Record<string, T[]>,
  );
}

function generateAiInsights(
  logs: UsageLog[],
  topTools: InsightsData["topTools"],
  topPrompts: InsightsData["topPrompts"],
): string[] {
  const insights: string[] = [];

  if (topTools[0]) {
    insights.push(`Your most-launched tool is ${topTools[0].name} — opened ${topTools[0].count} time${topTools[0].count === 1 ? "" : "s"}.`);
  }

  if (topPrompts[0]) {
    insights.push(`You copy "${topPrompts[0].title}" most frequently — ${topPrompts[0].count} time${topPrompts[0].count === 1 ? "" : "s"}.`);
  }

  // Peak usage hour
  const toolLogs = logs.filter((l) => l.type === "tool" && l.action === "open");
  if (toolLogs.length >= 3) {
    const hourCounts: Record<number, number> = {};
    for (const log of toolLogs) {
      const h = new Date(log.timestamp).getHours();
      hourCounts[h] = (hourCounts[h] ?? 0) + 1;
    }
    const peakHour = Number(
      Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0],
    );
    if (!isNaN(peakHour)) {
      const label =
        peakHour < 12
          ? `${peakHour === 0 ? 12 : peakHour} AM`
          : peakHour === 12
            ? "12 PM"
            : `${peakHour - 12} PM`;
      insights.push(`Your peak usage time is around ${label}.`);
    }
  }

  // Days active this week
  const last7Dates = getLast7Days().map((d) => d.date);
  const activeDates = new Set(logs.map((l) => l.timestamp.slice(0, 10)));
  const activeDaysThisWeek = last7Dates.filter((d) => activeDates.has(d)).length;
  if (activeDaysThisWeek > 0) {
    insights.push(
      activeDaysThisWeek === 7
        ? "You've been active every day this week."
        : `You've used AI tools ${activeDaysThisWeek} out of the last 7 days.`,
    );
  }

  if (topTools.length >= 2) {
    const ratio = topTools[0].count / topTools[1].count;
    if (ratio >= 2) {
      insights.push(
        `You rely heavily on ${topTools[0].name} — it's used ${Math.round(ratio)}× more than your next tool.`,
      );
    }
  }

  if (insights.length === 0) {
    insights.push("Start using your tools and prompts — insights will appear here automatically.");
  }

  return insights;
}

export async function getInsightsData(): Promise<InsightsData> {
  const empty: InsightsData = {
    tablesExist: false,
    todayOpens: 0,
    todayCopies: 0,
    weekEvents: 0,
    mostUsedTool: null,
    mostUsedPrompt: null,
    topTools: [],
    topPrompts: [],
    usageByDay: getLast7Days().map((d) => ({ day: d.date, label: d.label, tools: 0, prompts: 0 })),
    recentLogs: [],
    aiInsights: ["Start using your tools and prompts — insights will appear here automatically."],
    streakDays: 0,
    avgPerDay: 0,
    busiestDayOfWeek: null,
    hourlyDistribution: Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      label: h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`,
      count: 0,
    })),
    weekOverWeek: { thisWeek: 0, lastWeek: 0, deltaPct: 0 },
  };

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: logs, error } = await supabase
    .from("usage_logs")
    .select("*")
    .gte("timestamp", thirtyDaysAgo)
    .order("timestamp", { ascending: false })
    .limit(2000);

  if (error) {
    // Table doesn't exist yet — return empty gracefully
    return empty;
  }

  const typedLogs = (logs ?? []) as UsageLog[];
  const today = new Date().toISOString().slice(0, 10);

  const todayLogs = typedLogs.filter((l) => l.timestamp.startsWith(today));
  const todayOpens = todayLogs.filter((l) => l.action === "open").length;
  const todayCopies = todayLogs.filter((l) => l.action === "copy").length;
  const weekEvents = typedLogs.filter((l) => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    return l.timestamp >= weekAgo;
  }).length;

  // ── Top Tools ──────────────────────────────────────────────────────────────
  const toolLogs = typedLogs.filter((l) => l.type === "tool");
  const toolGroups = groupBy(toolLogs, "item_id");
  const topTools = Object.entries(toolGroups)
    .map(([id, events]) => ({
      id,
      name: events[0].item_name,
      url: events[0].item_url ?? "",
      count: events.length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ── Top Prompts ────────────────────────────────────────────────────────────
  const promptLogs = typedLogs.filter((l) => l.type === "prompt");
  const promptGroups = groupBy(promptLogs, "item_id");
  const topPrompts = Object.entries(promptGroups)
    .map(([id, events]) => ({
      id,
      title: events[0].item_name,
      count: events.length,
      lastUsed: events[0].timestamp,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ── Usage By Day (last 7) ──────────────────────────────────────────────────
  const last7 = getLast7Days();
  const usageByDay = last7.map(({ date, label }) => ({
    day: date,
    label,
    tools: toolLogs.filter((l) => l.timestamp.startsWith(date)).length,
    prompts: promptLogs.filter((l) => l.timestamp.startsWith(date)).length,
  }));

  // ── AI Insights ────────────────────────────────────────────────────────────
  const aiInsights = generateAiInsights(typedLogs, topTools, topPrompts);

  // ── Streak (consecutive days ending today with activity) ──
  const activeDateSet = new Set(typedLogs.map((l) => l.timestamp.slice(0, 10)));
  let streakDays = 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    if (activeDateSet.has(ds)) streakDays++;
    else break;
  }

  // ── Avg events / day over last 7 days ──
  const avgPerDay = Math.round((weekEvents / 7) * 10) / 10;

  // ── Busiest day of week (last 30 days) ──
  const dowCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const log of typedLogs) {
    dowCounts[new Date(log.timestamp).getDay()]++;
  }
  const dowNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  let busiestIdx = 0;
  for (let i = 1; i < 7; i++) if (dowCounts[i] > dowCounts[busiestIdx]) busiestIdx = i;
  const busiestDayOfWeek =
    dowCounts[busiestIdx] > 0 ? { name: dowNames[busiestIdx], count: dowCounts[busiestIdx] } : null;

  // ── Hourly distribution (last 30 days) ──
  const hourCounts = Array.from({ length: 24 }, () => 0);
  for (const log of typedLogs) hourCounts[new Date(log.timestamp).getHours()]++;
  const hourlyDistribution = hourCounts.map((count, h) => ({
    hour: h,
    label: h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`,
    count,
  }));

  // ── Week-over-week delta ──
  const now = Date.now();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
  const thisWeek = typedLogs.filter((l) => l.timestamp >= weekAgo).length;
  const lastWeek = typedLogs.filter((l) => l.timestamp >= twoWeeksAgo && l.timestamp < weekAgo).length;
  const deltaPct = lastWeek === 0 ? (thisWeek > 0 ? 100 : 0) : Math.round(((thisWeek - lastWeek) / lastWeek) * 100);

  return {
    tablesExist: true,
    todayOpens,
    todayCopies,
    weekEvents,
    mostUsedTool: topTools[0] ?? null,
    mostUsedPrompt: topPrompts[0] ?? null,
    topTools,
    topPrompts,
    usageByDay,
    recentLogs: typedLogs.slice(0, 20),
    aiInsights,
    streakDays,
    avgPerDay,
    busiestDayOfWeek,
    hourlyDistribution,
    weekOverWeek: { thisWeek, lastWeek, deltaPct },
  };
}
