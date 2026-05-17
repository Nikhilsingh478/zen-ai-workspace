import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Priority = "low" | "medium" | "high";

export type HorizonTask = {
  id: string;
  title: string;
  description: string | null;
  taskDate: string;
  taskTime: string;
  priority: Priority;
  completed: boolean;
  notificationEnabled: boolean;
  createdAt: string;
};

export type HorizonTaskInput = {
  title: string;
  description?: string | null;
  taskDate: string;
  taskTime: string;
  priority: Priority;
  notificationEnabled: boolean;
};

type Row = {
  id: string;
  title: string;
  description: string | null;
  task_date: string;
  task_time: string;
  priority: string;
  completed: boolean;
  notification_enabled: boolean;
  created_at: string;
};

type State = {
  tasks: HorizonTask[];
  loaded: boolean;
};

// ─── External store ───────────────────────────────────────────────────────────

const listeners = new Set<() => void>();
let state: State = { tasks: [], loaded: false };
let booted = false;
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

function emit() {
  listeners.forEach((fn) => fn());
}
function setState(next: Partial<State>) {
  state = { ...state, ...next };
  emit();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function getSnapshot(): State {
  return state;
}

function rowToTask(row: Row): HorizonTask {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    taskDate: row.task_date,
    taskTime: row.task_time,
    priority: (row.priority as Priority) ?? "medium",
    completed: row.completed,
    notificationEnabled: row.notification_enabled,
    createdAt: row.created_at,
  };
}

async function refetch() {
  const { data, error } = await supabase
    .from("horizon_tasks")
    .select("*")
    .order("task_date", { ascending: true })
    .order("task_time", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  setState({ tasks: (data as Row[]).map(rowToTask), loaded: true });
}

function setupRealtime() {
  if (realtimeChannel) return;
  realtimeChannel = supabase
    .channel("horizon_tasks_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "horizon_tasks" },
      () => {
        refetch().catch(console.error);
      },
    )
    .subscribe();
}

async function ensureBooted() {
  if (booted) return;
  booted = true;
  try {
    await refetch();
    setupRealtime();
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    // PGRST205 = table doesn't exist yet — silent fallback, no toast
    if (code !== "PGRST205") {
      console.error("[horizon] load error", err);
      toast.error("Failed to load Horizon tasks");
    } else {
      console.debug("[horizon] table not set up yet — run HORIZON_SETUP.sql");
    }
    setState({ loaded: true });
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useHorizon() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    ensureBooted();
  }, []);

  const add = async (input: HorizonTaskInput): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("horizon_tasks")
        .insert({
          title: input.title.trim(),
          description: input.description?.trim() || null,
          task_date: input.taskDate,
          task_time: input.taskTime,
          priority: input.priority,
          notification_enabled: input.notificationEnabled,
        })
        .select("*")
        .single();
      if (error) throw error;
      const task = rowToTask(data as Row);
      setState({ tasks: [...state.tasks, task].sort(sortTasks) });
      toast.success("Task added", { duration: 1500 });
      return true;
    } catch (err) {
      console.error("[horizon] add error", err);
      toast.error("Failed to add task");
      return false;
    }
  };

  const update = async (id: string, input: HorizonTaskInput): Promise<boolean> => {
    const prev = state.tasks;
    try {
      const { data, error } = await supabase
        .from("horizon_tasks")
        .update({
          title: input.title.trim(),
          description: input.description?.trim() || null,
          task_date: input.taskDate,
          task_time: input.taskTime,
          priority: input.priority,
          notification_enabled: input.notificationEnabled,
        })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      const updated = rowToTask(data as Row);
      setState({
        tasks: prev.map((t) => (t.id === id ? updated : t)).sort(sortTasks),
      });
      toast.success("Task updated", { duration: 1500 });
      return true;
    } catch (err) {
      console.error("[horizon] update error", err);
      toast.error("Failed to update task");
      setState({ tasks: prev });
      return false;
    }
  };

  const toggle = async (id: string) => {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    const next = !task.completed;
    setState({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, completed: next } : t)),
    });
    try {
      const { error } = await supabase
        .from("horizon_tasks")
        .update({ completed: next })
        .eq("id", id);
      if (error) throw error;
    } catch (err) {
      console.error("[horizon] toggle error", err);
      toast.error("Failed to update task");
      setState({
        tasks: state.tasks.map((t) => (t.id === id ? { ...t, completed: task.completed } : t)),
      });
    }
  };

  const remove = async (id: string) => {
    const prev = state.tasks;
    setState({ tasks: state.tasks.filter((t) => t.id !== id) });
    try {
      const { error } = await supabase.from("horizon_tasks").delete().eq("id", id);
      if (error) throw error;
      toast.success("Task deleted", { duration: 1500 });
    } catch (err) {
      console.error("[horizon] remove error", err);
      toast.error("Failed to delete task");
      setState({ tasks: prev });
    }
  };

  const tasksForDate = (dateStr: string): HorizonTask[] =>
    snap.tasks.filter((t) => t.taskDate === dateStr).sort(sortTasks);

  const datesWithTasks = new Set(snap.tasks.map((t) => t.taskDate));

  return {
    tasks: snap.tasks,
    loaded: snap.loaded,
    add,
    update,
    toggle,
    remove,
    tasksForDate,
    datesWithTasks,
  };
}

// ─── Module-level accessor for non-React callers (e.g. JARVIS) ───────────────

export function getHorizonTasks(): HorizonTask[] {
  return state.tasks;
}

// ─── Batch insert tasks (callable outside React hooks, e.g. Timeline) ────────

export async function addTasksBatch(inputs: HorizonTaskInput[]): Promise<number> {
  if (inputs.length === 0) return 0;
  try {
    await ensureBooted();
    const rows = inputs.map((input) => ({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      task_date: input.taskDate,
      task_time: input.taskTime,
      priority: input.priority,
      notification_enabled: input.notificationEnabled,
    }));
    const { data, error } = await supabase
      .from("horizon_tasks")
      .insert(rows)
      .select("*");
    if (error) throw error;
    const newTasks = (data as Row[]).map(rowToTask);
    setState({ tasks: [...state.tasks, ...newTasks].sort(sortTasks) });
    return newTasks.length;
  } catch (err) {
    console.error("[horizon] addTasksBatch error", err);
    return 0;
  }
}

// ─── Standalone addTaskDirect (callable outside React hooks) ─────────────────

export async function addTaskDirect(input: HorizonTaskInput): Promise<HorizonTask | null> {
  try {
    await ensureBooted();
    const { data, error } = await supabase
      .from("horizon_tasks")
      .insert({
        title: input.title.trim(),
        description: input.description?.trim() || null,
        task_date: input.taskDate,
        task_time: input.taskTime,
        priority: input.priority,
        notification_enabled: input.notificationEnabled,
      })
      .select("*")
      .single();
    if (error) throw error;
    const task = rowToTask(data as Row);
    setState({ tasks: [...state.tasks, task].sort(sortTasks) });
    return task;
  } catch (err) {
    console.error("[horizon] addTaskDirect error", err);
    return null;
  }
}

// ─── Delete all Timeline-generated tasks for a month ─────────────────────────
// Only deletes tasks whose description starts with [timeline:${monthKey}:
// Never touches manual or JARVIS-created tasks.

export async function deleteTasksByMonthKey(monthKey: string): Promise<number> {
  const prefix = `[timeline:${monthKey}:`;
  const toDelete = state.tasks.filter((t) => t.description?.startsWith(prefix));
  if (!toDelete.length) return 0;

  const ids = toDelete.map((t) => t.id);
  const prevTasks = state.tasks;
  setState({ tasks: state.tasks.filter((t) => !ids.includes(t.id)) });

  try {
    const { error } = await supabase
      .from("horizon_tasks")
      .delete()
      .in("id", ids);
    if (error) throw error;
    return ids.length;
  } catch (err) {
    console.error("[horizon] deleteTasksByMonthKey error", err);
    toast.error("Failed to delete timeline tasks");
    setState({ tasks: prevTasks });
    return 0;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sortTasks(a: HorizonTask, b: HorizonTask): number {
  if (a.taskTime < b.taskTime) return -1;
  if (a.taskTime > b.taskTime) return 1;
  return a.createdAt.localeCompare(b.createdAt);
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function format12Hour(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
}

export const PRIORITY_CONFIG: Record<Priority, {
  label: string;
  color: string;
  dot: string;
  bg: string;
  border: string;
}> = {
  low: {
    label: "Low",
    color: "text-blue-300/60",
    dot: "bg-blue-400/50",
    bg: "bg-blue-500/[0.08]",
    border: "border-blue-400/[0.18]",
  },
  medium: {
    label: "Medium",
    color: "text-amber-300/70",
    dot: "bg-amber-400/60",
    bg: "bg-amber-500/[0.08]",
    border: "border-amber-400/[0.18]",
  },
  high: {
    label: "High",
    color: "text-red-300/70",
    dot: "bg-red-400/60",
    bg: "bg-red-500/[0.07]",
    border: "border-red-400/[0.15]",
  },
};
