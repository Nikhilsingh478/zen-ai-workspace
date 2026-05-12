/**
 * Voice Commander — parses speech into executable actions.
 *
 * Priority order:
 *   1. Local route commands (instant, no AI)
 *   2. Task creation intent → Gemini structured-JSON extraction → real Supabase insert
 *      Supports MULTIPLE tasks in a single command (e.g. "schedule lunch at 1pm and
 *      cricket at 5:30pm and dinner at 8pm and sleep at 11pm").
 *   3. General AI query via Gemini (schedule awareness included)
 *
 * NEVER hallucinate task success. If insert fails, say so explicitly.
 */

import { geminiAPI } from "@/lib/gemini";
import { supabase } from "@/lib/supabase";
import type { HorizonTask } from "@/lib/horizon";
import { formatDateKey } from "@/lib/horizon";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CommandResult =
  | { type: "navigate"; route: string; label: string }
  | { type: "ai"; text: string }
  | { type: "error"; text: string };

interface TaskExtraction {
  isTask: boolean;
  tasks: SingleTask[];
}

interface SingleTask {
  title: string;
  description: string;
  date: string;
  time: string;
  priority: "low" | "medium" | "high";
}

// ─── Route commands ───────────────────────────────────────────────────────────

const ROUTE_MAP: { keywords: string[]; route: string; label: string }[] = [
  { keywords: ["calendar", "schedule", "timeline"], route: "/horizon", label: "Horizon" },
  { keywords: ["ask", "chat", "ai assistant"], route: "/ask", label: "Ask" },
  { keywords: ["desktop", "launcher", "apps"], route: "/desktop", label: "Desktop" },
  { keywords: ["prompts", "prompt library"], route: "/prompts", label: "Prompts" },
  { keywords: ["links", "link board"], route: "/links", label: "Links" },
  { keywords: ["images", "image board", "photos"], route: "/images", label: "Images" },
  { keywords: ["messages", "notes"], route: "/messages", label: "Messages" },
  { keywords: ["insights", "analytics", "stats"], route: "/insights", label: "Insights" },
  { keywords: ["websites", "tools", "directory", "home"], route: "/", label: "Websites" },
];

const NAV_VERBS = ["open", "go to", "show", "take me to", "navigate to", "switch to", "launch"];

function parseRouteCommand(text: string): CommandResult | null {
  const lower = text.toLowerCase().trim();
  const hasNavVerb = NAV_VERBS.some((v) => lower.includes(v));

  for (const entry of ROUTE_MAP) {
    const matches = entry.keywords.some((kw) => lower.includes(kw));
    if (matches && (hasNavVerb || lower === entry.keywords[0])) {
      return { type: "navigate", route: entry.route, label: entry.label };
    }
  }
  return null;
}

// ─── Task creation intent detection ──────────────────────────────────────────

const TASK_INTENT_KEYWORDS = [
  "remind me",
  "add task",
  "create task",
  "schedule",
  "set a reminder",
  "add a reminder",
  "set reminder",
  "add to horizon",
  "put it in horizon",
  "task for",
  "appointment",
  "meeting at",
  "don't let me forget",
  "make a note",
  "add an event",
  "block time",
  "add event",
  "set up my schedule",
  "plan my day",
  "add to my schedule",
];

function isTaskCreationIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return TASK_INTENT_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── Task extraction via Gemini (strict JSON, supports multiple tasks) ─────────

async function extractAndCreateTasks(text: string): Promise<CommandResult> {
  const today = new Date();
  const todayStr = formatDateKey(today);
  const todayReadable = today.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const extractionPrompt =
    `Today is ${todayReadable} (${todayStr}). ` +
    `Extract ALL task details from the following voice command. ` +
    `The command may contain MULTIPLE tasks — extract every single one of them. ` +
    `Respond with ONLY a valid JSON object and absolutely nothing else — no markdown, no explanation, no code fences.\n\n` +
    `JSON schema:\n` +
    `{\n` +
    `  "isTask": boolean,\n` +
    `  "tasks": [\n` +
    `    {\n` +
    `      "title": string,\n` +
    `      "description": string,\n` +
    `      "date": "YYYY-MM-DD",\n` +
    `      "time": "HH:MM",\n` +
    `      "priority": "low" | "medium" | "high"\n` +
    `    }\n` +
    `  ]\n` +
    `}\n\n` +
    `Rules:\n` +
    `- If this is clearly a task/reminder/meeting/appointment request, set isTask: true.\n` +
    `- Extract EVERY task mentioned — there may be 1 or many.\n` +
    `- date must be a real calendar date in YYYY-MM-DD format relative to today (${todayStr}).\n` +
    `- "tomorrow" = ${formatDateKey(new Date(today.getTime() + 86400000))}.\n` +
    `- time must be in 24-hour HH:MM format. If unspecified, use "09:00".\n` +
    `- priority: use "high" for urgent/important words, "low" for casual, "medium" otherwise.\n` +
    `- If no tasks, set isTask: false and tasks: [].\n` +
    `- description can be empty string if nothing extra was said.\n\n` +
    `Voice command: "${text}"`;

  console.log("[jarvis] extracting tasks from:", text);

  let raw: string;
  try {
    raw = await geminiAPI.generateContent(extractionPrompt);
  } catch (err) {
    console.error("[jarvis] Gemini extraction error:", err);
    return { type: "error", text: "I couldn't reach the AI to parse your request. Please try again." };
  }

  // Strip markdown code fences if Gemini ignores instructions
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  let parsed: TaskExtraction;
  try {
    parsed = JSON.parse(cleaned) as TaskExtraction;
  } catch {
    console.error("[jarvis] JSON parse failed. Raw response:", raw);
    return {
      type: "ai",
      text: "I understood you but had trouble parsing the details. Try saying it more clearly, like: 'remind me tomorrow at 3 PM to call John'.",
    };
  }

  if (!parsed.isTask || !Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
    return {
      type: "ai",
      text: "I'm not sure what task to create. Try saying something like 'remind me tomorrow at 4 PM to send the invoice'.",
    };
  }

  const validTasks = parsed.tasks.filter(
    (t) => t.title?.trim() && t.date && /^\d{4}-\d{2}-\d{2}$/.test(t.date),
  );

  if (validTasks.length === 0) {
    return {
      type: "ai",
      text: "I couldn't determine valid tasks from that. Please specify what and when.",
    };
  }

  // ── Bulk Supabase insert ─────────────────────────────────────────────────
  const rows = validTasks.map((t) => {
    const timeValid = /^\d{2}:\d{2}$/.test(t.time ?? "");
    const time = timeValid ? t.time : "09:00";
    const priority: "low" | "medium" | "high" =
      t.priority === "low" || t.priority === "high" ? t.priority : "medium";

    return {
      title:                t.title.trim(),
      description:          t.description?.trim() || null,
      task_date:            t.date,
      task_time:            time,
      priority,
      notification_enabled: false,
      completed:            false,
    };
  });

  console.log("[jarvis] inserting", rows.length, "task(s) →", rows.map((r) => `${r.title} @ ${r.task_time} on ${r.task_date}`));

  try {
    const { error } = await supabase.from("horizon_tasks").insert(rows);
    if (error) throw error;

    console.log("[jarvis]", rows.length, "task(s) created ✓");

    // ── Build human-readable confirmation ───────────────────────────────
    const todayKey = todayStr;
    const tomorrowKey = formatDateKey(new Date(today.getTime() + 86400000));

    if (rows.length === 1) {
      const r = rows[0];
      const [h, m] = r.task_time.split(":").map(Number);
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 === 0 ? 12 : h % 12;
      const timeStr = `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
      const dateStr =
        r.task_date === todayKey ? "today" :
        r.task_date === tomorrowKey ? "tomorrow" :
        (() => {
          const [y, mo, d] = r.task_date.split("-").map(Number);
          return new Date(y, mo - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
        })();
      return {
        type: "ai",
        text: `Done. I added "${r.title}" for ${dateStr} at ${timeStr}.`,
      };
    }

    // Multiple tasks — read them all back
    const taskList = rows.map((r) => {
      const [h, m] = r.task_time.split(":").map(Number);
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 === 0 ? 12 : h % 12;
      const timeStr = `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
      return `${r.title} at ${timeStr}`;
    });

    const lastItem = taskList.pop()!;
    const listStr = taskList.length > 0
      ? taskList.join(", ") + ", and " + lastItem
      : lastItem;

    // Determine shared date label (if all on same day)
    const allSameDate = rows.every((r) => r.task_date === rows[0].task_date);
    let dateLabel = "";
    if (allSameDate) {
      const d = rows[0].task_date;
      dateLabel = d === todayKey ? " for today" :
        d === tomorrowKey ? " for tomorrow" :
        (() => {
          const [y, mo, day] = d.split("-").map(Number);
          return " for " + new Date(y, mo - 1, day).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
        })();
    }

    return {
      type: "ai",
      text: `Done. I've scheduled ${rows.length} tasks${dateLabel}: ${listStr}.`,
    };
  } catch (err) {
    console.error("[jarvis] task insert FAILED:", err);
    return {
      type: "error",
      text: "I couldn't save the task to Horizon. Please check your connection and try again.",
    };
  }
}

// ─── General Gemini voice prompt ──────────────────────────────────────────────

function buildVoiceSystemPrompt(tasks: HorizonTask[]): string {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const todayStr = formatDateKey(new Date());
  const todayTasks = tasks.filter((t) => t.taskDate === todayStr);
  const pendingToday = todayTasks.filter((t) => !t.completed);
  const completedToday = todayTasks.filter((t) => t.completed);

  const taskLines = tasks
    .slice()
    .sort(
      (a, b) =>
        a.taskDate.localeCompare(b.taskDate) || a.taskTime.localeCompare(b.taskTime),
    )
    .map(
      (t) =>
        `- [${t.completed ? "✓" : " "}] ${t.taskDate} ${t.taskTime} | ${t.priority.toUpperCase()} | ${t.title}${t.description ? ` — ${t.description}` : ""}`,
    )
    .join("\n");

  return `You are Jarvis, a calm and concise voice assistant embedded in the AI Metrics personal workspace. Today is ${today}.

TASK SUMMARY:
- Pending today: ${pendingToday.length}
- Completed today: ${completedToday.length}
- Total tasks: ${tasks.length}

ALL TASKS:
${taskLines || "No tasks scheduled."}

INSTRUCTIONS:
- Respond in 1–3 short sentences maximum. Voice responses must be brief.
- Do not use markdown, bullet points, or formatting. Plain conversational text only.
- Answer directly. No filler phrases like "Great question!" or "Certainly!".
- If asked about tasks or schedule, refer to the data above. Read out times in a natural way.
- Never claim to have created, added, or scheduled a task unless the system confirms it.
- If asked something unrelated, answer helpfully but briefly.`;
}

// ─── Main executor ────────────────────────────────────────────────────────────

export async function executeVoiceCommand(
  text: string,
  tasks: HorizonTask[],
): Promise<CommandResult> {
  const trimmed = text.trim();
  if (!trimmed) return { type: "error", text: "I didn't catch that." };

  // 1. Route navigation (instant)
  const navResult = parseRouteCommand(trimmed);
  if (navResult) return navResult;

  // 2. Task creation (real insert, supports multiple tasks)
  if (isTaskCreationIntent(trimmed)) {
    if (!geminiAPI.configured) {
      return { type: "error", text: "AI assistant not configured. Please add a Gemini API key." };
    }
    return extractAndCreateTasks(trimmed);
  }

  // 3. General AI query
  if (!geminiAPI.configured) {
    return { type: "error", text: "AI assistant not configured. Please add a Gemini API key." };
  }

  try {
    const systemPrompt = buildVoiceSystemPrompt(tasks);
    const response = await geminiAPI.generateContent(trimmed, [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Understood. I'm ready to help." }] },
    ]);
    return { type: "ai", text: response };
  } catch {
    return { type: "error", text: "Something went wrong. Please try again." };
  }
}

// ─── Wake word stripper ───────────────────────────────────────────────────────

export function stripWakeWord(text: string, wakeWord: string): string {
  const lower = text.toLowerCase().trim();
  // Try longest match first
  const candidates = ["hey jarvis", "jarvis", wakeWord.toLowerCase()];
  for (const ww of candidates) {
    if (lower.startsWith(ww)) {
      return text.slice(ww.length).replace(/^[\s,]+/, "").trim();
    }
  }
  return text;
}
