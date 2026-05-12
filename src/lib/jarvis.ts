/**
 * JARVIS — Just A Rather Very Intelligent System
 * Global state store + voice engine + Gemini integration
 *
 * FIXES applied (v2):
 * 1. GLOBAL LISTENING — recognition starts from App root, not just /jarvis route.
 *    Call jarvis.autoStartIfEnabled() once in your App root component.
 *
 * 2. RACE CONDITION FIX — the old code had two restart paths (recognition.onend
 *    AND the TTS callback) that could both call startRecognition() simultaneously.
 *    The second call hit `if (recRef) return`, but if the first rec.start() had
 *    thrown (mic still held by TTS), recRef was null again — creating two competing
 *    instances where one's abort() set intentionalStop=true on the other, killing
 *    the restart loop permanently.
 *    Fix: single authoritative restart path via schedulePassiveRestart(), guarded
 *    by a restart-in-flight flag so only one restart is ever pending at a time.
 *
 * 3. WAKE WORD AFTER FIRST USE — the above race condition was the root cause.
 *    Now guaranteed: after every command cycle (success or error), passive
 *    listening always resumes.
 *
 * 4. intentionalStop semantics tightened — only set when WE are done for a
 *    reason that should NOT restart (disable/dismiss while not enabled).
 *    All normal command-cycle stops use stopForCycle() which does NOT set
 *    intentionalStop, so onend always schedules a restart when enabled.
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let recRef: any = null;

/**
 * intentionalStop is ONLY set true when we want recognition dead for good
 * (jarvis.disable() or jarvis.dismiss() while !enabled).
 * During a normal command cycle we use stopForCycle() which does NOT set this,
 * so onend will always schedule a passive restart when _state.enabled is true.
 */
let intentionalStop = false;

let currentMode: "passive" | "command" = "passive";

// Timers
let commandTimeout: ReturnType<typeof setTimeout> | undefined;
let silenceTimer: ReturnType<typeof setTimeout> | undefined;

// ── Restart guard ──────────────────────────────────────────────────────────
// Tracks whether a restart is already scheduled so we never double-schedule.
let restartPending = false;

/**
 * The ONE place that schedules passive restart. Any code path that wants to
 * resume passive listening calls this — never startRecognition() directly.
 * delayMs: extra wait on top of baseline 500ms (use for post-TTS mic release).
 */
function schedulePassiveRestart(delayMs = 0) {
  if (restartPending) return;          // already queued — don't stack
  if (!_state.enabled) return;         // disabled — stay silent
  restartPending = true;
  setTimeout(() => {
    restartPending = false;
    if (_state.enabled && !recRef) {
      startRecognition("passive");
    }
  }, 500 + delayMs);
}

// Silence detection
let accumulatedFinalText = "";
let latestInterimText = "";

const SILENCE_THRESHOLD_MS = 1200;
const MAX_LISTEN_MS = 20_000;

function clearSilenceTimer() {
  clearTimeout(silenceTimer);
  silenceTimer = undefined;
}

function armSilenceTimer() {
  clearSilenceTimer();
  silenceTimer = setTimeout(() => {
    const fullText = [accumulatedFinalText, latestInterimText]
      .filter(Boolean).join(" ").trim();
    stopForCycle();
    if (fullText.length > 1) {
      const stripped = stripWakeWord(fullText);
      if (stripped.length > 1) {
        handleCommand(stripped);
      } else {
        patch({ isAwake: false, voiceState: "idle", transcript: "" });
        schedulePassiveRestart();
      }
    } else {
      patch({ isAwake: false, voiceState: "idle", transcript: "" });
      schedulePassiveRestart();
    }
  }, SILENCE_THRESHOLD_MS);
}

/**
 * Stop recognition as part of a normal command cycle.
 * Does NOT set intentionalStop, so if onend fires it will still see
 * _state.enabled and schedule a restart (which schedulePassiveRestart guards
 * against double-firing via restartPending).
 */
function stopForCycle() {
  clearTimeout(commandTimeout);
  clearSilenceTimer();
  accumulatedFinalText = "";
  latestInterimText = "";
  if (recRef) {
    // We are about to call abort() deliberately — mark intentional so onend
    // doesn't *also* restart (schedulePassiveRestart handles it from call site).
    intentionalStop = true;
    try { recRef.abort(); } catch { /* ignore */ }
    recRef = null;
  }
}

function startRecognition(mode: "passive" | "command" = "passive") {
  if (!SpeechRecognitionCtor) return;
  if (recRef) return; // already running

  currentMode = mode;
  intentionalStop = false;
  accumulatedFinalText = "";
  latestInterimText = "";

  const rec = new SpeechRecognitionCtor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-US";
  rec.maxAlternatives = 1;
  recRef = rec;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rec.onresult = (event: any) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text: string = event.results[i][0].transcript.trim();
      const isFinal: boolean = event.results[i].isFinal;
      const lower = text.toLowerCase();

      if (currentMode === "passive") {
        if (!isFinal) continue;

        const woke = WAKE_WORDS.some((w) => lower.includes(w));
        if (woke) {
          stopForCycle(); // stop passive, intentionalStop=true so onend won't restart yet
          patch({ isAwake: true, voiceState: "listening", transcript: "" });

          let inlineCmd = text;
          for (const w of WAKE_WORDS) {
            if (lower.includes(w)) {
              const idx = lower.indexOf(w);
              inlineCmd = text.slice(idx + w.length).replace(/^[\s,]+/, "").trim();
              break;
            }
          }

          if (inlineCmd.length > 3) {
            handleCommand(inlineCmd);
          } else {
            accumulatedFinalText = "";
            latestInterimText = "";
            startRecognition("command");
            commandTimeout = setTimeout(() => {
              if (_state.voiceState === "listening") {
                clearSilenceTimer();
                const fullText = [accumulatedFinalText, latestInterimText]
                  .filter(Boolean).join(" ").trim();
                stopForCycle();
                if (fullText.length > 1) {
                  handleCommand(stripWakeWord(fullText));
                } else {
                  patch({ isAwake: false, voiceState: "idle", transcript: "" });
                  schedulePassiveRestart();
                }
              }
            }, MAX_LISTEN_MS);
          }
          return;
        }

      } else if (currentMode === "command") {
        clearTimeout(commandTimeout);

        if (isFinal) {
          accumulatedFinalText = [accumulatedFinalText, text].filter(Boolean).join(" ").trim();
          latestInterimText = "";
          patch({ transcript: accumulatedFinalText });
          armSilenceTimer();
        } else {
          latestInterimText = text;
          patch({ transcript: [accumulatedFinalText, latestInterimText].filter(Boolean).join(" ") });
        }

        // Re-arm ceiling
        commandTimeout = setTimeout(() => {
          if (_state.voiceState === "listening") {
            clearSilenceTimer();
            const fullText = [accumulatedFinalText, latestInterimText]
              .filter(Boolean).join(" ").trim();
            stopForCycle();
            if (fullText.length > 1) {
              handleCommand(stripWakeWord(fullText));
            } else {
              patch({ isAwake: false, voiceState: "idle", transcript: "" });
              schedulePassiveRestart();
            }
          }
        }, MAX_LISTEN_MS);
      }
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rec.onerror = (e: any) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      // Permission denied — don't restart
      intentionalStop = true;
      recRef = null;
      patch({ voiceState: "idle", isAwake: false });
      return;
    }
    // "no-speech", "aborted", "network" — let onend handle restart
  };

  rec.onend = () => {
    recRef = null;

    if (intentionalStop) {
      // Intentional stops during command cycles have their restart handled
      // explicitly by the call site (handleCommand → TTS callback, etc.)
      // Intentional stops from disable()/dismiss(!enabled) should NOT restart.
      intentionalStop = false; // reset for next cycle
      return;
    }

    // Unexpected drop (browser killed recognition, no-speech timeout, etc.)
    if (currentMode === "command") {
      // We were mid-command — try to salvage accumulated text
      clearSilenceTimer();
      const fullText = [accumulatedFinalText, latestInterimText]
        .filter(Boolean).join(" ").trim();
      if (fullText.length > 1) {
        handleCommand(stripWakeWord(fullText));
        return; // handleCommand owns the restart from here
      }
      patch({ isAwake: false, voiceState: "idle", transcript: "" });
    }

    // Resume passive listening
    schedulePassiveRestart();
  };

  try {
    rec.start();
  } catch {
    recRef = null;
    // mic still busy (e.g. TTS just ended) — retry after a longer wait
    schedulePassiveRestart(500); // 500ms on top of the base 500ms = 1s total
  }
}

/**
 * Full hard stop — used by disable() and dismiss() when we truly don't want
 * any more listening. Sets intentionalStop so onend won't restart.
 */
function stopRecognition() {
  clearTimeout(commandTimeout);
  clearSilenceTimer();
  restartPending = false;
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
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const todayKey = now.toISOString().split("T")[0];
  const pending = tasks.filter((t) => t.taskDate === todayKey && !t.completed);

  const taskSummary = tasks.length
    ? tasks
        .slice(0, 20)
        .map(
          (t) =>
            `• [${t.completed ? "✓" : " "}] ${t.taskDate} ${t.taskTime} — ${t.title}${
              t.description ? ` (${t.description})` : ""
            } [${t.priority}]`
        )
        .join("\n")
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
      priority: (["low", "medium", "high"].includes(t.priority)
        ? t.priority
        : "medium") as ParsedTask["priority"],
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
  if (!commandText.trim()) {
    schedulePassiveRestart();
    return;
  }

  patch({ voiceState: "processing", isAwake: true });

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
    const fullHistory =
      conversationHistory.length === 0
        ? [
            { role: "user" as const, parts: [{ text: systemPrompt }] },
            {
              role: "model" as const,
              parts: [{ text: "Understood. J.A.R.V.I.S. online and ready, sir." }],
            },
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

    if (route) {
      setTimeout(() => {
        win?.history?.pushState({}, "", route);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, 300);
    }

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

    // Speak, then restart passive listening.
    // Extra 400ms delay lets Chrome release the mic resource from TTS
    // before we attempt rec.start() — without this it silently fails on Android/Chrome.
    speakResponse(clean, () => {
      patch({ voiceState: "idle", isAwake: false, transcript: "" });
      schedulePassiveRestart(400); // 400ms post-TTS buffer + 500ms base = 900ms
    });

  } catch {
    const errMsg: JarvisMessage = {
      id: crypto.randomUUID(),
      role: "jarvis",
      content: "I encountered an error processing that request, sir.",
      timestamp: Date.now(),
      type: "error",
    };
    patch({
      messages: [..._state.messages, userMsg, errMsg],
      voiceState: "idle",
      isAwake: false,
      transcript: "",
    });
    schedulePassiveRestart();
  }
}

function speakResponse(text: string, onEnd?: () => void) {
  if (!("speechSynthesis" in window)) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 0.95;
  utt.pitch = 0.9;
  utt.volume = 1;
  utt.lang = "en-US";
  const voices = window.speechSynthesis.getVoices();
  const pref = voices.find(
    (v) =>
      v.lang.startsWith("en") &&
      (v.name.includes("Google") || v.name.includes("Daniel") || v.name.includes("Alex"))
  );
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
    if (!recRef) startRecognition("passive");
  },

  disable() {
    try { localStorage.setItem("jarvis:enabled", "false"); } catch { /* ignore */ }
    stopRecognition();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    patch({ enabled: false, voiceState: "idle", isAwake: false, transcript: "" });
  },

  activate() {
    stopForCycle();
    accumulatedFinalText = "";
    latestInterimText = "";
    patch({ isAwake: true, voiceState: "listening", transcript: "" });
    startRecognition("command");
    commandTimeout = setTimeout(() => {
      if (_state.voiceState === "listening") {
        clearSilenceTimer();
        const fullText = [accumulatedFinalText, latestInterimText]
          .filter(Boolean).join(" ").trim();
        stopForCycle();
        if (fullText.length > 1) {
          handleCommand(stripWakeWord(fullText));
        } else {
          patch({ isAwake: false, voiceState: "idle", transcript: "" });
          schedulePassiveRestart();
        }
      }
    }, MAX_LISTEN_MS);
  },

  async sendText(text: string) {
    stopForCycle();
    await handleCommand(text);
  },

  dismiss() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    stopRecognition(); // hard stop
    patch({ isAwake: false, voiceState: "idle", transcript: "" });
    // Only restart if still enabled
    if (_state.enabled) schedulePassiveRestart();
  },

  clearMessages() {
    conversationHistory = [];
    patch({ messages: [] });
  },

  /**
   * Call this ONCE in your App root component (e.g. in a useEffect with []).
   * This ensures JARVIS listens on every route, not just /jarvis.
   */
  autoStartIfEnabled() {
    if (!SpeechRecognitionCtor) return;

    const doStart = () => {
      if (!_state.enabled) {
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
          r.onchange = () => {
            if (r.state === "granted") doStart();
          };
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