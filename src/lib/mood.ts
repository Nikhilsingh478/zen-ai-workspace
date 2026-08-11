/**
 * Mood Tracker — External store + Supabase persistence
 * Follows the same useSyncExternalStore architecture as horizon.ts and timeline.ts
 */

import { useEffect, useSyncExternalStore, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MoodLevel = 1 | 2 | 3 | 4 | 5;

export type MoodEntry = {
  id: string;
  mood: MoodLevel;
  moodLabel: string;
  stress: number | null;
  energy: number | null;
  focus: number | null;
  sleepQuality: number | null;
  reason: string | null;
  reflection: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MoodEntryInput = {
  mood: MoodLevel;
  moodLabel: string;
  stress?: number | null;
  energy?: number | null;
  focus?: number | null;
  sleepQuality?: number | null;
  reason?: string | null;
  reflection?: string | null;
};

export type MoodStats = {
  averageMood: number | null;
  averageStress: number | null;
  averageEnergy: number | null;
  averageFocus: number | null;
  averageSleep: number | null;
  totalEntries: number;
  trend: number | null; // positive = improving, negative = declining
  trendLabel: string;
};

// DB row shape (snake_case)
type Row = {
  id: string;
  mood: number;
  mood_label: string;
  stress: number | null;
  energy: number | null;
  focus: number | null;
  sleep_quality: number | null;
  reason: string | null;
  reflection: string | null;
  created_at: string;
  updated_at: string;
};

type State = {
  entries: MoodEntry[];
  loaded: boolean;
};

// ─── Mood scale config ─────────────────────────────────────────────────────────

export const MOOD_CONFIG: Record<MoodLevel, { label: string; color: string; accent: string; description: string }> = {
  1: { label: "Very Low",   color: "#F87171", accent: "rgba(248,113,113,0.15)", description: "Struggling" },
  2: { label: "Low",        color: "#FB923C", accent: "rgba(251,146,60,0.15)",  description: "Below average" },
  3: { label: "Neutral",    color: "#94A3B8", accent: "rgba(148,163,184,0.12)", description: "Getting by" },
  4: { label: "Good",       color: "#34D399", accent: "rgba(52,211,153,0.15)",  description: "Doing well" },
  5: { label: "Very Good",  color: "#38BDF8", accent: "rgba(56,189,248,0.15)",  description: "At my best" },
};

// ─── External store ────────────────────────────────────────────────────────────

const listeners = new Set<() => void>();
let state: State = { entries: [], loaded: false };
let booted = false;

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

// ─── Row mapper ────────────────────────────────────────────────────────────────

function rowToEntry(row: Row): MoodEntry {
  return {
    id: row.id,
    mood: Math.max(1, Math.min(5, row.mood)) as MoodLevel,
    moodLabel: row.mood_label,
    stress: row.stress,
    energy: row.energy,
    focus: row.focus,
    sleepQuality: row.sleep_quality,
    reason: row.reason,
    reflection: row.reflection,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Fetch ─────────────────────────────────────────────────────────────────────

async function refetch(): Promise<void> {
  const { data, error } = await supabase
    .from("mood_entries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200); // single-user app — 200 entries is more than sufficient

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") {
      console.debug("[mood] Run MOOD_SETUP.sql in Supabase to enable mood tracking.");
    } else {
      console.error("[mood] refetch error", error);
    }
    setState({ loaded: true });
    return;
  }

  setState({ entries: (data as Row[]).map(rowToEntry), loaded: true });
}

export async function ensureMoodBooted(): Promise<void> {
  if (booted) return;
  booted = true;
  try {
    await refetch();
  } catch (err) {
    console.error("[mood] boot error", err);
    setState({ loaded: true });
  }
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useMood() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    ensureMoodBooted();
  }, []);

  // ── Add ──────────────────────────────────────────────────────────────────────
  const add = async (input: MoodEntryInput): Promise<MoodEntry | null> => {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("mood_entries")
        .insert({
          mood: input.mood,
          mood_label: input.moodLabel,
          stress: input.stress ?? null,
          energy: input.energy ?? null,
          focus: input.focus ?? null,
          sleep_quality: input.sleepQuality ?? null,
          reason: input.reason?.trim() || null,
          reflection: input.reflection?.trim() || null,
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single();

      if (error) throw error;
      const entry = rowToEntry(data as Row);
      setState({ entries: [entry, ...state.entries] });
      toast.success("Mood logged.", { duration: 1500 });
      return entry;
    } catch (err) {
      console.error("[mood] add error", err);
      toast.error("Couldn't save this reflection.");
      return null;
    }
  };

  // ── Update ────────────────────────────────────────────────────────────────────
  const update = async (id: string, input: MoodEntryInput): Promise<boolean> => {
    const prev = state.entries;
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("mood_entries")
        .update({
          mood: input.mood,
          mood_label: input.moodLabel,
          stress: input.stress ?? null,
          energy: input.energy ?? null,
          focus: input.focus ?? null,
          sleep_quality: input.sleepQuality ?? null,
          reason: input.reason?.trim() || null,
          reflection: input.reflection?.trim() || null,
          updated_at: now,
        })
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;
      const updated = rowToEntry(data as Row);
      setState({ entries: prev.map((e) => (e.id === id ? updated : e)) });
      toast.success("Mood entry updated.", { duration: 1500 });
      return true;
    } catch (err) {
      console.error("[mood] update error", err);
      toast.error("Couldn't update this entry.");
      setState({ entries: prev });
      return false;
    }
  };

  // ── Remove ────────────────────────────────────────────────────────────────────
  const remove = async (id: string): Promise<boolean> => {
    const prev = state.entries;
    setState({ entries: state.entries.filter((e) => e.id !== id) });
    try {
      const { error } = await supabase.from("mood_entries").delete().eq("id", id);
      if (error) throw error;
      toast.success("Mood entry deleted.", { duration: 1500 });
      return true;
    } catch (err) {
      console.error("[mood] remove error", err);
      toast.error("Couldn't delete this entry.");
      setState({ entries: prev });
      return false;
    }
  };

  // ── Derived helpers ────────────────────────────────────────────────────────────
  const getEntryById = (id: string): MoodEntry | undefined =>
    snap.entries.find((e) => e.id === id);

  const getEntriesForRange = (days: number): MoodEntry[] => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return snap.entries.filter((e) => new Date(e.createdAt) >= cutoff);
  };

  // Latest entry today (local timezone)
  const todayEntry = useMemo((): MoodEntry | null => {
    const today = new Date().toLocaleDateString("en-CA");
    return snap.entries.find((e) => e.createdAt.slice(0, 10) === today) ?? null;
  }, [snap.entries]);

  return {
    entries: snap.entries,
    loaded: snap.loaded,
    todayEntry,
    add,
    update,
    remove,
    getEntryById,
    getEntriesForRange,
  };
}

// ─── Module-level accessors (for non-React callers like JARVIS) ────────────────

export function getMoodEntries(): MoodEntry[] {
  return state.entries;
}

export async function addMoodEntryDirect(input: MoodEntryInput): Promise<MoodEntry | null> {
  try {
    await ensureMoodBooted();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("mood_entries")
      .insert({
        mood: input.mood,
        mood_label: input.moodLabel,
        stress: input.stress ?? null,
        energy: input.energy ?? null,
        focus: input.focus ?? null,
        sleep_quality: input.sleepQuality ?? null,
        reason: input.reason?.trim() || null,
        reflection: input.reflection?.trim() || null,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error) throw error;
    const entry = rowToEntry(data as Row);
    setState({ entries: [entry, ...state.entries] });
    return entry;
  } catch (err) {
    console.error("[mood] addMoodEntryDirect error", err);
    return null;
  }
}

// ─── Statistics helpers ────────────────────────────────────────────────────────

function avg(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null);
  if (!valid.length) return null;
  return Math.round((valid.reduce((s, v) => s + v, 0) / valid.length) * 10) / 10;
}

export function getMoodStats(entries: MoodEntry[], days = 30): MoodStats {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const inRange = entries.filter((e) => new Date(e.createdAt) >= cutoff);

  const prevCutoff = new Date();
  prevCutoff.setDate(prevCutoff.getDate() - days * 2);
  const prevRange = entries.filter(
    (e) => new Date(e.createdAt) >= prevCutoff && new Date(e.createdAt) < cutoff,
  );

  const averageMood = avg(inRange.map((e) => e.mood));
  const prevAvgMood = avg(prevRange.map((e) => e.mood));

  let trend: number | null = null;
  let trendLabel = "Not enough data yet";

  if (averageMood !== null && prevAvgMood !== null) {
    trend = Math.round((averageMood - prevAvgMood) * 10) / 10;
    if (trend > 0.2) trendLabel = `↑ ${trend} from previous period`;
    else if (trend < -0.2) trendLabel = `↓ ${Math.abs(trend)} from previous period`;
    else trendLabel = "Stable";
  } else if (inRange.length >= 3) {
    trendLabel = "Building your baseline";
  }

  return {
    averageMood,
    averageStress: avg(inRange.map((e) => e.stress)),
    averageEnergy: avg(inRange.map((e) => e.energy)),
    averageFocus: avg(inRange.map((e) => e.focus)),
    averageSleep: avg(inRange.map((e) => e.sleepQuality)),
    totalEntries: inRange.length,
    trend,
    trendLabel,
  };
}

// Build 7-day chart data (gaps preserved — no fake interpolation)
export function getMoodTrend(entries: MoodEntry[]): Array<{ day: string; mood: number | null; label: string }> {
  const days: Array<{ day: string; mood: number | null; label: string }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString("en-CA");
    const dayEntries = entries.filter((e) => e.createdAt.slice(0, 10) === key);
    const moodVal = dayEntries.length
      ? avg(dayEntries.map((e) => e.mood))
      : null;
    days.push({
      day: key,
      mood: moodVal,
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
    });
  }
  return days;
}

// Deterministic pattern observations (no AI required, no fabrication)
export function getMoodObservations(entries: MoodEntry[]): string[] {
  if (entries.length < 3) return [];
  const observations: string[] = [];

  // Only do serious analysis with 7+ entries
  if (entries.length < 7) {
    const a = avg(entries.map((e) => e.mood));
    if (a !== null) {
      observations.push(
        `Your average mood across ${entries.length} entries is ${a.toFixed(1)} out of 5.`,
      );
    }
    return observations;
  }

  // Average mood
  const avgMood = avg(entries.map((e) => e.mood));
  if (avgMood !== null) {
    observations.push(`Average mood: ${avgMood.toFixed(1)} / 5 across ${entries.length} entries.`);
  }

  // Energy ↔ Focus correlation
  const paired = entries.filter((e) => e.energy != null && e.focus != null);
  if (paired.length >= 5) {
    const highEnergy = paired.filter((e) => (e.energy ?? 0) >= 4);
    const lowEnergy = paired.filter((e) => (e.energy ?? 0) <= 2);
    const highEnergyFocus = avg(highEnergy.map((e) => e.focus));
    const lowEnergyFocus = avg(lowEnergy.map((e) => e.focus));
    if (highEnergyFocus !== null && lowEnergyFocus !== null && highEnergy.length >= 2 && lowEnergy.length >= 2) {
      if (highEnergyFocus - lowEnergyFocus > 0.5) {
        observations.push(
          `Your higher-energy entries also show higher focus scores (${highEnergyFocus.toFixed(1)} vs ${lowEnergyFocus.toFixed(1)}).`,
        );
      }
    }
  }

  // Sleep ↔ Mood correlation
  const sleepPaired = entries.filter((e) => e.sleepQuality != null);
  if (sleepPaired.length >= 5) {
    const goodSleep = sleepPaired.filter((e) => (e.sleepQuality ?? 0) >= 4);
    const poorSleep = sleepPaired.filter((e) => (e.sleepQuality ?? 0) <= 2);
    const goodSleepMood = avg(goodSleep.map((e) => e.mood));
    const poorSleepMood = avg(poorSleep.map((e) => e.mood));
    if (goodSleepMood !== null && poorSleepMood !== null && goodSleep.length >= 2 && poorSleep.length >= 2) {
      if (goodSleepMood - poorSleepMood > 0.5) {
        observations.push(
          `Lower sleep scores appear alongside lower mood in your entries (${poorSleepMood.toFixed(1)} vs ${goodSleepMood.toFixed(1)} avg mood).`,
        );
      }
    }
  }

  // Stress ↔ Mood correlation
  const stressPaired = entries.filter((e) => e.stress != null);
  if (stressPaired.length >= 5) {
    const highStress = stressPaired.filter((e) => (e.stress ?? 0) >= 4);
    const lowStress = stressPaired.filter((e) => (e.stress ?? 0) <= 2);
    const highStressMood = avg(highStress.map((e) => e.mood));
    const lowStressMood = avg(lowStress.map((e) => e.mood));
    if (highStressMood !== null && lowStressMood !== null && highStress.length >= 2 && lowStress.length >= 2) {
      if (lowStressMood - highStressMood > 0.5) {
        observations.push(
          `Your mood tends to be higher on lower-stress days (${lowStressMood.toFixed(1)} vs ${highStressMood.toFixed(1)} avg).`,
        );
      }
    }
  }

  // Recent week vs previous week
  const now = new Date();
  const weekAgo = new Date(); weekAgo.setDate(now.getDate() - 7);
  const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(now.getDate() - 14);
  const thisWeek = entries.filter((e) => new Date(e.createdAt) >= weekAgo);
  const lastWeek = entries.filter((e) => new Date(e.createdAt) >= twoWeeksAgo && new Date(e.createdAt) < weekAgo);
  const thisWeekAvg = avg(thisWeek.map((e) => e.mood));
  const lastWeekAvg = avg(lastWeek.map((e) => e.mood));
  if (thisWeekAvg !== null && lastWeekAvg !== null && thisWeek.length >= 2 && lastWeek.length >= 2) {
    const diff = thisWeekAvg - lastWeekAvg;
    if (Math.abs(diff) > 0.3) {
      observations.push(
        diff > 0
          ? `Your mood has been higher this week than last (${thisWeekAvg.toFixed(1)} vs ${lastWeekAvg.toFixed(1)}).`
          : `Your mood has been lower this week than last (${thisWeekAvg.toFixed(1)} vs ${lastWeekAvg.toFixed(1)}).`,
      );
    } else {
      observations.push(`Your mood has been consistent across the past two weeks.`);
    }
  }

  return observations.slice(0, 4); // Cap at 4 observations to avoid overwhelming
}

// Concise context string for JARVIS/Ask — only derived summaries, no raw reflections
export function buildMoodContext(entries: MoodEntry[]): string {
  if (!entries.length) return "";

  const recent = entries.slice(0, 14);
  const stats = getMoodStats(entries, 30);
  const parts: string[] = [];

  parts.push(`## Mood Overview (last 30 days)`);

  if (stats.averageMood !== null) {
    parts.push(`- Average mood: ${stats.averageMood}/5 (${stats.totalEntries} entries)`);
  }
  if (stats.averageEnergy !== null) parts.push(`- Average energy: ${stats.averageEnergy}/5`);
  if (stats.averageFocus !== null) parts.push(`- Average focus: ${stats.averageFocus}/5`);
  if (stats.averageStress !== null) parts.push(`- Average stress: ${stats.averageStress}/5`);
  if (stats.trendLabel && stats.trendLabel !== "Not enough data yet") {
    parts.push(`- Trend: ${stats.trendLabel}`);
  }

  // Include last few mood levels (no personal text)
  if (recent.length > 0) {
    const recentSummary = recent.slice(0, 5)
      .map((e) => {
        const d = new Date(e.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return `${d}: mood ${e.mood}/5`;
      })
      .join(", ");
    parts.push(`- Recent: ${recentSummary}`);
  }

  const observations = getMoodObservations(recent);
  if (observations.length > 0) {
    parts.push(`\n### Observed patterns`);
    observations.forEach((o) => parts.push(`- ${o}`));
  }

  return parts.join("\n");
}
