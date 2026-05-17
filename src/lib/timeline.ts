import { useEffect, useSyncExternalStore, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

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
  { id: "development",   label: "Development",    icon: "⌨️",  color: "#3B82F6", glow: "rgba(59,130,246,0.35)"   },
  { id: "gym",           label: "Gym",            icon: "🏋️",  color: "#10B981", glow: "rgba(16,185,129,0.35)"   },
  { id: "cricket",       label: "Cricket",        icon: "🏏",  color: "#F59E0B", glow: "rgba(245,158,11,0.35)"   },
  { id: "ai_exploration",label: "AI Exploration", icon: "🤖",  color: "#8B5CF6", glow: "rgba(139,92,246,0.35)"   },
  { id: "freelance",     label: "Freelance",      icon: "💼",  color: "#06B6D4", glow: "rgba(6,182,212,0.35)"    },
  { id: "jarvis",        label: "Jarvis",         icon: "⚡",  color: "#0EA5E9", glow: "rgba(14,165,233,0.35)"   },
  { id: "travel",        label: "Travel",         icon: "✈️",  color: "#EC4899", glow: "rgba(236,72,153,0.35)"   },
  { id: "resume",        label: "Resume/Career",  icon: "📄",  color: "#F97316", glow: "rgba(249,115,22,0.35)"   },
  { id: "content",       label: "Content",        icon: "🎬",  color: "#EF4444", glow: "rgba(239,68,68,0.35)"    },
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

type TaskRow = {
  id: string;
  month_key: string;
  date: string;
  title: string;
  domain: string;
  start_time: string;
  end_time: string;
  completed: boolean;
  ai_generated: boolean;
  created_at: string;
};

type MonthRow = {
  month_key: string;
  context: string;
  generated_schedule: string | null;
  updated_at: string;
};

// ─── External store ───────────────────────────────────────────────────────────

type State = {
  tasks: TimelineTask[];
  months: Record<string, TimelineMonth>;
  loaded: boolean;
};

const listeners = new Set<() => void>();
let state: State = { tasks: [], months: {}, loaded: false };
let booted = false;

function emit() { listeners.forEach((fn) => fn()); }
function setState(next: Partial<State>) { state = { ...state, ...next }; emit(); }
function subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); }
function getSnapshot(): State { return state; }

function rowToTask(r: TaskRow): TimelineTask {
  return {
    id: r.id,
    monthKey: r.month_key,
    date: r.date,
    title: r.title,
    domain: r.domain as DomainId,
    startTime: r.start_time,
    endTime: r.end_time,
    completed: r.completed,
    aiGenerated: r.ai_generated,
    createdAt: r.created_at,
  };
}

function rowToMonth(r: MonthRow): TimelineMonth {
  return {
    monthKey: r.month_key,
    context: r.context,
    generatedSchedule: r.generated_schedule,
    updatedAt: r.updated_at,
  };
}

async function refetch() {
  const [tasksRes, monthsRes] = await Promise.all([
    supabase.from("timeline_tasks").select("*").order("date").order("start_time"),
    supabase.from("timeline_months").select("*"),
  ]);

  if (tasksRes.error) throw tasksRes.error;
  if (monthsRes.error) throw monthsRes.error;

  const tasks = (tasksRes.data as TaskRow[]).map(rowToTask);
  const months: Record<string, TimelineMonth> = {};
  (monthsRes.data as MonthRow[]).forEach((r) => { months[r.month_key] = rowToMonth(r); });

  setState({ tasks, months, loaded: true });
}

async function ensureBooted() {
  if (booted) return;
  booted = true;
  try {
    await refetch();
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code !== "PGRST205" && code !== "42P01") {
      console.error("[timeline] load error", err);
    }
    setState({ loaded: true });
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTimeline() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => { ensureBooted(); }, []);

  const saveContext = useCallback(async (monthKey: string, context: string): Promise<void> => {
    try {
      await supabase.from("timeline_months").upsert(
        { month_key: monthKey, context, updated_at: new Date().toISOString() },
        { onConflict: "month_key" },
      );
      setState({
        months: {
          ...state.months,
          [monthKey]: { ...(state.months[monthKey] ?? { monthKey, generatedSchedule: null }), monthKey, context, updatedAt: new Date().toISOString() },
        },
      });
    } catch (err) {
      console.error("[timeline] saveContext error", err);
      throw err;
    }
  }, []);

  const saveGeneratedSchedule = useCallback(async (monthKey: string, schedule: string): Promise<void> => {
    try {
      await supabase.from("timeline_months").upsert(
        { month_key: monthKey, generated_schedule: schedule, updated_at: new Date().toISOString() },
        { onConflict: "month_key" },
      );
      setState({
        months: {
          ...state.months,
          [monthKey]: {
            ...(state.months[monthKey] ?? { monthKey, context: "" }),
            monthKey,
            generatedSchedule: schedule,
            updatedAt: new Date().toISOString(),
          },
        },
      });
    } catch (err) {
      console.error("[timeline] saveGeneratedSchedule error", err);
      throw err;
    }
  }, []);

  const saveTasks = useCallback(async (monthKey: string, tasks: Omit<TimelineTask, "id" | "createdAt">[]): Promise<void> => {
    try {
      await supabase.from("timeline_tasks").delete().eq("month_key", monthKey).eq("ai_generated", true);

      if (tasks.length === 0) {
        setState({ tasks: state.tasks.filter((t) => !(t.monthKey === monthKey && t.aiGenerated)) });
        return;
      }

      const rows = tasks.map((t) => ({
        month_key: t.monthKey,
        date: t.date,
        title: t.title,
        domain: t.domain,
        start_time: t.startTime,
        end_time: t.endTime,
        completed: t.completed,
        ai_generated: t.aiGenerated,
        created_at: new Date().toISOString(),
      }));

      const { data, error } = await supabase.from("timeline_tasks").insert(rows).select("*");
      if (error) throw error;

      const newTasks = (data as TaskRow[]).map(rowToTask);
      setState({
        tasks: [...state.tasks.filter((t) => !(t.monthKey === monthKey && t.aiGenerated)), ...newTasks],
      });
    } catch (err) {
      console.error("[timeline] saveTasks error", err);
      throw err;
    }
  }, []);

  const toggleTask = useCallback(async (taskId: string): Promise<void> => {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const next = !task.completed;
    setState({ tasks: state.tasks.map((t) => t.id === taskId ? { ...t, completed: next } : t) });
    try {
      const { error } = await supabase.from("timeline_tasks").update({ completed: next }).eq("id", taskId);
      if (error) throw error;
    } catch (err) {
      setState({ tasks: state.tasks.map((t) => t.id === taskId ? { ...t, completed: task.completed } : t) });
      toast.error("Failed to update task");
    }
  }, []);

  const getMonthData = useCallback((monthKey: string): TimelineMonth | null => {
    return snap.months[monthKey] ?? null;
  }, [snap.months]);

  const getMonthTasks = useCallback((monthKey: string): TimelineTask[] => {
    return snap.tasks.filter((t) => t.monthKey === monthKey);
  }, [snap.tasks]);

  const getMonthProgress = useCallback((monthKey: string): number => {
    const tasks = snap.tasks.filter((t) => t.monthKey === monthKey);
    if (tasks.length === 0) return 0;
    return Math.round((tasks.filter((t) => t.completed).length / tasks.length) * 100);
  }, [snap.tasks]);

  return {
    tasks: snap.tasks,
    months: snap.months,
    loaded: snap.loaded,
    saveContext,
    saveGeneratedSchedule,
    saveTasks,
    toggleTask,
    getMonthData,
    getMonthTasks,
    getMonthProgress,
  };
}
