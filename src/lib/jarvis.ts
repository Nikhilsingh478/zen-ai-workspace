/**
 * JARVIS — Just A Rather Very Intelligent System
 * Global state store + voice engine + Gemini integration
 *
 * Voice fix:
 * - "interimResults + isFinal" alone drops long utterances because browsers
 *   often fire multiple isFinal=true segments for a single spoken sentence
 *   and each segment fires independently. We now buffer ALL final segments
 *   together and only process the command after a short silence gap (800 ms)
 *   — the same technique used in professional dictation tools.
 */

import { useSyncExternalStore } from "react";
import { geminiAPI } from "@/lib/gemini";
import { addTaskDirect, getHorizonTasks, ensureBooted } from "@/lib/horizon";
import type { HorizonTask } from "@/lib/horizon";

// ─── Types ────────────────────────────────────────────────────────────────────

export type JarvisVoiceState = "idle" | "listening" | "processing" | "speaking";

export type ParsedTask = {
  title: string;
  taskDate: string;
  taskTime: string;
  priority: "low" | "medium" | "high";
  description?: string;
};

export type JarvisMessage = {
  id: string;
  role: "user" | "jarvis";
  content: string;
  timestamp: number;
  type?: "text" | "task_created" | "error";
  tasks?: ParsedTask[];
};

type JarvisState = {
  voiceState: JarvisVoiceState;
  isAwake: boolean;
  messages: JarvisMessage[];
  transcript: string;
  enabled: boolean;
};

// ─── Browser compat ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const win = typeof window !== "undefined" ? (window as any) : undefined;
const SpeechRecognitionCtor: (new () => any) | undefined =
  win?.SpeechRecognition ?? win?.webkitSpeechRecognition;

export const isJarvisSupported = Boolean(SpeechRecognitionCtor);

const WAKE_WORDS = ["jarvis", "hey jarvis", "okay jarvis"];

function isMobileUA(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

// ─── Module-level store ───────────────────────────────────────────────────────

const listeners = new Set<() => void>();

let _state: JarvisState = {
  voiceState: "idle",
  isAwake: false,
  messages: [],
  transcript: "",
  enabled: (() => {
    try { return localStorage.getItem("jarvis:enabled") === "true"; } catch { return false; }
  })(),
};

function emit() { listeners.forEach((fn) => fn()); }

function patch(next: Partial<JarvisState>) {
  _state = { ..._state, ...next };
  emit();
}

export function subscribeJarvis(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getJarvisSnapshot(): JarvisState {
  return _state;
}

// ─── SpeechRecognition engine ─────────────────────────────────────────────────
//
// KEY FIX: We accumulate all final transcript segments and use a silence
// timer (SILENCE_THRESHOLD_MS) to detect when the user has stopped speaking.
// This prevents long commands from being cut off mid-sentence.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let recRef: any = null;
let intentionalStop = false;
let currentMode: "passive" | "command" = "passive";
let restartTimer: ReturnType<typeof setTimeout> | undefined;
let commandTimeout: ReturnType<typeof setTimeout> | undefined;

// Silence detection
let silenceTimer: ReturnType<typeof setTimeout> | undefined;
let accumulatedFinalText = "";        // buffered confirmed segments
let latestInterimText = "";           // current partial segment (display only)

const SILENCE_THRESHOLD_MS = 1200;   // wait 1.2 s after last speech before finalizing
const MAX_LISTEN_MS = 20000;         // hard ceiling: 20 s max per command session

function clearSilenceTimer() {
  clearTimeout(silenceTimer);
  silenceTimer = undefined;
}

function armSilenceTimer() {
  clearSilenceTimer();
  silenceTimer = setTimeout(() => {
    // User has been silent for SILENCE_THRESHOLD_MS — finalize whatever we have
    const fullText = [accumulatedFinalText, latestInterimText].filter(Boolean).join(" ").trim();
    if (fullText.length > 1) {
      stopRecognition();
      const stripped = stripWakeWord(fullText);
      if (stripped.length > 1) {
        handleCommand(stripped);
      } else {
        patch({ isAwake: false, voiceState: "idle", transcript: "" });
        if (_state.enabled) startRecognition("passive");
      }
    } else {
      stopRecognition();
      patch({ isAwake: false, voiceState: "idle", transcript: "" });
      if (_state.enabled) startRecognition("passive");
    }
  }, SILENCE_THRESHOLD_MS);
}

function startRecognition(mode: "passive" | "command" = "passive") {
  if (!SpeechRecognitionCtor) return;
  if (recRef) return;

  // FIX: On mobile, OS beeps every time the mic starts.
  // Passive mode (wake word) constantly restarts the mic, causing an endless loop of beeps
  // that interrupts the user's ability to speak.
  // We disable passive listening on mobile; mobile users must use Tap-To-Talk.
  if (mode === "passive" && isMobileUA()) {
    patch({ voiceState: "idle", isAwake: false });
    return;
  }

  clearTimeout(restartTimer);
  currentMode = mode;
  intentionalStop = false;
  accumulatedFinalText = "";
  latestInterimText = "";

  const rec = new SpeechRecognitionCtor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-US";
  // maxAlternatives = 1 gives us the best guess without overhead
  rec.maxAlternatives = 1;
  recRef = rec;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rec.onresult = (event: any) => {
    if (recRef !== rec) return;

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text: string = event.results[i][0].transcript.trim();
      const isFinal: boolean = event.results[i].isFinal;
      const lower = text.toLowerCase();

      if (currentMode === "passive") {
        const woke = WAKE_WORDS.some((w) => lower.includes(w));
        if (woke) {
          // Instantly switch to command mode WITHOUT aborting the recognizer
          currentMode = "command";
          patch({ isAwake: true, voiceState: "listening", transcript: "" });

          const inlineCmd = stripWakeWord(text);

          if (isFinal) {
            if (inlineCmd.length > 3) {
              stopRecognition();
              handleCommand(inlineCmd);
              return;
            } else {
              accumulatedFinalText = "";
              latestInterimText = "";
            }
          } else {
            accumulatedFinalText = "";
            latestInterimText = inlineCmd;
            patch({ transcript: inlineCmd });
          }

          // Start the hard ceiling for the command
          clearTimeout(commandTimeout);
          commandTimeout = setTimeout(() => {
            if (_state.voiceState === "listening") {
              clearSilenceTimer();
              const fullText = [accumulatedFinalText, latestInterimText].filter(Boolean).join(" ").trim();
              stopRecognition();
              if (fullText.length > 1) {
                handleCommand(stripWakeWord(fullText));
              } else {
                patch({ isAwake: false, voiceState: "idle", transcript: "" });
                if (_state.enabled) startRecognition("passive");
              }
            }
          }, MAX_LISTEN_MS);
          
          continue; 
        }
      } else if (currentMode === "command") {
        clearTimeout(commandTimeout);
        clearSilenceTimer(); // FIX: Activity resets the silence timer so we don't cut off mid-speech

        const stripped = stripWakeWord(text);

        if (isFinal) {
          accumulatedFinalText = [accumulatedFinalText, stripped].filter(Boolean).join(" ").trim();
          latestInterimText = "";
          patch({ transcript: accumulatedFinalText });
          armSilenceTimer();
        } else {
          latestInterimText = stripped;
          patch({ transcript: [accumulatedFinalText, latestInterimText].filter(Boolean).join(" ") });
        }

        commandTimeout = setTimeout(() => {
          if (_state.voiceState === "listening") {
            clearSilenceTimer();
            const fullText = [accumulatedFinalText, latestInterimText].filter(Boolean).join(" ").trim();
            stopRecognition();
            if (fullText.length > 1) {
              handleCommand(stripWakeWord(fullText));
            } else {
              patch({ isAwake: false, voiceState: "idle", transcript: "" });
              if (_state.enabled) startRecognition("passive");
            }
          }
        }, MAX_LISTEN_MS);
      }
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rec.onerror = (e: any) => {
    if (recRef !== rec) return;
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      stopRecognition();
      patch({ voiceState: "idle", isAwake: false });
    }
    // "no-speech" and "aborted" are normal — let onend handle restart
  };

  rec.onend = () => {
    if (recRef !== rec) return; // Prevent old aborted instances from triggering restarts
    recRef = null;
    if (intentionalStop) return;

    if (currentMode === "command") {
      // Recognition ended unexpectedly while in command mode —
      // finalize with whatever we have if there's accumulated text
      clearSilenceTimer();
      const fullText = [accumulatedFinalText, latestInterimText].filter(Boolean).join(" ").trim();
      if (fullText.length > 1) {
        handleCommand(stripWakeWord(fullText));
        return;
      }
      // Nothing useful — fall through to restart passive
    }

    // WAKE WORD FIX: ALWAYS restart passive if enabled, UNLESS on mobile
    // Mobile OS beeps on every start, so passive mode is disabled there.
    if (_state.enabled && !isMobileUA()) {
      restartTimer = setTimeout(() => startRecognition("passive"), 500);
    }
  };

  try {
    rec.start();
  } catch {
    recRef = null;
    // WAKE WORD FIX: retry on start() failure (e.g. mic still held by TTS)
    if (_state.enabled && !isMobileUA()) {
      restartTimer = setTimeout(() => startRecognition(mode), 1000);
    }
  }
}

function stopRecognition() {
  clearTimeout(restartTimer);
  clearTimeout(commandTimeout);
  clearSilenceTimer();
  accumulatedFinalText = "";
  latestInterimText = "";
  if (recRef) {
    intentionalStop = true;
    try { recRef.abort(); } catch { /* ignore */ }
    recRef = null;
  }
}

function stripWakeWord(text: string): string {
  const lower = text.toLowerCase().trim();
  for (const w of [...WAKE_WORDS].sort((a, b) => b.length - a.length)) {
    if (lower.startsWith(w)) {
      return text.slice(w.length).replace(/^[\s,]+/, "").trim();
    }
  }
  return text;
}

// ─── Markdown stripper ────────────────────────────────────────────────────────
// Gemini sometimes returns markdown despite "no markdown" instructions.
// Strip it before storing or speaking so asterisks never appear in chat.

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/gs, "$1")
    .replace(/\*(.+?)\*/gs, "$1")
    .replace(/__(.+?)__/gs, "$1")
    .replace(/_(.+?)_/gs, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Gemini JARVIS integration ────────────────────────────────────────────────

function formatTask(t: HorizonTask): string {
  const status = t.completed ? "✓ DONE" : "PENDING";
  const desc = t.description ? ` — ${t.description}` : "";
  return `  [${status}] ${t.taskTime} | ${t.title}${desc} (${t.priority} priority)`;
}

function buildSystemPrompt(tasks: HorizonTask[]): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const todayKey = now.toISOString().split("T")[0];

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = tomorrow.toISOString().split("T")[0];

  // Split tasks into groups for clear context
  const todayTasks = tasks.filter((t) => t.taskDate === todayKey).sort((a, b) => a.taskTime.localeCompare(b.taskTime));
  const tomorrowTasks = tasks.filter((t) => t.taskDate === tomorrowKey).sort((a, b) => a.taskTime.localeCompare(b.taskTime));
  const upcomingTasks = tasks
    .filter((t) => t.taskDate > tomorrowKey)
    .sort((a, b) => a.taskDate.localeCompare(b.taskDate) || a.taskTime.localeCompare(b.taskTime));

  const todayPending = todayTasks.filter((t) => !t.completed);
  const todayDone = todayTasks.filter((t) => t.completed);

  const todaySection = todayTasks.length
    ? `TODAY (${todayKey}) — ${todayPending.length} pending, ${todayDone.length} done:\n${todayTasks.map(formatTask).join("\n")}`
    : `TODAY (${todayKey}) — No tasks scheduled.`;

  const tomorrowSection = tomorrowTasks.length
    ? `TOMORROW (${tomorrowKey}):\n${tomorrowTasks.map(formatTask).join("\n")}`
    : `TOMORROW (${tomorrowKey}) — No tasks scheduled.`;

  const upcomingSection = upcomingTasks.length
    ? `UPCOMING (next 30 days):\n${upcomingTasks.map((t) => `  [${t.completed ? "✓" : " "}] ${t.taskDate} ${t.taskTime} | ${t.title} (${t.priority})`).join("\n")}`
    : "UPCOMING — No future tasks scheduled.";

  let userContext = "";
  try {
    const saved = localStorage.getItem("jarvis:user-context");
    if (saved && saved.trim().length > 0) {
      userContext = `\nUSER CONTEXT:\n${saved}\n`;
    }
  } catch {
    /* ignore */
  }

  return `You are J.A.R.V.I.S. — Just A Rather Very Intelligent System. A sophisticated AI assistant embedded in the AI Metrics personal operating system.
${userContext}
Current time: ${timeStr} on ${dateStr}

=== HORIZON TASK SCHEDULE ===
${todaySection}

${tomorrowSection}

${upcomingSection}
=== END OF SCHEDULE ===

PERSONALITY:
- Precise, confident, intelligent
- Occasionally address the user as "sir"
- Never use filler phrases like "Great question!" or "Certainly!"
- When asked about today's tasks or schedule, list them clearly from the TODAY section above.
- Voice responses: 2–4 short sentences. No markdown, no asterisks, no bullet symbols in spoken text.
- Text responses: concise but complete — list all relevant tasks when asked.

TASK CREATION:
When the user asks you to create tasks or reminders, include this exact JSON block at the END of your response:
<TASKS>${JSON.stringify([{ title: "example", taskDate: "YYYY-MM-DD", taskTime: "HH:MM", priority: "medium", description: "" }])}</TASKS>

Use real values. taskDate in YYYY-MM-DD format. taskTime in 24h HH:MM format. priority: low/medium/high.
For "tomorrow", use date: ${tomorrowKey}. For "today", use date: ${todayKey}.
You may create multiple tasks in one block if requested.
Do NOT include the <TASKS> block if no tasks are being created.

NAVIGATION:
If user says "open [page]" or "go to [page]", reply naturally AND include: [NAVIGATE:/route]
Routes: /horizon, /ask, /desktop, /prompts, /links, /images, /messages, /insights, /context, /`;
}

function parseTasks(text: string): { clean: string; tasks: ParsedTask[] } {
  const taskMatch = text.match(/<TASKS>([\s\S]*?)<\/TASKS>/);
  if (!taskMatch) return { clean: text, tasks: [] };

  try {
    const raw = JSON.parse(taskMatch[1]) as ParsedTask[];
    const tasks = raw.map((t) => ({
      title: t.title || "Untitled",
      taskDate: t.taskDate || new Date().toISOString().split("T")[0],
      taskTime: t.taskTime || "09:00",
      priority: (["low", "medium", "high"].includes(t.priority) ? t.priority : "medium") as ParsedTask["priority"],
      description: t.description || undefined,
    }));
    const clean = text.replace(/<TASKS>[\s\S]*?<\/TASKS>/, "").trim();
    return { clean, tasks };
  } catch {
    const clean = text.replace(/<TASKS>[\s\S]*?<\/TASKS>/, "").trim();
    return { clean, tasks: [] };
  }
}

function parseNavigate(text: string): { clean: string; route: string | null } {
  const navMatch = text.match(/\[NAVIGATE:([^\]]+)\]/);
  if (!navMatch) return { clean: text, route: null };
  const route = navMatch[1].trim();
  const clean = text.replace(/\[NAVIGATE:[^\]]+\]/, "").trim();
  return { clean, route };
}

let conversationHistory: { role: "user" | "model"; parts: { text: string }[] }[] = [];

async function handleCommand(commandText: string) {
  if (!commandText.trim()) return;

  patch({ voiceState: "processing", isAwake: true });

  // Add user message
  const userMsg: JarvisMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: commandText,
    timestamp: Date.now(),
    type: "text",
  };
  patch({ messages: [..._state.messages, userMsg], transcript: commandText });

  try {
    // Ensure horizon tasks are loaded before building context.
    // getHorizonTasks() returns [] if the store was never booted (e.g. user
    // hasn't visited the Horizon page yet). Awaiting ensureBooted() guarantees
    // fresh task data is always available to JARVIS.
    await ensureBooted();
    const systemPrompt = buildSystemPrompt(getHorizonTasks());
    const fullHistory = [
      { role: "user" as const, parts: [{ text: systemPrompt }] },
      { role: "model" as const, parts: [{ text: "Understood. J.A.R.V.I.S. online and ready, sir." }] },
      ...conversationHistory,
    ];

    const rawResponse = await geminiAPI.generateContent(commandText, fullHistory);

    // Store only exchange turns — system pair is always rebuilt fresh next call
    conversationHistory = [
      ...conversationHistory,
      { role: "user", parts: [{ text: commandText }] },
      { role: "model", parts: [{ text: rawResponse }] },
    ];
    if (conversationHistory.length > 16) conversationHistory = conversationHistory.slice(-16);

    const { clean: afterNav, route } = parseNavigate(rawResponse);
    const { clean: rawClean, tasks } = parseTasks(afterNav);
    const clean = stripMarkdown(rawClean);

    // Navigate if requested
    if (route) {
      setTimeout(() => {
        win?.history?.pushState({}, "", route);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, 300);
    }

    // Create tasks
    const createdTasks: ParsedTask[] = [];
    for (const task of tasks) {
      const result = await addTaskDirect({
        title: task.title,
        taskDate: task.taskDate,
        taskTime: task.taskTime,
        priority: task.priority,
        description: task.description || null,
        notificationEnabled: true,
      });
      if (result) createdTasks.push(task);
    }

    const jarvisMsg: JarvisMessage = {
      id: crypto.randomUUID(),
      role: "jarvis",
      content: clean,
      timestamp: Date.now(),
      type: createdTasks.length > 0 ? "task_created" : "text",
      tasks: createdTasks.length > 0 ? createdTasks : undefined,
    };

    patch({ messages: [..._state.messages, userMsg, jarvisMsg], voiceState: "speaking" });

    // Speak response, then restart passive listening
    // WAKE WORD FIX: 400ms delay lets Chrome/Android release mic from TTS
    // before we try to start recognition again. Without this, rec.start()
    // silently fails and the wake word loop dies permanently.
    speakResponse(clean, () => {
      patch({ voiceState: "idle", isAwake: false, transcript: "" });
      if (_state.enabled) {
        setTimeout(() => startRecognition("passive"), 400);
      }
    });
  } catch {
    const errMsg: JarvisMessage = {
      id: crypto.randomUUID(),
      role: "jarvis",
      content: "I encountered an error processing that request, sir.",
      timestamp: Date.now(),
      type: "error",
    };
    patch({ messages: [..._state.messages, userMsg, errMsg], voiceState: "idle", isAwake: false, transcript: "" });
    if (_state.enabled) startRecognition("passive");
  }
}

function speakResponse(text: string, onEnd?: () => void) {
  if (!("speechSynthesis" in window)) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 0.95;
  utt.pitch = 0.9;
  utt.volume = 1;
  utt.lang = "en-US";
  const voices = window.speechSynthesis.getVoices();
  const pref = voices.find((v) => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Daniel") || v.name.includes("Alex")));
  if (pref) utt.voice = pref;
  utt.onend = () => onEnd?.();
  utt.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utt);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const jarvis = {
  enable() {
    try { localStorage.setItem("jarvis:enabled", "true"); } catch { /* ignore */ }
    patch({ enabled: true, voiceState: "idle" });
    startRecognition("passive");
  },

  disable() {
    try { localStorage.setItem("jarvis:enabled", "false"); } catch { /* ignore */ }
    stopRecognition();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    patch({ enabled: false, voiceState: "idle", isAwake: false, transcript: "" });
  },

  activate() {
    stopRecognition();
    accumulatedFinalText = "";
    latestInterimText = "";
    patch({ isAwake: true, voiceState: "listening", transcript: "" });
    startRecognition("command");
    commandTimeout = setTimeout(() => {
      if (_state.voiceState === "listening") {
        clearSilenceTimer();
        const fullText = [accumulatedFinalText, latestInterimText].filter(Boolean).join(" ").trim();
        stopRecognition();
        if (fullText.length > 1) {
          handleCommand(stripWakeWord(fullText));
        } else {
          patch({ isAwake: false, voiceState: "idle", transcript: "" });
          if (_state.enabled) startRecognition("passive");
        }
      }
    }, MAX_LISTEN_MS);
  },

  async sendText(text: string) {
    stopRecognition();
    await handleCommand(text);
  },

  dismiss() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    stopRecognition();
    patch({ isAwake: false, voiceState: "idle", transcript: "" });
    if (_state.enabled) startRecognition("passive");
  },

  clearMessages() {
    conversationHistory = [];
    patch({ messages: [] });
  },

  autoStartIfEnabled() {
    if (!SpeechRecognitionCtor) return;

    const doStart = () => {
      if (!_state.enabled) {
        // Auto-enable permanently since permission is already granted
        try { localStorage.setItem("jarvis:enabled", "true"); } catch { /* ignore */ }
        patch({ enabled: true, voiceState: "idle" });
      }
      if (!recRef) startRecognition("passive");
    };

    if (navigator.permissions) {
      navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((r) => {
          if (r.state === "granted") doStart();
          r.onchange = () => { if (r.state === "granted") doStart(); };
        })
        .catch(() => {
          if (_state.enabled) startRecognition("passive");
        });
    } else if (_state.enabled) {
      startRecognition("passive");
    }
  },
} as const;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useJarvis() {
  return useSyncExternalStore(subscribeJarvis, getJarvisSnapshot, getJarvisSnapshot);
}
