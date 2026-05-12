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
import { addTaskDirect } from "@/lib/horizon";
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
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text: string = event.results[i][0].transcript.trim();
      const isFinal: boolean = event.results[i].isFinal;
      const lower = text.toLowerCase();

      if (currentMode === "passive") {
        // Only care about final results for wake-word detection
        if (!isFinal) continue;

        const woke = WAKE_WORDS.some((w) => lower.includes(w));
        if (woke) {
          stopRecognition();
          patch({ isAwake: true, voiceState: "listening", transcript: "" });

          // Check if command is inline with wake word
          let inlineCmd = text;
          for (const w of WAKE_WORDS) {
            if (lower.includes(w)) {
              const idx = lower.indexOf(w);
              inlineCmd = text.slice(idx + w.length).replace(/^[\s,]+/, "").trim();
              break;
            }
          }

          if (inlineCmd.length > 3) {
            // Inline command after wake word — process directly
            handleCommand(inlineCmd);
          } else {
            // Wake word only — start listening for command
            accumulatedFinalText = "";
            latestInterimText = "";
            startRecognition("command");
            // Hard ceiling timeout
            commandTimeout = setTimeout(() => {
              if (_state.voiceState === "listening") {
                stopRecognition();
                patch({ isAwake: false, voiceState: "idle", transcript: "" });
                startRecognition("passive");
              }
            }, MAX_LISTEN_MS);
          }
          return;
        }
      } else if (currentMode === "command") {
        // Reset the hard ceiling (user is still talking)
        clearTimeout(commandTimeout);

        if (isFinal) {
          // Accumulate confirmed text
          accumulatedFinalText = [accumulatedFinalText, text].filter(Boolean).join(" ").trim();
          latestInterimText = "";
          // Update live transcript display
          patch({ transcript: accumulatedFinalText });
          // Arm silence detector — waits for the user to pause
          armSilenceTimer();
        } else {
          // Interim: update display but don't commit
          latestInterimText = text;
          patch({ transcript: [accumulatedFinalText, latestInterimText].filter(Boolean).join(" ") });
        }

        // Re-arm the hard ceiling timeout
        commandTimeout = setTimeout(() => {
          if (_state.voiceState === "listening") {
            // Force finalize with whatever we have
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
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      stopRecognition();
      patch({ voiceState: "idle", isAwake: false });
    }
    // "no-speech" and "aborted" are normal — let onend handle restart
  };

  rec.onend = () => {
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

    // WAKE WORD FIX: ALWAYS restart passive if enabled.
    // The old condition checked voiceState === "idle" which was wrong —
    // when command/speaking states are active, voiceState is NOT idle,
    // so the restart never fired and wake word stopped working.
    if (_state.enabled) {
      restartTimer = setTimeout(() => startRecognition("passive"), 500);
    }
  };

  try {
    rec.start();
  } catch {
    recRef = null;
    // WAKE WORD FIX: retry on start() failure (e.g. mic still held by TTS)
    if (_state.enabled) {
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

// ─── Gemini JARVIS integration ────────────────────────────────────────────────

function buildSystemPrompt(tasks: HorizonTask[]): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const todayKey = now.toISOString().split("T")[0];
  const pending = tasks.filter((t) => t.taskDate === todayKey && !t.completed);

  const taskSummary = tasks.length
    ? tasks.slice(0, 20).map(
        (t) => `• [${t.completed ? "✓" : " "}] ${t.taskDate} ${t.taskTime} — ${t.title}${t.description ? ` (${t.description})` : ""} [${t.priority}]`
      ).join("\n")
    : "No tasks scheduled.";

  return `You are J.A.R.V.I.S. — Just A Rather Very Intelligent System. A sophisticated AI assistant embedded in the AI Metrics personal operating system.

Current time: ${timeStr} on ${dateStr}
Pending tasks today: ${pending.length}

USER'S TASKS:
${taskSummary}

PERSONALITY:
- Precise, confident, intelligent
- Occasionally address the user as "sir"
- Never use filler phrases like "Great question!" or "Certainly!"
- Voice responses: 1–3 short sentences only. No markdown.
- Text responses: can be slightly longer but still concise.

TASK CREATION:
When the user asks you to create tasks or reminders, include this exact JSON block at the END of your response:
[TASKS:${JSON.stringify([{ title: "example", taskDate: "YYYY-MM-DD", taskTime: "HH:MM", priority: "medium", description: "" }])}]

Use real values. taskDate in YYYY-MM-DD format. taskTime in 24h HH:MM format. priority: low/medium/high.
For "tomorrow", calculate from today (${todayKey}).
You may create multiple tasks in one block if requested.
Do NOT include the [TASKS:...] block if no tasks are being created.

NAVIGATION:
If user says "open [page]" or "go to [page]", reply naturally AND include: [NAVIGATE:/route]
Routes: /horizon, /ask, /desktop, /prompts, /links, /images, /messages, /insights, /`;
}

function parseTasks(text: string): { clean: string; tasks: ParsedTask[] } {
  const taskMatch = text.match(/\[TASKS:([\s\S]*?)\]/);
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
    const clean = text.replace(/\[TASKS:[\s\S]*?\]/, "").trim();
    return { clean, tasks };
  } catch {
    const clean = text.replace(/\[TASKS:[\s\S]*?\]/, "").trim();
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
    const systemPrompt = buildSystemPrompt([]);
    const fullHistory = conversationHistory.length === 0
      ? [
          { role: "user" as const, parts: [{ text: systemPrompt }] },
          { role: "model" as const, parts: [{ text: "Understood. J.A.R.V.I.S. online and ready, sir." }] },
        ]
      : conversationHistory;

    const rawResponse = await geminiAPI.generateContent(commandText, fullHistory);
    conversationHistory = [
      ...fullHistory,
      { role: "user", parts: [{ text: commandText }] },
      { role: "model", parts: [{ text: rawResponse }] },
    ];
    if (conversationHistory.length > 20) conversationHistory = conversationHistory.slice(-20);

    const { clean: afterNav, route } = parseNavigate(rawResponse);
    const { clean, tasks } = parseTasks(afterNav);

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
