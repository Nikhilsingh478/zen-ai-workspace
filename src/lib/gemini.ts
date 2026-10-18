import { supabase } from "@/lib/supabase";
import { addTaskDirect, getHorizonTasks, addJarvisTasksBatch } from "@/lib/horizon";
import { addMoodEntryDirect, getMoodEntries, buildMoodContext, MOOD_CONFIG } from "@/lib/mood";
import type { HorizonTask } from "@/lib/horizon";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GeminiMessagePart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: { result: string } } }
  | { executableCode: { language: string; code: string } }
  | { codeExecutionResult: { outcome: string; output: string } };

export interface GeminiMessage {
  role: "user" | "model";
  parts: GeminiMessagePart[];
}

interface GeminiRequest {
  contents: GeminiMessage[];
  tools?: Array<
    | { functionDeclarations?: unknown[] }
    | { googleSearch?: Record<string, never> }
    | { codeExecution?: Record<string, never> }
  >;
  generationConfig?: {
    temperature?: number;
    topK?: number;
    topP?: number;
    maxOutputTokens?: number;
    thinkingConfig?: { thinkingBudget: number };
  };
  toolConfig?: { functionCallingConfig: { mode: "AUTO" | "ANY" | "NONE" } };
  systemInstruction?: { parts: Array<{ text: string }> };
  cachedContent?: string;
}

interface GeminiStreamChunk {
  candidates?: Array<{
    content?: { parts?: GeminiMessagePart[] };
  }>;
}

interface GeminiResponse {
  candidates?: Array<{
    content: { parts: GeminiMessagePart[]; role: string };
    finishReason: string;
    index: number;
    groundingMetadata?: {
      groundingChunks?: Array<{
        web?: { title?: string; uri?: string };
      }>;
    };
  }>;
}

export interface UserContext {
  websites?: Array<{ name: string; url: string; description: string; tags: string[] }>;
  prompts?: Array<{ title: string; body: string }>;
  links?: Array<{ name: string; url: string; description?: string | null }>;
  messages?: Array<{ motive: string; time: string; message: string }>;
  folders?: Array<{ name: string; items: string[] }>;
}

export type SearchSource = {
  title: string;
  url: string;
  snippet: string;
};

export type SearchType =
  | "general"
  | "news"
  | "weather"
  | "comparison"
  | "howto"
  | "definition"
  | "local"
  | "code"
  | "math";

// ─── Error map ────────────────────────────────────────────────────────────────

const HTTP_ERRORS: Record<number, string> = {
  400: "Invalid request. Please check your API key and try again.",
  403: "API key is invalid or permissions are insufficient.",
  429: "Rate limit exceeded. Please try again in a moment.",
};

// ─── JARVIS Tool Definitions ──────────────────────────────────────────────────

const JARVIS_TOOLS = [
  {
    name: "create_task",
    description:
      "Creates a task in Horizon (the user's task planner). Call this IMMEDIATELY whenever the user wants something added to Horizon, their tasks, schedule, to-do list or reminders — " +
      "do not ask follow-up questions first. Only the title is required; missing fields get sensible defaults.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Clear, concise task title" },
        taskDate: { type: "string", description: "Date in YYYY-MM-DD format. Omit to use today." },
        taskTime: { type: "string", description: "Time in HH:MM 24h format. Omit if the user gave no time." },
        priority: { type: "string", enum: ["low", "medium", "high"], description: "Omit to use medium." },
        description: { type: "string", description: "Optional extra context" },
      },
      required: ["title"],
    },
  },
  {
    name: "save_memory",
    description:
      "Saves something important to persistent memory when the user says 'remember that', mentions a preference, shares something personal, or says something that should be recalled in future sessions.",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "The memory to save, written as a clear statement" },
        memory_type: {
          type: "string",
          enum: ["general", "preference", "commitment", "idea", "fact"],
          description: "Classification of what kind of memory this is",
        },
      },
      required: ["content", "memory_type"],
    },
  },
  {
    name: "get_today_tasks",
    description:
      "Retrieves all tasks scheduled for today when the user asks about their day, their schedule, what's pending, or what they need to do.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_pending_tasks",
    description:
      "Retrieves all incomplete tasks across all dates when the user asks about backlog, pending work, or unfinished tasks.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "recall_memories",
    description:
      "Searches persistent memory when the user asks what Jarvis remembers, asks about their own preferences, or references something from the past.",
    parameters: {
      type: "object",
      properties: {
        memory_type: {
          type: "string",
          enum: ["general", "preference", "commitment", "idea", "fact", "all"],
          description: "Filter by type or 'all' for everything",
        },
      },
      required: ["memory_type"],
    },
  },
  {
    name: "delete_task",
    description:
      "Deletes a specific task when the user says to remove, cancel, or delete a task.",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "The task ID to delete" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "update_task",
    description:
      "Updates an existing task's title, date, time, or priority when the user wants to reschedule or modify a task.",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "The task ID to update" },
        title: { type: "string" },
        taskDate: { type: "string", description: "YYYY-MM-DD" },
        taskTime: { type: "string", description: "HH:MM 24h" },
        priority: { type: "string", enum: ["low", "medium", "high"] },
      },
      required: ["task_id"],
    },
  },
  {
    name: "update_user_context",
    description:
      "Updates the user's personal context when they share significant life updates, new goals, completed milestones, changed preferences, or new projects. " +
      "Only call this when the user says something that meaningfully changes their life situation — not for routine task creation or casual chat. " +
      'Examples that SHOULD trigger this: "I just got a freelance client", "I finished my project", "I\'m starting to learn Rust", "I moved to a new city", "I\'ve decided to focus on backend development". ' +
      'Examples that should NOT: "remind me to call mom", "what\'s the weather".',
    parameters: {
      type: "object",
      properties: {
        update_text: {
          type: "string",
          description: "The new information to add to the context, written as a clear factual statement about the user",
        },
        update_type: {
          type: "string",
          enum: ["goal", "project", "preference", "achievement", "life_change"],
          description: "Category of the update",
        },
      },
      required: ["update_text", "update_type"],
    },
  },
  {
    name: "create_tasks_batch",
    description:
      "Creates multiple tasks at once when the user wants to schedule several things in one command. " +
      "Use this instead of create_task when the user mentions 2 or more tasks in a single message. " +
      'Examples: "Set up my week", "Add gym Monday Wednesday Friday and coding Tuesday Thursday", "Schedule these meetings".',
    parameters: {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          description: "Array of tasks to create",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              taskDate: { type: "string", description: "YYYY-MM-DD. Omit to use today." },
              taskTime: { type: "string", description: "HH:MM 24h format. Omit if not given." },
              priority: { type: "string", enum: ["low", "medium", "high"], description: "Omit to use medium." },
              description: { type: "string" },
            },
            required: ["title"],
          },
        },
      },
      required: ["tasks"],
    },
  },
  {
    name: "log_mood",
    description:
      "Logs the user's mood when they express how they're feeling, mention their energy/stress/focus/sleep, or ask to record a mood entry. " +
      'Examples: "Log my mood as 4", "I\'m feeling really good today", "I\'m exhausted", "Record that I felt stressed", "Log mood: good, energy 3".',
    parameters: {
      type: "object",
      properties: {
        mood: {
          type: "integer",
          description: "Mood level 1–5 (1=Very Low, 2=Low, 3=Neutral, 4=Good, 5=Very Good)",
          minimum: 1,
          maximum: 5,
        },
        stress: { type: "integer", description: "Stress level 1–5 (optional)", minimum: 1, maximum: 5 },
        energy: { type: "integer", description: "Energy level 1–5 (optional)", minimum: 1, maximum: 5 },
        focus:  { type: "integer", description: "Focus level 1–5 (optional)", minimum: 1, maximum: 5 },
        sleep_quality: { type: "integer", description: "Sleep quality 1–5 (optional)", minimum: 1, maximum: 5 },
        reason: { type: "string", description: "Brief reason or context (optional, max 500 chars)" },
        reflection: { type: "string", description: "Longer reflection text (optional, max 5000 chars)" },
      },
      required: ["mood"],
    },
  },
  {
    name: "get_mood_summary",
    description:
      "Returns a summary of the user's recent mood data when they ask about how they've been feeling, their mood patterns, energy levels, or stress trends. " +
      'Examples: "What has my mood been like?", "How have I been feeling lately?", "Am I more stressed recently?", "What\'s my average focus?"',
    parameters: { type: "object", properties: {} },
  },
];

// ─── Tool Execution ───────────────────────────────────────────────────────────

function formatTaskList(tasks: HorizonTask[]): string {
  if (!tasks.length) return "No tasks found.";
  return tasks
    .map(
      (t) =>
        `• [${t.completed ? "DONE" : "PENDING"}] ${t.taskDate} ${t.taskTime} — ${t.title} (${t.priority} priority, id: ${t.id})`,
    )
    .join("\n");
}

// ─── Task argument normalisation ──────────────────────────────────────────────
// Gemini often omits optional fields or sends near-miss formats ("9:00",
// "17:00:00", "5 pm", "tomorrow"). Normalise instead of rejecting so a spoken
// "add X to Horizon" always lands as a task.

type NormalizedTask = {
  title: string;
  taskDate: string;
  taskTime: string;
  priority: "low" | "medium" | "high";
  description: string | null;
};

function localDateKey(d: Date): string {
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
}

function normalizeTaskDate(raw: unknown): string | null {
  const today = new Date();
  if (raw == null || String(raw).trim() === "") return localDateKey(today);
  const s = String(raw).trim().toLowerCase();
  if (s === "today" || s === "tonight") return localDateKey(today);
  if (s === "tomorrow") return localDateKey(new Date(today.getTime() + 86400000));
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return null;
}

function normalizeTaskTime(raw: unknown, taskDate: string): string | null {
  if (raw == null || String(raw).trim() === "") {
    // No time given: today → next full hour (so the reminder isn't already in
    // the past); any other day → 09:00.
    const now = new Date();
    if (taskDate !== localDateKey(now)) return "09:00";
    const nextHour = Math.min(now.getHours() + 1, 23);
    return `${String(nextHour).padStart(2, "0")}:00`;
  }
  const s = String(raw).trim().toLowerCase().replace(/\./g, "");
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? "0");
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function normalizePriority(raw: unknown): "low" | "medium" | "high" {
  const s = String(raw ?? "").trim().toLowerCase();
  if (["high", "highest", "urgent", "important", "critical"].includes(s)) return "high";
  if (["low", "lowest", "minor"].includes(s)) return "low";
  return "medium";
}

function normalizeTaskArgs(args: Record<string, unknown>): NormalizedTask | string {
  const title = String(args.title ?? "").trim();
  if (!title) return "TASK_CREATION_FAILED: No task title was given.";
  const taskDate = normalizeTaskDate(args.taskDate ?? args.date);
  if (!taskDate) return `TASK_CREATION_FAILED: I couldn't understand the date "${String(args.taskDate ?? args.date)}".`;
  const taskTime = normalizeTaskTime(args.taskTime ?? args.time, taskDate);
  if (!taskTime) return `TASK_CREATION_FAILED: I couldn't understand the time "${String(args.taskTime ?? args.time)}".`;
  const description = args.description ? String(args.description).trim() || null : null;
  return { title, taskDate, taskTime, priority: normalizePriority(args.priority), description };
}

export async function executeToolCall(
  toolName: string,
  toolArgs: Record<string, unknown>,
  sessionId: string,
): Promise<string> {
  try {
    if (toolName === "create_task") {
      const normalized = normalizeTaskArgs(toolArgs);
      if (typeof normalized === "string") return normalized;
      const { title, taskDate, taskTime, priority, description } = normalized;

      try {
        const result = await addTaskDirect({
          title,
          taskDate,
          taskTime,
          priority,
          description,
          notificationEnabled: true,
        });

        if (!result) {
          return "TASK_CREATION_FAILED: Database insert returned no result. Task was NOT created.";
        }

        // Verify by reading back from database
        const { data: verification, error: verifyError } = await supabase
          .from("horizon_tasks")
          .select("id, title, task_date, task_time, priority")
          .eq("id", result.id)
          .single();

        if (verifyError || !verification) {
          return `TASK_CREATION_FAILED: Task insert appeared to succeed but verification read failed. Task may NOT have been created. Error: ${verifyError?.message ?? "unknown"}`;
        }

        return `TASK_CREATED_SUCCESS: "${verification.title}" on ${verification.task_date} at ${verification.task_time} (${verification.priority} priority). ID: ${verification.id}`;
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown error";
        return `TASK_CREATION_FAILED: ${message}. Task was NOT created.`;
      }
    }

    if (toolName === "save_memory") {
      const content = String(toolArgs.content ?? "");
      const memory_type = String(toolArgs.memory_type ?? "general");
      const { error } = await supabase.from("jarvis_memory").insert({
        content,
        memory_type,
        source_session_id: sessionId || null,
      });
      if (error) return `Failed to save memory: ${error.message}`;
      return `Memory saved: "${content}" (type: ${memory_type}).`;
    }

    if (toolName === "get_today_tasks") {
      // CRITICAL: compute date at call time, not module load time.
      // en-CA gives YYYY-MM-DD in local timezone — never toISOString() which is UTC.
      const now = new Date();
      const todayStr = now.toLocaleDateString("en-CA"); // YYYY-MM-DD local time

      const { data, error } = await supabase
        .from("horizon_tasks")
        .select("*")
        .eq("task_date", todayStr)
        .order("task_time", { ascending: true });

      if (error || !data || data.length === 0) {
        return `No tasks found for today (${todayStr}).`;
      }

      const rows = data as Array<{
        title: string;
        task_time: string;
        priority: string;
        completed: boolean;
      }>;

      const taskList = rows
        .map(
          (t) =>
            `• ${t.title} at ${t.task_time} (${t.priority} priority)${t.completed ? " ✓" : ""}`,
        )
        .join("\n");

      return `Tasks for today (${todayStr}):\n${taskList}`;
    }

    if (toolName === "get_pending_tasks") {
      const { data, error } = await supabase
        .from("horizon_tasks")
        .select("*")
        .eq("completed", false)
        .order("task_date", { ascending: true })
        .order("task_time", { ascending: true })
        .limit(20); // prevent massive context dumps

      if (error || !data || data.length === 0) {
        return "No pending tasks found.";
      }

      const rows = data as Array<{
        task_date: string;
        task_time: string;
        title: string;
        priority: string;
      }>;

      const taskList = rows
        .map((t) => `• ${t.task_date} ${t.task_time} — ${t.title} (${t.priority})`)
        .join("\n");

      return `Pending tasks (${rows.length} total):\n${taskList}`;
    }

    if (toolName === "recall_memories") {
      const memory_type = String(toolArgs.memory_type ?? "all");
      let query = supabase
        .from("jarvis_memory")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (memory_type !== "all") {
        query = query.eq("memory_type", memory_type);
      }
      const { data, error } = await query;
      if (error) return `Failed to recall memories: ${error.message}`;
      if (!data || data.length === 0) return "No memories found.";
      const rows = data as Array<{ id: string; content: string; memory_type: string; created_at: string; recalled_count: number }>;
      const ids = rows.map((m) => m.id);
      await supabase
        .from("jarvis_memory")
        .update({ recalled_count: rows[0].recalled_count + 1, last_recalled_at: new Date().toISOString() })
        .in("id", ids)
        .then(() => null, () => null);
      return rows
        .map((m) => `• [${m.memory_type}] ${m.content} (saved ${new Date(m.created_at).toLocaleDateString()})`)
        .join("\n");
    }

    if (toolName === "delete_task") {
      const task_id = String(toolArgs.task_id ?? "");
      const { error } = await supabase.from("horizon_tasks").delete().eq("id", task_id);
      if (error) return `Failed to delete task: ${error.message}`;
      return `Task deleted successfully.`;
    }

    if (toolName === "update_task") {
      const task_id = String(toolArgs.task_id ?? "");
      const updates: Record<string, unknown> = {};
      if (toolArgs.title) updates.title = String(toolArgs.title);
      if (toolArgs.taskDate) updates.task_date = String(toolArgs.taskDate);
      if (toolArgs.taskTime) updates.task_time = String(toolArgs.taskTime);
      if (toolArgs.priority) updates.priority = String(toolArgs.priority);
      const { error } = await supabase.from("horizon_tasks").update(updates).eq("id", task_id);
      if (error) return `Failed to update task: ${error.message}`;
      return `Task updated successfully.`;
    }

    if (toolName === "update_user_context") {
      const { update_text, update_type } = toolArgs as {
        update_text: string;
        update_type: string;
      };

      try {
        const existing = localStorage.getItem("jarvis:user-context") ?? "";
        const timestamp = new Date().toLocaleDateString("en-CA");
        const newEntry = `[${timestamp}] ${update_text}`;

        // Guard against near-duplicate entries — check first 30 chars of the new text
        if (
          update_text.length >= 10 &&
          existing.toLowerCase().includes(update_text.toLowerCase().slice(0, 30))
        ) {
          return "Context already contains similar information. No update needed.";
        }

        const updated = existing ? `${existing}\n${newEntry}` : newEntry;
        localStorage.setItem("jarvis:user-context", updated);

        // Signal handleCommand to inject a silent UI notification
        _pendingContextUpdate = { updateType: update_type, updateText: update_text };
        return `CONTEXT_UPDATED:${update_type}:${update_text}`;
      } catch {
        return "Failed to update context.";
      }
    }

    if (toolName === "create_tasks_batch") {
      const rawTasks = Array.isArray(toolArgs.tasks) ? (toolArgs.tasks as Record<string, unknown>[]) : [];
      if (rawTasks.length === 0) {
        return "TASK_CREATION_FAILED: No tasks provided.";
      }

      const valid: NormalizedTask[] = [];
      let invalid = 0;
      for (const raw of rawTasks) {
        const n = normalizeTaskArgs(raw ?? {});
        if (typeof n === "string") invalid++;
        else valid.push(n);
      }

      const { created, failed } = valid.length
        ? await addJarvisTasksBatch(valid.map((t) => ({ ...t, description: t.description ?? undefined })))
        : { created: 0, failed: 0 };
      const totalFailed = failed + invalid;

      if (created === 0) {
        return "TASK_CREATION_FAILED: None of the tasks could be saved to Horizon.";
      }
      if (totalFailed === 0) {
        return `TASK_CREATED_SUCCESS: Created ${created} task${created > 1 ? "s" : ""}.`;
      }
      return `TASK_CREATED_PARTIAL: Created ${created} task${created > 1 ? "s" : ""}, but ${totalFailed} could not be saved — check your Horizon page.`;
    }

    if (toolName === "log_mood") {
      const raw = toolArgs as {
        mood?: unknown;
        stress?: unknown;
        energy?: unknown;
        focus?: unknown;
        sleep_quality?: unknown;
        reason?: unknown;
        reflection?: unknown;
      };

      const moodVal = Math.max(1, Math.min(5, Math.round(Number(raw.mood ?? 3)))) as 1 | 2 | 3 | 4 | 5;
      const stressVal = raw.stress != null ? Math.max(1, Math.min(5, Math.round(Number(raw.stress)))) : null;
      const energyVal = raw.energy != null ? Math.max(1, Math.min(5, Math.round(Number(raw.energy)))) : null;
      const focusVal  = raw.focus  != null ? Math.max(1, Math.min(5, Math.round(Number(raw.focus))))  : null;
      const sleepVal  = raw.sleep_quality != null ? Math.max(1, Math.min(5, Math.round(Number(raw.sleep_quality)))) : null;
      const reason     = raw.reason     ? String(raw.reason).slice(0, 500)    : null;
      const reflection = raw.reflection ? String(raw.reflection).slice(0, 5000) : null;

      const cfg = MOOD_CONFIG[moodVal];
      const entry = await addMoodEntryDirect({
        mood: moodVal,
        moodLabel: cfg.label,
        stress: stressVal,
        energy: energyVal,
        focus: focusVal,
        sleepQuality: sleepVal,
        reason,
        reflection,
      });

      if (!entry) return "Failed to log mood — database error.";

      const parts = [`Mood logged: ${moodVal}/5 (${cfg.label}).`];
      if (energyVal != null) parts.push(`Energy: ${energyVal}.`);
      if (focusVal  != null) parts.push(`Focus: ${focusVal}.`);
      if (stressVal != null) parts.push(`Stress: ${stressVal}.`);
      if (sleepVal  != null) parts.push(`Sleep: ${sleepVal}.`);
      return parts.join(" ");
    }

    if (toolName === "get_mood_summary") {
      const entries = getMoodEntries();
      if (!entries.length) {
        return "No mood entries found yet. Log your first mood in the Mood section.";
      }
      return buildMoodContext(entries);
    }

    return `Unknown tool: ${toolName}`;
  } catch (err) {
    console.error(`[executeToolCall] ${toolName} error:`, err);
    return `Tool execution failed: ${String(err)}`;
  }
}

// ─── Tool result → spoken text ────────────────────────────────────────────────

function isToolFailure(result: string): boolean {
  return /FAILED|^(Failed|Tool execution failed)/i.test(result);
}

function describeToolFailure(
  failure: string,
  results: Array<{ name: string; result: string }>,
): string {
  const reason = failure
    .replace(/^TASK_CREATION_FAILED:\s*/i, "")
    .replace(/\s*Task was NOT created\.?$/i, "")
    .trim();
  const createdCount = results.filter((r) => r.result.startsWith("TASK_CREATED_SUCCESS")).length;
  const prefix = createdCount > 0 ? `I added ${createdCount} task${createdCount > 1 ? "s" : ""}, but one failed. ` : "";
  if (/^TASK_CREATION_FAILED/i.test(failure)) {
    return `${prefix}I wasn't able to add that task to Horizon — ${reason || "the save failed"}. Please try again or add it manually in Horizon.`;
  }
  return `${prefix}That didn't work — ${reason || "the action failed"}.`;
}

// Tools whose result is just "it worked" — confirmed without a second model call.
const ACTION_TOOLS: ReadonlySet<string> = new Set([
  "create_task",
  "create_tasks_batch",
  "save_memory",
  "delete_task",
  "update_task",
  "update_user_context",
  "log_mood",
]);

function spokenDate(dateKey: string): string {
  const today = localDateKey(new Date());
  const tomorrow = localDateKey(new Date(Date.now() + 86400000));
  if (dateKey === today) return "today";
  if (dateKey === tomorrow) return "tomorrow";
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const sameYear = y === new Date().getFullYear();
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function spokenTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function describeToolSuccess(results: Array<{ name: string; result: string }>): string {
  const created = results
    .map(({ result }) => result.match(/^TASK_CREATED_SUCCESS: "(.+)" on (\S+) at (\d{1,2}:\d{2})/))
    .filter((m): m is RegExpMatchArray => m !== null);
  const others = results.filter(({ result }) => !/^TASK_CREATED_SUCCESS: "/.test(result));

  const lines: string[] = [];
  if (created.length === 1) {
    const [, title, date, time] = created[0];
    lines.push(`Done. I've added "${title}" to Horizon for ${spokenDate(date)} at ${spokenTime(time)}.`);
  } else if (created.length > 1) {
    lines.push(`Done. I've added ${created.length} tasks to Horizon: ${created.map((m) => `"${m[1]}"`).join(", ")}.`);
  }
  for (const { result } of others) {
    lines.push(
      result
        .replace(/^TASK_CREATED_(SUCCESS|PARTIAL):\s*/, "Done. ")
        .replace(/^CONTEXT_UPDATED:[^:]*:\s*/, "Noted — ")
        .replace(/^Memory saved: "(.+)" \(type: \w+\)\.$/, "Got it, I'll remember that $1."),
    );
  }
  return lines.join(" ");
}

// ─── Context builder ──────────────────────────────────────────────────────────

function buildContextString(ctx: UserContext): string {
  const parts: string[] = [];

  if (ctx.websites?.length) {
    parts.push(
      "\n\n## Saved AI Tools & Websites\n" +
        ctx.websites
          .map(
            (s, i) =>
              `${i + 1}. **${s.name}** (${s.url})\n   ${s.description}${s.tags.length ? `\n   Tags: ${s.tags.join(", ")}` : ""}`,
          )
          .join("\n"),
    );
  }

  if (ctx.prompts?.length) {
    parts.push(
      "\n\n## Saved Prompts\n" +
        ctx.prompts.map((p, i) => `${i + 1}. **${p.title}**\n   ${p.body}`).join("\n"),
    );
  }

  if (ctx.links?.length) {
    parts.push(
      "\n\n## Saved Links\n" +
        ctx.links
          .map((l, i) => `${i + 1}. ${l.name} — ${l.url}${l.description ? ` (${l.description})` : ""}`)
          .join("\n"),
    );
  }

  if (ctx.messages?.length) {
    parts.push(
      "\n\n## Important Messages / Reminders\n" +
        ctx.messages
          .map((m, i) => `${i + 1}. [${m.time}] ${m.motive}: ${m.message}`)
          .join("\n"),
    );
  }

  if (ctx.folders?.length) {
    parts.push(
      "\n\n## Desktop Folders\n" +
        ctx.folders.map((f) => `• ${f.name} (${f.items.length} items)`).join("\n"),
    );
  }

  return parts.join("");
}

// ─── Search type classifier ───────────────────────────────────────────────────

function classifySearchType(responseText: string, userQuery: string): SearchType {
  void responseText;
  const q = userQuery.toLowerCase();

  if (/weather|temperature|rain|forecast|humid|°/.test(q)) return "weather";
  if (/news|latest|today|happened|update|current events/.test(q)) return "news";
  if (/\bvs\b|versus|compare|difference|better|which is/.test(q)) return "comparison";
  if (/how to|how do|steps|guide|tutorial|setup/.test(q)) return "howto";
  // Anchored definition check runs before general fallback
  if (/^what is\b|^what are\b|^who is\b|^who are\b|define\b|meaning of\b|explain\b/.test(q)) return "definition";
  if (/near me|nearby|restaurant|hotel|place|location|where/.test(q)) return "local";
  if (/code|error|bug|function|syntax|javascript|python|react/.test(q)) return "code";
  if (/calculate|percent|formula|math|equation|\d+\s*[+\-*/]/.test(q)) return "math";

  return "general";
}

// ─── Code execution tool ──────────────────────────────────────────────────────

export const CODE_EXECUTION_TOOL = { codeExecution: {} } as const;

// ─── Sentence chunker (for streaming TTS) ────────────────────────────────────

export class SentenceChunker {
  private buffer = "";

  push(token: string): string[] {
    this.buffer += token;
    const sentences: string[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const regex = /[.!?](\s+|$)/g;
    while ((match = regex.exec(this.buffer)) !== null) {
      const sentence = this.buffer.slice(lastIndex, match.index + 1).trim();
      if (sentence.length > 0) sentences.push(sentence);
      lastIndex = match.index + match[0].length;
    }
    this.buffer = this.buffer.slice(lastIndex);
    return sentences;
  }

  flush(): string[] {
    const remainder = this.buffer.trim();
    this.buffer = "";
    return remainder.length > 0 ? [remainder] : [];
  }

  reset(): void {
    this.buffer = "";
  }
}

// ─── Deep thinking detector ───────────────────────────────────────────────────

const THINKING_TRIGGERS = [
  /should i\b/i,
  /what do you think about\b/i,
  /help me (plan|decide|figure out|think through)\b/i,
  /\badvice\b/i,
  /best (way|approach|strategy)\b/i,
  /pros and cons\b/i,
  /\bcompare\b/i,
  /explain (why|how)\b/i,
  /what would (happen|you recommend)\b/i,
];

export function requiresDeepThinking(message: string): boolean {
  return THINKING_TRIGGERS.some((p) => p.test(message));
}

// ─── Code execution detector ──────────────────────────────────────────────────

const CODE_TRIGGERS = [
  /\bcalculate\b/i,
  /\bcompute\b/i,
  /\d+\s*[+\-*/]\s*\d+/,
  /percent(age)?\b/i,
  /\bhow many\b/i,
  /\bsort\b/i,
  /\bconvert\b/i,
  /\bformula\b/i,
];

export function requiresCodeExecution(message: string): boolean {
  return CODE_TRIGGERS.some((p) => p.test(message));
}

// ─── Context cache manager ────────────────────────────────────────────────────

interface CachedContext {
  cacheId: string;
  createdAt: number;
  expiresAt: number;
  systemPrompt: string;
}

class CacheManager {
  private cache: CachedContext | null = null;
  private readonly TTL_MS = 60 * 60 * 1000; // 1 hour

  isValid(systemPrompt: string): boolean {
    if (!this.cache) return false;
    if (Date.now() > this.cache.expiresAt) return false;
    if (this.cache.systemPrompt !== systemPrompt) return false;
    return true;
  }

  getCacheId(): string | null {
    if (!this.cache || Date.now() > this.cache.expiresAt) return null;
    return this.cache.cacheId;
  }

  set(cacheId: string, systemPrompt: string): void {
    this.cache = {
      cacheId,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.TTL_MS,
      systemPrompt,
    };
  }

  invalidate(): void {
    this.cache = null;
  }
}

const cacheManager = new CacheManager();

// ─── Pending context update notification ──────────────────────────────────────
// Set by executeToolCall when update_user_context fires.
// Cleared atomically by takePendingContextUpdate in handleCommand.

type PendingContextUpdate = { updateType: string; updateText: string };
let _pendingContextUpdate: PendingContextUpdate | null = null;

export function takePendingContextUpdate(): PendingContextUpdate | null {
  const update = _pendingContextUpdate;
  _pendingContextUpdate = null;
  return update;
}

// ─── API class ────────────────────────────────────────────────────────────────

class GeminiAPI {
  private readonly primaryKey: string;
  private readonly fallbackKey: string;
  private readonly baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";
  private cachingUnavailable = false;

  constructor() {
    this.primaryKey = import.meta.env.VITE_GEMINI_API_KEY ?? "";
    this.fallbackKey = import.meta.env.VITE_GEMINI_API_KEY_2 ?? "";

    if (!this.primaryKey)
      console.warn("[Gemini] Primary API key (VITE_GEMINI_API_KEY) not configured.");
    if (!this.fallbackKey)
      console.warn("[Gemini] Fallback key (VITE_GEMINI_API_KEY_2) not configured — single-key mode.");
  }

  private async _request(
    apiKey: string,
    body: GeminiRequest,
  ): Promise<{ ok: boolean; text: string; status: number }> {
    try {
      const res = await fetch(
        `${this.baseUrl}/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        console.error("[Gemini] HTTP error:", err);
        return {
          ok: false,
          text:
            HTTP_ERRORS[res.status] ??
            `API error (${res.status}): ${err.error?.message ?? "Unknown error"}`,
          status: res.status,
        };
      }

      const data: GeminiResponse = await res.json();
      const text = (data.candidates?.[0]?.content?.parts ?? [])
        .map((p) => ("text" in p ? p.text : ""))
        .join("")
        .trim();
      return { ok: true, text: text || "No response received.", status: 200 };
    } catch (err) {
      console.error("[Gemini] Network error:", err);
      return {
        ok: false,
        text: "Failed to reach Gemini. Please check your internet connection.",
        status: 0,
      };
    }
  }

  private async _rawRequest(
    apiKey: string,
    body: GeminiRequest,
    signal?: AbortSignal,
    thinkingBudget = 0,
  ): Promise<{ ok: boolean; data: GeminiResponse | null; status: number }> {
    try {
      // Inject context cache (removes systemInstruction if cache hit).
      // The API rejects cachedContent combined with tools (400), and the cached
      // prompt must match this request's prompt exactly — otherwise skip it.
      const cacheId =
        !body.tools && cacheManager.isValid(body.systemInstruction?.parts?.[0]?.text ?? "")
          ? cacheManager.getCacheId()
          : null;
      const cachedBody: GeminiRequest = cacheId
        ? { ...body, cachedContent: cacheId, systemInstruction: undefined }
        : body;

      // Inject thinking config when budget is non-zero
      const finalBody: GeminiRequest =
        thinkingBudget > 0
          ? {
              ...cachedBody,
              generationConfig: {
                ...cachedBody.generationConfig,
                thinkingConfig: { thinkingBudget },
              },
            }
          : cachedBody;

      const res = await fetch(
        `${this.baseUrl}/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalBody),
          signal,
        },
      );

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        console.error("[Gemini] HTTP error:", err);
        return { ok: false, data: null, status: res.status };
      }

      const data: GeminiResponse = await res.json();
      return { ok: true, data, status: 200 };
    } catch (err) {
      console.error("[Gemini] Network error:", err);
      return { ok: false, data: null, status: 0 };
    }
  }

  async generateContent(
    prompt: string,
    conversationHistory: GeminiMessage[] = [],
    userContext?: UserContext,
  ): Promise<string> {
    if (!this.primaryKey && !this.fallbackKey) return "API key not configured.";

    const isFirstTurn = conversationHistory.length === 0;

    const userText =
      isFirstTurn && userContext
        ? `You are Jarvis — a sharp, concise AI assistant embedded in the user's personal AI Metrics workspace. You know everything about the user's saved tools, prompts, links, and reminders. Be direct and helpful.${buildContextString(userContext)}\n\n---\n\nUser: ${prompt}`
        : prompt;

    const body: GeminiRequest = {
      contents: [
        ...conversationHistory,
        { role: "user", parts: [{ text: userText }] },
      ],
      generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 8192 },
    };

    if (this.primaryKey) {
      const result = await this._request(this.primaryKey, body);
      if (result.ok) return result.text;
      const isSwitchableError = result.status === 429 || result.status === 403;
      if (isSwitchableError && this.fallbackKey) {
        console.warn("[Gemini] Primary key failed — retrying with fallback.");
        const fb = await this._request(this.fallbackKey, body);
        return fb.text;
      }
      return result.text;
    }

    if (this.fallbackKey) {
      const result = await this._request(this.fallbackKey, body);
      return result.text;
    }

    return "API key not configured.";
  }

  async generateWithTools(
    messages: GeminiMessage[],
    systemPrompt: string,
    sessionId: string,
    thinkingBudget = 0,
    overrideTools?: Array<
      | { functionDeclarations?: unknown[] }
      | { codeExecution?: Record<string, never> }
    >,
  ): Promise<string> {
    if (!this.primaryKey && !this.fallbackKey) return "API key not configured.";

    const tools = overrideTools ?? [{ functionDeclarations: JARVIS_TOOLS }];

    const body: GeminiRequest = {
      contents: messages,
      tools,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 8192 },
    };

    const tryRaw = async (key: string) =>
      this._rawRequest(key, body, undefined, thinkingBudget);

    const requestOnce = async () => {
      let r = this.primaryKey ? await tryRaw(this.primaryKey) : null;
      if (!r?.ok && this.fallbackKey) {
        console.warn("[Gemini] Primary key failed — retrying with fallback.");
        r = await tryRaw(this.fallbackKey);
      }
      return r;
    };

    let raw = await requestOnce();
    // gemini-2.5-flash intermittently returns a candidate with no parts at all
    // (finishReason STOP, zero output tokens). One retry almost always succeeds.
    if (raw?.ok && !raw.data?.candidates?.[0]?.content?.parts?.length) {
      console.warn("[Gemini] Empty response — retrying once.");
      raw = await requestOnce();
    }

    if (raw?.status === 429) {
      return "Gemini is rate-limiting me right now, so I couldn't do that. Give it a few seconds and try again.";
    }
    if (!raw?.ok || !raw.data) return "I encountered an error processing that request.";

    const candidate = raw.data.candidates?.[0];
    if (!candidate) return "No response received.";

    const parts = candidate.content?.parts ?? [];
    if (parts.length === 0) return "Sorry, I didn't catch a response there. Please say that again.";

    const functionCallParts = parts.filter(
      (p): p is { functionCall: { name: string; args: Record<string, unknown> } } =>
        "functionCall" in p && Boolean(p.functionCall),
    );
    const codeResultPart = parts.find(
      (p): p is { codeExecutionResult: { outcome: string; output: string } } =>
        "codeExecutionResult" in p,
    );
    const textPart = parts.find((p): p is { text: string } => "text" in p);

    if (functionCallParts.length > 0) {
      // Execute every call — Gemini emits parallel calls for "add X and Y".
      const results: Array<{ name: string; result: string }> = [];
      for (const part of functionCallParts) {
        const { name, args } = part.functionCall;
        const result = await executeToolCall(name, (args ?? {}) as Record<string, unknown>, sessionId);
        results.push({ name, result });
      }

      // A tool failure is authoritative. Do not give the model a chance to turn
      // it into a friendly-but-false confirmation.
      const failure = results.find((r) => isToolFailure(r.result));
      if (failure) return describeToolFailure(failure.result, results);

      // Pure actions (create task, save memory…) are confirmed locally — a
      // second Gemini call only adds latency and doubles free-tier quota use.
      // Read tools (get_today_tasks…) still need the model to speak the data.
      if (results.every((r) => ACTION_TOOLS.has(r.name))) return describeToolSuccess(results);

      const followUpBody: GeminiRequest = {
        contents: [
          ...messages,
          { role: "model", parts: functionCallParts },
          {
            role: "user",
            parts: results.map(({ name, result }) => ({
              functionResponse: { name, response: { result } },
            })),
          },
        ],
        // Tools must still be declared for the history's functionCall turn,
        // but the model may not call another one — it only confirms.
        tools,
        toolConfig: { functionCallingConfig: { mode: "NONE" } },
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 1024 },
      };

      for (const key of [this.primaryKey, this.fallbackKey]) {
        if (!key) continue;
        const finalResult = await this._request(key, followUpBody);
        if (finalResult.ok && finalResult.text !== "No response received.") return finalResult.text;
      }

      // The action already succeeded — never report an API hiccup as an error.
      return describeToolSuccess(results);
    }

    // Code execution result — append output to any text response
    if (codeResultPart) {
      const output = codeResultPart.codeExecutionResult.output;
      const base = textPart?.text ?? "";
      return output
        ? base
          ? `${base}\n\nResult: ${output}`
          : `Result: ${output}`
        : base || "No response received.";
    }

    // ── Text-fallback tool call parser ──────────────────────────────────────────
    // Gemini occasionally writes tool calls as plain text instead of using the
    // function calling API — e.g. "create_task(title='X', date='Y', ...)".
    // This catches that pattern, parses the args, and executes them so the task
    // actually lands in Horizon rather than appearing as raw text in the chat.
    if (textPart?.text) {
      const text = textPart.text.trim();
      const textToolMatch = text.match(/^(\w+)\((.+)\)\s*$/s);
      if (textToolMatch) {
        const toolName = textToolMatch[1];
        const knownTools = new Set(JARVIS_TOOLS.map((t) => t.name));
        if (knownTools.has(toolName)) {
          // Parse key=value pairs — handles 'string', "string", and numeric values
          const rawArgs: Record<string, unknown> = {};
          const argStr = textToolMatch[2];
          const argRegex = /(\w+)\s*=\s*(?:'([^']*)'|"([^"]*)"|(-?\d+(?:\.\d+)?))/g;
          let m: RegExpExecArray | null;
          while ((m = argRegex.exec(argStr)) !== null) {
            const key = m[1];
            const val = m[2] ?? m[3] ?? (m[4] !== undefined ? Number(m[4]) : undefined);
            if (val !== undefined) rawArgs[key] = val;
          }

          // Normalise param name aliases Gemini sometimes gets wrong.
          // Tool schema uses taskDate/taskTime; model may write date/time.
          if ("date" in rawArgs && !("taskDate" in rawArgs)) rawArgs.taskDate = rawArgs.date;
          if ("time" in rawArgs && !("taskTime" in rawArgs)) rawArgs.taskTime = rawArgs.time;

          console.warn(
            `[Gemini] Text-fallback: intercepted "${toolName}()" written as plain text — executing now.`,
          );
          const toolResult = await executeToolCall(toolName, rawArgs, sessionId);
          const results = [{ name: toolName, result: toolResult }];

          if (isToolFailure(toolResult)) return describeToolFailure(toolResult, results);
          if (ACTION_TOOLS.has(toolName)) return describeToolSuccess(results);

          // Give model one shot to generate a natural confirmation
          const followUpHistory: GeminiMessage[] = [
            ...messages,
            { role: "model", parts: [{ text }] },
            { role: "user", parts: [{ text: `Tool result: ${toolResult}` }] },
          ];
          const followUpBody: GeminiRequest = {
            contents: followUpHistory,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 1024 },
          };
          const key = this.primaryKey || this.fallbackKey;
          if (key) {
            const finalResult = await this._request(key, followUpBody);
            if (finalResult.ok && finalResult.text !== "No response received.") return finalResult.text;
          }
          return describeToolSuccess(results);
        }
      }
      return text;
    }

    return "No response received.";
  }

  async generateWithSearch(
    messages: GeminiMessage[],
    systemPrompt: string,
  ): Promise<{ text: string; sources: SearchSource[]; searchType: SearchType }> {
    const fallback = { text: "API key not configured.", sources: [] as SearchSource[], searchType: "general" as SearchType };
    if (!this.primaryKey && !this.fallbackKey) return fallback;

    const body: GeminiRequest = {
      contents: messages,
      tools: [{ googleSearch: {} }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { temperature: 0.5, topK: 40, topP: 0.95, maxOutputTokens: 4096 },
    };

    // 25-second hard timeout — search grounding requests can hang
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    let raw: { ok: boolean; data: GeminiResponse | null; status: number } | null = null;
    try {
      raw = this.primaryKey
        ? await this._rawRequest(this.primaryKey, body, controller.signal)
        : null;
      if (!raw?.ok && this.fallbackKey) {
        console.warn("[Gemini] Primary key failed for search — retrying with fallback.");
        raw = await this._rawRequest(this.fallbackKey, body, controller.signal);
      }
      clearTimeout(timeout);
    } catch (err) {
      clearTimeout(timeout);
      if ((err as Error).name === "AbortError") {
        return { text: "Search request timed out. Try a shorter query.", sources: [], searchType: "general" };
      }
      throw err;
    }

    if (!raw?.ok || !raw.data) {
      return { text: "I encountered an error searching for that.", sources: [], searchType: "general" };
    }

    const candidate = raw.data.candidates?.[0];
    if (!candidate) return { text: "No search results received.", sources: [], searchType: "general" };

    const textPart = candidate.content.parts?.find((p) => "text" in p && p.text);
    const text = (textPart && "text" in textPart ? textPart.text : "") || "No results found.";

    const sources: SearchSource[] = (candidate.groundingMetadata?.groundingChunks ?? [])
      .filter((chunk) => chunk.web?.uri)
      .map((chunk) => ({
        title: chunk.web?.title ?? "",
        url: chunk.web?.uri ?? "",
        snippet: "",
      }));

    const userQuery = messages[messages.length - 1]?.parts?.find((p) => "text" in p && p.text);
    const queryText = (userQuery && "text" in userQuery ? userQuery.text : "") ?? "";
    const searchType = classifySearchType(text, queryText);

    return { text, sources, searchType };
  }

  // ─── Streaming ───────────────────────────────────────────────────────────────

  async *streamGenerate(
    messages: GeminiMessage[],
    systemPrompt: string,
    tools?: Array<
      | { functionDeclarations?: unknown[] }
      | { codeExecution?: Record<string, never> }
    >,
  ): AsyncGenerator<string, void, unknown> {
    if (!this.primaryKey && !this.fallbackKey) return;

    if (this.primaryKey) {
      try {
        yield* this._streamWithKey(messages, systemPrompt, this.primaryKey, tools);
        return;
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (this.fallbackKey && (status === 429 || status === 403)) {
          console.warn("[Gemini] Primary key failed for streaming — retrying with fallback.");
          yield* this._streamWithKey(messages, systemPrompt, this.fallbackKey, tools);
          return;
        }
        throw err;
      }
    }

    yield* this._streamWithKey(messages, systemPrompt, this.fallbackKey!, tools);
  }

  private async *_streamWithKey(
    messages: GeminiMessage[],
    systemPrompt: string,
    apiKey: string,
    tools?: Array<
      | { functionDeclarations?: unknown[] }
      | { codeExecution?: Record<string, never> }
    >,
  ): AsyncGenerator<string, void, unknown> {
    const url = `${this.baseUrl}/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`;

    const payload = {
      contents: messages,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      ...(tools && tools.length > 0 ? { tools } : {}),
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: 0 }, // disable thinking for streaming — adds latency
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = Object.assign(
        new Error(`Gemini streaming error: ${response.status}`),
        { status: response.status },
      );
      throw err;
    }

    if (!response.body) throw new Error("Streaming response has no body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") return;

          try {
            const parsed: GeminiStreamChunk = JSON.parse(data) as GeminiStreamChunk;
            const text = parsed.candidates?.[0]?.content?.parts?.find(
              (p): p is { text: string } =>
                "text" in p && typeof (p as { text?: unknown }).text === "string",
            )?.text;

            if (text) yield text;
          } catch {
            // Malformed SSE chunk — skip
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ─── Context caching ─────────────────────────────────────────────────────────

  async initContextCache(systemPrompt: string): Promise<void> {
    if (this.cachingUnavailable) return;
    if (cacheManager.isValid(systemPrompt)) return;
    const apiKey = this.primaryKey;
    if (!apiKey) return;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/cachedContents?key=${apiKey}`;
      const payload = {
        model: "models/gemini-2.5-flash",
        systemInstruction: { parts: [{ text: systemPrompt }] },
        ttl: "3600s",
      };
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        // Free-tier keys have a cache quota of 0 (429), and short prompts are
        // below the minimum size (400). Don't spend a request on every mount.
        if (response.status === 429 || response.status === 400 || response.status === 403) {
          this.cachingUnavailable = true;
        }
        return;
      }
      const data = (await response.json()) as { name?: string };
      const cacheId = data.name ?? null;
      if (cacheId) {
        cacheManager.set(cacheId, systemPrompt);
        console.log("[JARVIS] Context cached — token usage reduced");
      }
    } catch {
      // Cache creation failure is silent — fall back to full system prompt
    }
  }

  get configured(): boolean {
    return Boolean(this.primaryKey || this.fallbackKey);
  }
}

export const geminiAPI = new GeminiAPI();
