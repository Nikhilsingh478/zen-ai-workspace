/**
 * Voice Commander — parses speech text into executable actions.
 * Local routing commands resolve instantly; everything else goes to Gemini.
 */

import { geminiAPI } from "@/lib/gemini";
import type { HorizonTask } from "@/lib/horizon";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CommandResult =
  | { type: "navigate"; route: string; label: string }
  | { type: "ai"; text: string }
  | { type: "error"; text: string };

// ─── Route commands ───────────────────────────────────────────────────────────

const ROUTE_MAP: { keywords: string[]; route: string; label: string }[] = [
  { keywords: ["horizon", "calendar", "schedule"], route: "/horizon", label: "Horizon" },
  { keywords: ["ask", "chat", "jarvis", "ai assistant"], route: "/ask", label: "Ask" },
  { keywords: ["desktop", "launcher", "apps"], route: "/desktop", label: "Desktop" },
  { keywords: ["prompts", "prompt library"], route: "/prompts", label: "Prompts" },
  { keywords: ["links", "link board"], route: "/links", label: "Links" },
  { keywords: ["images", "image board", "photos"], route: "/images", label: "Images" },
  { keywords: ["messages", "notes", "reminders"], route: "/messages", label: "Messages" },
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

// ─── Gemini voice prompt ──────────────────────────────────────────────────────

function buildVoiceSystemPrompt(tasks: HorizonTask[]): string {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const todayStr = new Date().toISOString().split("T")[0];
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

  return `You are Horizon, a calm and concise voice assistant embedded in the AI Metrics personal workspace. Today is ${today}.

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
- If asked to create a task, say you've noted it and ask them to confirm in Horizon. (You cannot create tasks directly from voice.)
- If asked something unrelated, answer helpfully but briefly.`;
}

// ─── Main executor ────────────────────────────────────────────────────────────

export async function executeVoiceCommand(
  text: string,
  tasks: HorizonTask[],
): Promise<CommandResult> {
  const trimmed = text.trim();
  if (!trimmed) return { type: "error", text: "I didn't catch that." };

  const navResult = parseRouteCommand(trimmed);
  if (navResult) return navResult;

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
  const candidates = ["hey horizon", wakeWord.toLowerCase()];
  for (const ww of candidates) {
    if (lower.startsWith(ww)) {
      return text.slice(ww.length).replace(/^[\s,]+/, "").trim();
    }
  }
  return text;
}
