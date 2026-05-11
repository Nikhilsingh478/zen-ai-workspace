/**
 * Voice Commander — parses speech into executable actions.
 *
 * Priority order:
 *   1. Local route commands (instant, no AI)
 *   2. Task creation intent → Gemini structured-JSON extraction → real Supabase insert
 *   3. General AI query via Gemini
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
];

function isTaskCreationIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return TASK_INTENT_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── Task extraction via Gemini (strict JSON) ─────────────────────────────────

async function extractAndCreateTask(text: string): Promise<CommandResult> {
  const today = new Date();
  const todayStr = formatDateKey(today);
  const todayReadable = today.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const extractionPrompt =
    `Today is ${todayReadable} (${todayStr}). ` +
    `Extract task details from the following voice command. ` +
    `Respond with ONLY a valid JSON object and absolutely nothing else — no markdown, no explanation, no code fences.\n\n` +
    `JSON schema:\n` +
    `{\n` +
    `  "isTask": boolean,\n` +
    `  "title": string,\n` +
    `  "description": string,\n` +
    `  "date": "YYYY-MM-DD",\n` +
    `  "time": "HH:MM",\n` +
    `  "priority": "low" | "medium" | "high"\n` +
    `}\n\n` +
    `Rules:\n` +
    `- If this is clearly a task/reminder/meeting/appointment request, set isTask: true.\n` +
    `- date must be a real calendar date in YYYY-MM-DD format relative to today (${todayStr}).\n` +
    `- "tomorrow" = ${formatDateKey(new Date(today.getTime() + 86400000))}.\n` +
    `- time must be in 24-hour HH:MM format. If unspecified, use "09:00".\n` +
    `- priority: use "high" for urgent/important words, "low" for casual, "medium" otherwise.\n` +
    `- If not a task, set isTask: false and leave other fields empty.\n\n` +
    `Voice command: "${text}"`;

  console.log("[jarvis] extracting task from:", text);

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

  if (!parsed.isTask) {
    return {
      type: "ai",
      text: "I'm not sure what task to create. Try saying something like 'remind me tomorrow at 4 PM to send the invoice'.",
    };
  }

  if (!parsed.title?.trim()) {
    return { type: "ai", text: "What should I name this task?" };
  }

  if (!parsed.date || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
    return {
      type: "ai",
      text: `I understood the task "${parsed.title}" but couldn't determine the date. Which day should I schedule it?`,
    };
  }

  // Normalise time — fall back to 09:00 if malformed
  const timeValid = /^\d{2}:\d{2}$/.test(parsed.time ?? "");
  const time = timeValid ? parsed.time : "09:00";

  // Normalise priority
  const priority: "low" | "medium" | "high" =
    parsed.priority === "low" || parsed.priority === "high" ? parsed.priority : "medium";

  console.log("[jarvis] inserting task →", {
    title: parsed.title,
    date: parsed.date,
    time,
    priority,
  });

  // ── Real Supabase insert ───────────────────────────────────────────────────
  try {
    const { data, error } = await supabase
      .from("horizon_tasks")
      .insert({
        title: parsed.title.trim(),
        description: parsed.description?.trim() || null,
        task_date: parsed.date,
        task_time: time,
        priority,
        notification_enabled: false,
        completed: false,
      })
      .select("id")
      .single();

    if (error) throw error;
    if (!data?.id) throw new Error("No ID returned — insert may have failed silently");

    console.log("[jarvis] task created ✓ id:", data.id);

    // Build human-readable confirmation
    const [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const timeStr = `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;

    const [yr, mo, dy] = parsed.date.split("-").map(Number);
    const dateObj = new Date(yr, mo - 1, dy);
    const isToday = parsed.date === todayStr;
    const isTomorrow = parsed.date === formatDateKey(new Date(today.getTime() + 86400000));
    const dateStr = isToday
      ? "today"
      : isTomorrow
        ? "tomorrow"
        : dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

    return {
      type: "ai",
      text: `Done. I added "${parsed.title.trim()}" for ${dateStr} at ${timeStr}.`,
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
- If asked about tasks, refer to the data above.
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

  // 2. Task creation (real insert)
  if (isTaskCreationIntent(trimmed)) {
    if (!geminiAPI.configured) {
      return { type: "error", text: "AI assistant not configured. Please add a Gemini API key." };
    }
    return extractAndCreateTask(trimmed);
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
