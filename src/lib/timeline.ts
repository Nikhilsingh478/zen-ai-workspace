import { useEffect, useSyncExternalStore, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useHorizon } from "@/lib/horizon";
import type { HorizonTask } from "@/lib/horizon";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DomainId =
  | "development"
  | "gym"
  | "cricket"
  | "ai_exploration"
  | "freelance"
  | "jarvis"
  | "travel"
  | "resume"
  | "content";

export type DomainConfig = {
  id: DomainId;
  label: string;
  icon: string;
  color: string;
  glow: string;
};

export const DOMAINS: DomainConfig[] = [
  { id: "development",    label: "Development",    icon: "⌨️",  color: "#3B82F6", glow: "rgba(59,130,246,0.35)"  },
  { id: "gym",            label: "Gym",            icon: "🏋️",  color: "#10B981", glow: "rgba(16,185,129,0.35)"  },
  { id: "cricket",        label: "Cricket",        icon: "🏏",  color: "#F59E0B", glow: "rgba(245,158,11,0.35)"  },
  { id: "ai_exploration", label: "AI Exploration", icon: "🤖",  color: "#8B5CF6", glow: "rgba(139,92,246,0.35)"  },
  { id: "freelance",      label: "Freelance",      icon: "💼",  color: "#06B6D4", glow: "rgba(6,182,212,0.35)"   },
  { id: "jarvis",         label: "Jarvis",         icon: "⚡",  color: "#0EA5E9", glow: "rgba(14,165,233,0.35)"  },
  { id: "travel",         label: "Travel",         icon: "✈️",  color: "#EC4899", glow: "rgba(236,72,153,0.35)"  },
  { id: "resume",         label: "Resume/Career",  icon: "📄",  color: "#F97316", glow: "rgba(249,115,22,0.35)"  },
  { id: "content",        label: "Content",        icon: "🎬",  color: "#EF4444", glow: "rgba(239,68,68,0.35)"   },
];

export const TIMELINE_MONTHS = [
  { key: "2026-05", label: "May",       short: "May", year: 2026, month: 5,  start: "2026-05-01", end: "2026-05-31" },
  { key: "2026-06", label: "June",      short: "Jun", year: 2026, month: 6,  start: "2026-06-01", end: "2026-06-30" },
  { key: "2026-07", label: "July",      short: "Jul", year: 2026, month: 7,  start: "2026-07-01", end: "2026-07-31" },
  { key: "2026-08", label: "August",    short: "Aug", year: 2026, month: 8,  start: "2026-08-01", end: "2026-08-31" },
  { key: "2026-09", label: "September", short: "Sep", year: 2026, month: 9,  start: "2026-09-01", end: "2026-09-30" },
  { key: "2026-10", label: "October",   short: "Oct", year: 2026, month: 10, start: "2026-10-01", end: "2026-10-31" },
];

export type TimelineTask = {
  id: string;
  monthKey: string;
  date: string;
  title: string;
  domain: DomainId;
  startTime: string;
  endTime: string;
  completed: boolean;
  aiGenerated: boolean;
  createdAt: string;
};

export type TimelineMonth = {
  monthKey: string;
  context: string;
  generatedSchedule: string | null;
  updatedAt: string;
};

type MonthRow = {
  month_key: string;
  context: string;
  generated_schedule: string | null;
  updated_at: string;
};

// ─── Description encoding ─────────────────────────────────────────────────────
// Every task added to horizon_tasks by Timeline has this in its description:
//   [timeline:2026-05:gym] 🏋️ Gym
// Timeline filters horizon_tasks by this prefix — no separate table needed.

const TL_RE = /^\[timeline:([^:]+):([^\]]+)\]/;

export function encodeTimelineDesc(monthKey: string, domainId: DomainId): string {
  const dom = DOMAINS.find((d) => d.id === domainId);
  return `[timeline:${monthKey}:${domainId}]${dom ? ` ${dom.icon} ${dom.label}` : ""}`;
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + (m || 0) + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function horizonToTimeline(task: HorizonTask): TimelineTask | null {
  const match = TL_RE.exec(task.description ?? "");
  if (!match) return null;
  const [, monthKey, rawDomain] = match;
  const domain = (DOMAINS.find((d) => d.id === rawDomain)?.id ?? "development") as DomainId;
  return {
    id: task.id,
    monthKey,
    date: task.taskDate,
    title: task.title,
    domain,
    startTime: task.taskTime,
    endTime: addMinutes(task.taskTime, 60),
    completed: task.completed,
    aiGenerated: true,
    createdAt: task.createdAt,
  };
}

// ─── External store for timeline_months (context + schedule metadata) ─────────

type MonthsState = {
  months: Record<string, TimelineMonth>;
  loaded: boolean;
};

const monthListeners = new Set<() => void>();
let monthState: MonthsState = { months: {}, loaded: false };
let monthBooted = false;

function emitMonths() { monthListeners.forEach((fn) => fn()); }
function setMonthState(next: Partial<MonthsState>) { monthState = { ...monthState, ...next }; emitMonths(); }
function subscribeMonths(cb: () => void) { monthListeners.add(cb); return () => monthListeners.delete(cb); }
function getMonthsSnapshot(): MonthsState { return monthState; }

function rowToMonth(r: MonthRow): TimelineMonth {
  return {
    monthKey: r.month_key,
    context: r.context,
    generatedSchedule: r.generated_schedule,
    updatedAt: r.updated_at,
  };
}

async function fetchMonths() {
  const { data, error } = await supabase
    .from("timeline_months")
    .select("*");

  if (error) {
    // Table not yet created — swallow silently (user needs to run TIMELINE_SETUP.sql)
    if (error.code === "PGRST205" || error.code === "42P01") {
      console.debug("[timeline] Run TIMELINE_SETUP.sql in Supabase to enable context persistence.");
    } else {
      console.error("[timeline] fetchMonths error", error);
    }
    setMonthState({ loaded: true });
    return;
  }

  const months: Record<string, TimelineMonth> = {};
  (data as MonthRow[]).forEach((r) => { months[r.month_key] = rowToMonth(r); });
  setMonthState({ months, loaded: true });
}

async function ensureMonthsBooted() {
  if (monthBooted) return;
  monthBooted = true;
  await fetchMonths();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTimeline() {
  const { tasks: horizonTasks, loaded: horizonLoaded, toggle } = useHorizon();
  const snap = useSyncExternalStore(subscribeMonths, getMonthsSnapshot, getMonthsSnapshot);

  useEffect(() => { ensureMonthsBooted(); }, []);

  // Derive timeline tasks from the Horizon store (no separate table)
  const tasks = useMemo(
    () => horizonTasks.map(horizonToTimeline).filter((t): t is TimelineTask => t !== null),
    [horizonTasks],
  );

  // Persist context to Supabase timeline_months
  const saveContext = useCallback(async (monthKey: string, context: string): Promise<void> => {
    // Optimistic local update
    setMonthState({
      months: {
        ...monthState.months,
        [monthKey]: {
          ...(monthState.months[monthKey] ?? { monthKey, generatedSchedule: null }),
          monthKey,
          context,
          updatedAt: new Date().toISOString(),
        },
      },
    });

    const { error } = await supabase
      .from("timeline_months")
      .upsert(
        { month_key: monthKey, context, updated_at: new Date().toISOString() },
        { onConflict: "month_key" },
      );
    if (error) console.error("[timeline] saveContext error", error);
  }, []);

  // Persist generated schedule text to Supabase timeline_months
  const saveGeneratedSchedule = useCallback(async (monthKey: string, schedule: string): Promise<void> => {
    setMonthState({
      months: {
        ...monthState.months,
        [monthKey]: {
          ...(monthState.months[monthKey] ?? { monthKey, context: "" }),
          monthKey,
          generatedSchedule: schedule,
          updatedAt: new Date().toISOString(),
        },
      },
    });

    const { error } = await supabase
      .from("timeline_months")
      .upsert(
        { month_key: monthKey, generated_schedule: schedule, updated_at: new Date().toISOString() },
        { onConflict: "month_key" },
      );
    if (error) console.error("[timeline] saveGeneratedSchedule error", error);
  }, []);

  // No-op — tasks are persisted to horizon_tasks directly via addTasksBatch()
  const saveTasks = useCallback(async (_monthKey: string, _tasks: unknown[]): Promise<void> => {
    // intentionally empty — see handleGenerate in timeline.tsx
  }, []);

  const toggleTask = useCallback((taskId: string): void => {
    toggle(taskId);
  }, [toggle]);

  const getMonthData = useCallback((monthKey: string): TimelineMonth => {
    return snap.months[monthKey] ?? { monthKey, context: "", generatedSchedule: null, updatedAt: "" };
  }, [snap.months]);

  const getMonthTasks = useCallback(
    (monthKey: string): TimelineTask[] => tasks.filter((t) => t.monthKey === monthKey),
    [tasks],
  );

  const getMonthProgress = useCallback((monthKey: string): number => {
    const mt = tasks.filter((t) => t.monthKey === monthKey);
    if (!mt.length) return 0;
    return Math.round((mt.filter((t) => t.completed).length / mt.length) * 100);
  }, [tasks]);

  return {
    tasks,
    loaded: horizonLoaded && snap.loaded,
    saveContext,
    saveGeneratedSchedule,
    saveTasks,
    toggleTask,
    getMonthData,
    getMonthTasks,
    getMonthProgress,
  };
}
