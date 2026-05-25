/**
 * JARVIS — Just A Rather Very Intelligent System
 * Global state store + voice engine + Gemini integration
 * Phase 1: Persistent sessions, function calling, TTSQueue, audio state machine
 */

import { useSyncExternalStore } from "react";
import { WakeWordEngine } from "openwakeword-wasm-browser";
import { geminiAPI } from "@/lib/gemini";
import type { GeminiMessage } from "@/lib/gemini";
import { getHorizonTasks, ensureBooted } from "@/lib/horizon";
import type { HorizonTask } from "@/lib/horizon";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

export type JarvisAudioState =
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "interrupted"
  | "error";

export type JarvisVoiceState = JarvisAudioState;

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
  type?: "text" | "task_created" | "memory_saved" | "error" | "interrupted" | "morning_briefing" | "search_result";
  tasks?: ParsedTask[];
  metadata?: Record<string, unknown>;
};

export type Memory = {
  id: string;
  content: string;
  memory_type: "general" | "preference" | "commitment" | "idea" | "fact";
  source_session_id: string | null;
  recalled_count: number;
  created_at: string;
  last_recalled_at: string | null;
};

export type JarvisSession = {
  id: string;
  started_at: string;
  ended_at: string | null;
  session_summary: string | null;
  message_count: number;
  tags: string[];
};

// ─── Conversational Runtime ───────────────────────────────────────────────────

type ConversationMode = "idle" | "active" | "cooling-down";
// idle         — no active conversation, wake word required to start
// active       — in the middle of a conversation, auto-resumes after each reply
// cooling-down — reply finished, waiting N seconds for follow-up before ending

type DialoguePolicy =
  | "answering"       // giving a direct answer
  | "clarifying"      // asking a clarifying question
  | "task-executing"  // creating a task or saving memory
  | "conversational"  // casual back and forth
  | "closing";        // user is wrapping up

interface ConversationRuntimeState {
  mode: ConversationMode;
  policy: DialoguePolicy;
  turnCount: number;            // how many exchanges in current conversation
  lastUserMessageAt: number;    // timestamp of last user message
  lastReplyAt: number;          // timestamp of last Jarvis reply
  cooldownTimeoutId: ReturnType<typeof setTimeout> | null;
}

export type IntentType =
  | "task_creation"
  | "memory_capture"
  | "task_query"
  | "memory_query"
  | "task_management"
  | "search_query"
  | "conversation";

type JarvisState = {
  voiceState: JarvisAudioState;
  isAwake: boolean;
  messages: JarvisMessage[];
  transcript: string;
  enabled: boolean;
  currentSessionId: string | null;
  recentMemories: Memory[];
  sessionSummaries: string[];
  systemPrompt: string;
};

// ─── Browser compat ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const win = typeof window !== "undefined" ? (window as any) : undefined;
const SpeechRecognitionCtor: (new () => unknown) | undefined =
  win?.SpeechRecognition ?? win?.webkitSpeechRecognition;

export const isJarvisSupported = Boolean(SpeechRecognitionCtor);

const WAKE_WORDS = ["jarvis", "hey jarvis", "okay jarvis"];

// ─── OpenWakeWord constants ───────────────────────────────────────────────────

// detectionThreshold: 0.0–1.0
// 0.5 = default (requires raised voice in noisy environments)
// 0.35 = recommended for desktop normal use
// 0.2 = very sensitive (may false-trigger on similar words)
const WAKE_DETECT_THRESHOLD = 0.35;
// Minimum ms between wake-word triggers to prevent double-firing on echo
const WAKE_COOL_MS = 2500;

let _wakeWordEngine: InstanceType<typeof WakeWordEngine> | null = null;
let _wakeWordActive = false;
let _wakeWordInitializing = false;

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
    try {
      return localStorage.getItem("jarvis:enabled") === "true";
    } catch {
      return false;
    }
  })(),
  currentSessionId: null,
  recentMemories: [],
  sessionSummaries: [],
  systemPrompt: "",
};

// ─── Conversational runtime state ─────────────────────────────────────────────

const _conversationRuntime: ConversationRuntimeState = {
  mode: "idle",
  policy: "answering",
  turnCount: 0,
  lastUserMessageAt: 0,
  lastReplyAt: 0,
  cooldownTimeoutId: null,
};

// How long to wait for follow-up before ending conversation (ms)
const CONVERSATION_COOLDOWN_MS = 8000;

// Phrases that signal the user wants to end the conversation
const CONVERSATION_END_PHRASES = [
  "goodbye", "bye", "bye bye", "that's all", "thats all",
  "thank you", "thanks", "that's it", "thats it",
  "i'm done", "im done", "stop", "exit", "end",
  "nothing else", "no more", "we're done", "were done",
];

// Session creation guard — prevents duplicate sessions within the same visit
let _sessionStartedThisVisit = false;
// Briefing guard — prevents double-fire from React StrictMode double-invocation
let _briefingDeliveredThisSession = false;

function emit() {
  listeners.forEach((fn) => fn());
}

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

// ─── Audio State Machine ──────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<JarvisAudioState, JarvisAudioState[]> = {
  idle:        ["listening", "error"],
  listening:   ["processing", "idle", "error"],
  processing:  ["speaking", "error", "idle"],
  speaking:    ["idle", "interrupted", "error"],
  interrupted: ["listening", "idle"],
  error:       ["idle"],
};

export function canTransitionTo(
  from: JarvisAudioState,
  to: JarvisAudioState,
): boolean {
  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    console.warn(`[JARVIS] Invalid state transition: ${from} → ${to}`);
    return false;
  }
  return true;
}

/**
 * Central voice state transition. Handles interrupt listener lifecycle:
 * - Starts interrupt listener when entering `speaking`
 * - Stops interrupt listener when leaving `speaking`
 * Pass `extra` to patch additional state fields atomically.
 */
function transitionAudioState(
  next: JarvisAudioState,
  extra?: Partial<Omit<JarvisState, "voiceState">>,
): void {
  const prev = _state.voiceState;

  // Leaving speaking state — tear down interrupt listener
  if (prev === "speaking" && next !== "speaking") {
    stopInterruptListener();
  }

  patch({ voiceState: next, ...extra });

  // Entering speaking state — start interrupt listener
  if (next === "speaking" && prev !== "speaking") {
    startInterruptListener();
  }

  // When returning to idle after speaking, if conversation cooldown is active
  // the cooldown timer is managing the auto-resume — do not restart wake word.
  if (next === "idle" && _conversationRuntime.mode === "cooling-down") {
    return;
  }
}

// ─── Text cleaner for TTS ─────────────────────────────────────────────────────

/**
 * Strips markdown syntax before passing text to TTS so it doesn't read
 * "asterisk asterisk bold asterisk asterisk" aloud.
 */
function cleanTextForSpeech(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/`{3}[\s\S]*?`{3}/g, "code block omitted")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ─── Interrupt listener ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _interruptRecognition: any = null;

const INTERRUPT_WORDS = ["stop", "wait", "hold on", "shut up", "pause", "enough", "quiet"];

function startInterruptListener(): void {
  if (!SpeechRecognitionCtor) return;
  if (_interruptRecognition) return;

  function createAndStart(): void {
    if (_state.voiceState !== "speaking") return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition: any = new SR();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript: string = event.results[0][0].transcript.toLowerCase().trim();
        if (INTERRUPT_WORDS.some((w) => transcript.includes(w))) {
          ttsQueue.interrupt();
          stopInterruptListener();
          transitionAudioState("interrupted");
          setTimeout(() => {
            if (_state.voiceState === "interrupted") {
              transitionAudioState("idle");
            }
          }, 800);
        }
      };

      // On end — create a fresh instance rather than restarting the ended one
      recognition.onend = () => {
        if (_state.voiceState === "speaking") {
          setTimeout(() => {
            if (_state.voiceState === "speaking") {
              createAndStart();
            }
          }, 100);
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        // Non-fatal errors — restart if still in speaking state
        if (event.error === "aborted" || event.error === "no-speech") {
          if (_state.voiceState === "speaking") {
            setTimeout(() => createAndStart(), 200);
          }
        }
      };

      _interruptRecognition = recognition;
      recognition.start();
    } catch {
      // Best-effort — interrupt is not critical
    }
  }

  createAndStart();
}

function stopInterruptListener(): void {
  if (_interruptRecognition) {
    try {
      _interruptRecognition.stop();
    } catch {
      // Ignore
    }
    _interruptRecognition = null;
  }
}

// ─── Kokoro TTS Manager ───────────────────────────────────────────────────────

class KokoroManager {
  private worker: Worker | null = null;
  private isReady: boolean = false;
  private isLoading: boolean = false;
  private pendingCallbacks: Map<
    string,
    {
      resolve: (value: { audioData: Float32Array; sampleRate: number }) => void;
      reject: (err: Error) => void;
    }
  > = new Map();
  private onLoadingCallback: ((msg: string) => void) | null = null;

  initialize(onLoading?: (msg: string) => void): void {
    if (this.worker || this.isLoading) return;
    this.onLoadingCallback = onLoading ?? null;
    this.isLoading = true;

    try {
      this.worker = new Worker(
        new URL("../workers/kokoro-worker.js", import.meta.url),
        { type: "module" },
      );

      this.worker.onmessage = (event) => {
        const { type, id, audioData, sampleRate, error, message, ready } = event.data;

        if (type === "loading") {
          this.onLoadingCallback?.(message as string);
        }

        if (type === "load_status") {
          this.isReady = ready as boolean;
          this.isLoading = false;
        }

        if (type === "load_error") {
          this.isReady = false;
          this.isLoading = false;
          console.warn("[Kokoro] Failed to load model:", error);
        }

        if (type === "synth_result") {
          const cb = this.pendingCallbacks.get(id as string);
          if (cb) {
            this.pendingCallbacks.delete(id as string);
            cb.resolve({ audioData: new Float32Array(audioData as ArrayBuffer), sampleRate: sampleRate as number });
          }
        }

        if (type === "synth_error") {
          const cb = this.pendingCallbacks.get(id as string);
          if (cb) {
            this.pendingCallbacks.delete(id as string);
            cb.reject(new Error(error as string));
          }
        }
      };

      this.worker.onerror = (err) => {
        console.warn("[Kokoro] Worker error:", err);
        this.isReady = false;
        this.isLoading = false;
      };

      this.worker.postMessage({ type: "load" });
    } catch (err) {
      console.warn("[Kokoro] Failed to initialize worker:", err);
      this.isLoading = false;
    }
  }

  async synthesize(
    text: string,
    voice = "am_adam",
  ): Promise<{ audioData: Float32Array; sampleRate: number }> {
    if (!this.worker || !this.isReady) {
      throw new Error("Kokoro not ready");
    }
    const id = `synth_${Date.now()}_${Math.random()}`;
    return new Promise((resolve, reject) => {
      this.pendingCallbacks.set(id, { resolve, reject });
      this.worker!.postMessage({ type: "synthesize", text, voice, id });
    });
  }

  get ready(): boolean {
    return this.isReady;
  }

  get loading(): boolean {
    return this.isLoading;
  }

  destroy(): void {
    this.worker?.terminate();
    this.worker = null;
    this.isReady = false;
    this.pendingCallbacks.clear();
  }
}

export const kokoroManager = new KokoroManager();

// ─── Browser TTS voice selector ───────────────────────────────────────────────

function getBestMaleVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  // Priority order — best quality male voices across platforms
  const priority = [
    "Google UK English Male",
    "Microsoft Ryan Online (Natural)",  // Edge neural voice
    "Microsoft Guy Online (Natural)",   // Edge neural voice
    "Microsoft David Desktop",
    "Microsoft Mark Desktop",
    "Google US English",
    "Alex",    // macOS
    "Daniel",  // macOS UK
    "Fred",    // macOS
  ];

  for (const name of priority) {
    const match = voices.find((v) =>
      v.name.toLowerCase().includes(name.toLowerCase()),
    );
    if (match) return match;
  }

  // Any online/neural voice — Edge has excellent neural voices
  const neural = voices.find(
    (v) =>
      v.name.toLowerCase().includes("online") ||
      v.name.toLowerCase().includes("natural") ||
      v.name.toLowerCase().includes("neural"),
  );
  if (neural) return neural;

  // Any male-labeled voice
  const male = voices.find((v) => v.name.toLowerCase().includes("male"));
  if (male) return male;

  // English fallback
  return voices.find((v) => v.lang.startsWith("en")) ?? null;
}

// ─── TTSQueue ─────────────────────────────────────────────────────────────────

class TTSQueue {
  private queue: string[] = [];
  private isPlaying = false;
  private onDoneCallback: (() => void) | null = null;
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;
  private currentSource: AudioBufferSourceNode | null = null;

  enqueue(text: string, onDone?: () => void): void {
    this.onDoneCallback = onDone ?? null;
    const sentences = this.splitIntoSentences(text);
    this.queue.push(...sentences);
    if (!this.isPlaying) {
      this.isPlaying = true;
      this.startKeepAlive();
      void this.playNext();
    }
  }

  private async playNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      this.stopKeepAlive();
      // All sentences spoken — start cooldown NOW, not when enqueue() was called
      startConversationCooldown();
      transitionAudioState("idle", { isAwake: false, transcript: "" });
      this.onDoneCallback?.();
      this.onDoneCallback = null;
      return;
    }

    const sentence = this.queue.shift()!;

    // Try Kokoro neural TTS first — much better quality than browser TTS
    if (kokoroManager.ready) {
      try {
        const { audioData, sampleRate } = await kokoroManager.synthesize(sentence);
        const audioContext = new AudioContext();
        const buffer = audioContext.createBuffer(1, audioData.length, sampleRate);
        buffer.getChannelData(0).set(audioData);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.onended = () => {
          audioContext.close();
          this.currentSource = null;
          void this.playNext();
        };
        source.start(0);
        this.currentSource = source;
        return;
      } catch (err) {
        console.warn("[Kokoro] Synthesis failed, falling back to browser TTS:", err);
        // fall through to browser TTS
      }
    }

    // Browser TTS fallback
    if (!("speechSynthesis" in window)) {
      void this.playNext();
      return;
    }

    if (!kokoroManager.ready) {
      console.log("[TTS] Using browser fallback voice:", getBestMaleVoice()?.name ?? "default");
    }

    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.rate = 0.92;   // slightly slower — more natural pacing
    utterance.pitch = 0.85;  // lower pitch — masculine
    utterance.volume = 1.0;
    utterance.lang = "en-US";

    if (window.speechSynthesis.getVoices().length === 0) {
      await new Promise<void>((resolve) => {
        window.speechSynthesis.onvoiceschanged = () => resolve();
        setTimeout(resolve, 1000);
      });
    }

    const maleVoice = getBestMaleVoice();
    if (maleVoice) utterance.voice = maleVoice;

    // Timeout fallback — Chrome's onend is unreliable, especially after ~15s.
    // Estimate based on character count + generous buffer.
    const estimatedMs = Math.max((sentence.length / 12) * 1000, 3000) + 4000;
    let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      window.speechSynthesis.cancel();
      this.queue = [];
      this.isPlaying = false;
      this.stopKeepAlive();
      transitionAudioState("idle", { isAwake: false, transcript: "" });
    }, estimatedMs);

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    utterance.onend = () => {
      cleanup();
      void this.playNext();
    };

    utterance.onerror = () => {
      cleanup();
      this.isPlaying = false;
      this.stopKeepAlive();
      transitionAudioState("idle", { isAwake: false, transcript: "" });
    };

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Chrome has a known bug where speechSynthesis pauses after ~15s and never
   * resumes. This keepalive nudges it every 10s to prevent the hang.
   */
  private startKeepAlive(): void {
    if (this.keepAliveInterval) return;
    this.keepAliveInterval = setInterval(() => {
      if (
        typeof window !== "undefined" &&
        "speechSynthesis" in window &&
        window.speechSynthesis.speaking &&
        !window.speechSynthesis.paused
      ) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  interrupt(): void {
    this.queue = [];
    this.isPlaying = false;
    this.stopKeepAlive();
    if (this.currentSource) {
      try { this.currentSource.stop(); } catch { /* ignore — already stopped */ }
      this.currentSource = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    transitionAudioState("interrupted");
    setTimeout(() => {
      if (_state.voiceState === "interrupted") {
        transitionAudioState("listening");
      }
    }, 800);
  }

  private splitIntoSentences(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+|\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

const ttsQueue = new TTSQueue();

// ─── Intent Classifier ────────────────────────────────────────────────────────

export function classifyIntent(message: string): IntentType {
  const lower = message.toLowerCase();

  // Task query — expanded patterns for natural phrasing
  const taskQueryPatterns = [
    /what('?s| is) (up |on |my )?(for )?today/i,
    /what (do i|have i) (have|got) today/i,
    /what all (have|do) (we|i) (got|have)/i,
    /today'?s tasks?/i,
    /my (tasks?|schedule|agenda|plan) (for )?today/i,
    /what('?s| is) (pending|due|scheduled)/i,
    /show (me )?(my )?(tasks?|schedule|agenda)/i,
    /tasks? for today/i,
    /what (should|do) i (do|work on) today/i,
    /highest priority/i,
    /what'?s (on )?my (plate|list)/i,
  ];
  if (taskQueryPatterns.some((p) => p.test(message))) return "task_query";

  if (
    /remind me|add task|schedule|don't forget|dont forget|need to|set a reminder|create a task|appointment|deadline|due (on|by|at)|tomorrow at|today at|book a|meeting at/.test(lower)
  )
    return "task_creation";

  if (/remember that|save this|note that|keep in mind|don't forget that|make a note|jot down/.test(lower))
    return "memory_capture";

  if (/what do i have|what('s| is) today|my tasks|pending (tasks?|work)|what's (due|scheduled)|show me (my|today)|what (do i need|should i do)|anything (today|scheduled)/.test(lower))
    return "task_query";

  if (/what do you remember|do you (know|recall)|what did i (tell|say|mention)|my preference|what('s| is) my/.test(lower))
    return "memory_query";

  if (/delete (task|reminder)|remove (task|reminder)|reschedule|update (task|reminder)|change (the|my) (task|reminder|schedule)|cancel (task|reminder|meeting)|move (the|my) (task|meeting)/.test(lower))
    return "task_management";

  // Search queries — broad pattern set including "what is X" definitional queries
  const searchPatterns = [
    /^what is\b/i,
    /^what are\b/i,
    /^who is\b/i,
    /^who are\b/i,
    /^when (was|did|is|are)\b/i,
    /^where (is|are|was)\b/i,
    /^why (is|are|did|does)\b/i,
    /^how (does|do|did|much|many|long|far)\b/i,
    /latest|recent|current|breaking|today'?s news/i,
    /search for|look up|look it up|find out|google|tell me about/i,
    /news about|what happened|update on/i,
    /price of|how much (is|does|do)/i,
    /weather|temperature|forecast/i,
    /vs\b|versus|compare|difference between/i,
  ];
  if (searchPatterns.some((p) => p.test(message))) return "search_query";

  return "conversation";
}

// ─── Morning Briefing ─────────────────────────────────────────────────────────

export function shouldDeliverMorningBriefing(): boolean {
  if (_briefingDeliveredThisSession) return false;
  try {
    const last = localStorage.getItem("jarvis:last-briefing-date");
    const today = new Date().toISOString().split("T")[0];
    return last !== today;
  } catch {
    return false;
  }
}

function markBriefingDelivered(): void {
  _briefingDeliveredThisSession = true;
  try {
    localStorage.setItem("jarvis:last-briefing-date", new Date().toISOString().split("T")[0]);
  } catch {
    /* ignore */
  }
}

function buildMorningBriefingPrompt(tasks: HorizonTask[]): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const highPriority = tasks.filter((t) => t.priority === "high");
  const medLow = tasks.filter((t) => t.priority !== "high");

  let taskSection = "";
  if (tasks.length === 0) {
    taskSection = "The user has no tasks scheduled for today. Acknowledge this and suggest it's a good day to plan.";
  } else {
    const lines: string[] = [];
    if (highPriority.length > 0) {
      lines.push(`High priority: ${highPriority.map((t) => t.title).join(", ")}`);
    }
    if (medLow.length > 0) {
      lines.push(`Other tasks: ${medLow.map((t) => t.title).join(", ")}`);
    }
    taskSection = lines.join(". ");
  }

  return `Today is ${dateStr}. Generate a short morning briefing for the user. ${taskSection}. Rules: vary the greeting (not always "Good morning"), reference the actual date and day, mention high-priority tasks by name first, end with one honest non-cheesy motivational line relevant to their tasks. Keep it under 100 words. Tone: warm but direct, like a sharp friend. No markdown, no asterisks, plain spoken text only.`;
}

/**
 * Delivers the morning briefing if not already delivered today.
 * Lazily creates a session if needed so the briefing is persisted.
 */
export async function deliverMorningBriefing(): Promise<void> {
  if (!shouldDeliverMorningBriefing()) return;
  // Mark BEFORE any async work — prevents double-fire even on re-render mid-generation
  markBriefingDelivered();

  const today = new Date().toISOString().split("T")[0];
  const allTasks = getHorizonTasks();
  const todayTasks = allTasks.filter((t) => t.taskDate === today && !t.completed);
  const prompt = buildMorningBriefingPrompt(todayTasks);

  transitionAudioState("processing");

  try {
    const text = await geminiAPI.generateContent(prompt, []);
    if (!text || text.startsWith("API key")) {
      transitionAudioState("idle");
      return;
    }

    // Lazy session creation — morning briefing counts as first interaction
    if (!_state.currentSessionId) {
      await startSession();
    }
    const sessionId = _state.currentSessionId ?? "";

    const msg: JarvisMessage = {
      id: crypto.randomUUID(),
      role: "jarvis",
      content: text,
      timestamp: Date.now(),
      type: "morning_briefing",
    };

    patch({ messages: [..._state.messages, msg] });
    transitionAudioState("speaking");

    saveMessage(sessionId, "assistant", text, "morning_briefing").catch(() => null);

    ttsQueue.enqueue(cleanTextForSpeech(text), () => {
      transitionAudioState("idle", { isAwake: false, transcript: "" });
      if (_state.enabled) setTimeout(() => void startWakeWordDetection(), 400);
    });
  } catch (err) {
    console.warn("[JARVIS] Morning briefing failed:", err);
    transitionAudioState("idle");
  }
}

// ─── Session Management ───────────────────────────────────────────────────────

/**
 * Creates a new session row. Idempotent within a single page visit —
 * if a session was already created this visit, returns the existing ID.
 */
export async function startSession(): Promise<string> {
  if (_sessionStartedThisVisit && _state.currentSessionId) {
    return _state.currentSessionId;
  }

  try {
    const { data, error } = await supabase
      .from("jarvis_sessions")
      .insert({ started_at: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    const sessionId = (data as { id: string }).id;
    _sessionStartedThisVisit = true;
    patch({ currentSessionId: sessionId });
    return sessionId;
  } catch (err) {
    console.warn("[JARVIS] Session creation failed — running without persistence:", err);
    return "";
  }
}

/**
 * Ends a session. If the session has zero messages it is deleted outright
 * (never persist ghost sessions). Otherwise a summary is generated and saved.
 */
export async function endSession(sessionId: string): Promise<void> {
  if (!sessionId) return;
  _sessionStartedThisVisit = false;

  try {
    const { count } = await supabase
      .from("jarvis_messages")
      .select("*", { count: "exact", head: true })
      .eq("session_id", sessionId);

    if (!count || count === 0) {
      await supabase.from("jarvis_sessions").delete().eq("id", sessionId);
      return;
    }

    const messages = _state.messages;
    const messageCount = messages.length;
    let summary: string | null = null;

    if (messageCount >= 4) {
      const convoText = messages
        .slice(-20)
        .map((m) => `${m.role === "user" ? "User" : "JARVIS"}: ${m.content}`)
        .join("\n");

      try {
        summary = await geminiAPI.generateContent(
          `Summarize this conversation in 2-3 sentences, focusing on key decisions, tasks created, and things to remember. Be concise:\n\n${convoText}`,
        );
      } catch {
        summary = null;
      }
    }

    await supabase
      .from("jarvis_sessions")
      .update({
        ended_at: new Date().toISOString(),
        session_summary: summary,
        message_count: messageCount,
      })
      .eq("id", sessionId);
  } catch (err) {
    console.error("[JARVIS] endSession error:", err);
  }
}

/**
 * Updates message_count on the session row to reflect the actual count in DB.
 * Fire-and-forget — caller should not await.
 */
async function updateSessionMessageCount(sessionId: string): Promise<void> {
  if (!sessionId) return;
  try {
    const { count } = await supabase
      .from("jarvis_messages")
      .select("*", { count: "exact", head: true })
      .eq("session_id", sessionId);

    await supabase
      .from("jarvis_sessions")
      .update({ message_count: count ?? 0 })
      .eq("id", sessionId);
  } catch {
    // Non-critical — ignore
  }
}

export async function saveMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  messageType: "conversation" | "task_created" | "memory_saved" | "error" | "morning_briefing" | "search_result" = "conversation",
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (!sessionId) return;
  try {
    await supabase.from("jarvis_messages").insert({
      session_id: sessionId,
      role,
      content,
      message_type: messageType,
      metadata: metadata ?? null,
    });
  } catch (err) {
    console.warn("[JARVIS] saveMessage error:", err);
  }
}

export async function loadSessionMessages(sessionId: string): Promise<JarvisMessage[]> {
  try {
    const { data, error } = await supabase
      .from("jarvis_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (
      data as Array<{
        id: string;
        role: string;
        content: string;
        created_at: string;
        message_type: string;
      }>
    ).map((row) => ({
      id: row.id,
      role: (row.role === "user" ? "user" : "jarvis") as "user" | "jarvis",
      content: row.content,
      timestamp: new Date(row.created_at).getTime(),
      type: (row.message_type as JarvisMessage["type"]) ?? "text",
    }));
  } catch {
    return [];
  }
}

export async function getRecentSessionSummaries(limit = 3): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("jarvis_sessions")
      .select("session_summary")
      .not("session_summary", "is", null)
      .order("started_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as Array<{ session_summary: string }>)
      .map((r) => r.session_summary)
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function getRecentMemories(limit = 20): Promise<Memory[]> {
  try {
    const { data, error } = await supabase
      .from("jarvis_memory")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as Memory[]) ?? [];
  } catch {
    return [];
  }
}

/**
 * Fetches sessions for the History tab. Filters out empty sessions and
 * paginates with `page` / `perPage`.
 */
export async function getSessions(page = 0, perPage = 10): Promise<JarvisSession[]> {
  try {
    const { data, error } = await supabase
      .from("jarvis_sessions")
      .select("*")
      .gt("message_count", 0)
      .order("started_at", { ascending: false })
      .range(page * perPage, (page + 1) * perPage - 1);
    if (error) throw error;
    return (data as JarvisSession[]) ?? [];
  } catch {
    return [];
  }
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("jarvis_sessions").delete().eq("id", sessionId);
    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}

export async function getAllMemories(memoryType?: string): Promise<Memory[]> {
  try {
    let query = supabase
      .from("jarvis_memory")
      .select("*")
      .order("created_at", { ascending: false });
    if (memoryType && memoryType !== "all") {
      query = query.eq("memory_type", memoryType);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data as Memory[]) ?? [];
  } catch {
    return [];
  }
}

export async function deleteMemory(memoryId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("jarvis_memory").delete().eq("id", memoryId);
    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}

// ─── Timeline context ─────────────────────────────────────────────────────────

interface TimelineMonthContext {
  monthKey: string;
  context: string;
  generatedSchedule: string | null;
}

async function fetchTimelineContext(): Promise<TimelineMonthContext[]> {
  try {
    const { data, error } = await supabase
      .from("timeline_months")
      .select("month_key, context, generated_schedule")
      .neq("context", "") // only months that have goals written
      .order("month_key", { ascending: true });

    if (error || !data) return [];

    return (data as Array<{ month_key: string; context: string; generated_schedule: string | null }>)
      .map((row) => ({
        monthKey: row.month_key,
        context: row.context,
        generatedSchedule: row.generated_schedule,
      }));
  } catch {
    return [];
  }
}

// ─── System Prompt Builder ────────────────────────────────────────────────────

export function buildJarvisSystemPrompt(
  memories: Memory[],
  summaries: string[],
  timelineMonths?: TimelineMonthContext[],
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const todayKey = now.toISOString().split("T")[0];
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = tomorrow.toISOString().split("T")[0];

  let userContext = "";
  try {
    const saved = localStorage.getItem("jarvis:user-context");
    if (saved?.trim()) userContext = `\nUSER CONTEXT:\n${saved}\n`;
  } catch {
    /* ignore */
  }

  const allTasks = getHorizonTasks();
  const todayTasks = allTasks.filter((t) => t.taskDate === todayKey && !t.completed);
  const highPriority = todayTasks.filter((t) => t.priority === "high");

  const memoriesSection =
    memories.length > 0
      ? `\nPERSISTENT MEMORIES (${memories.length}):\n${memories.map((m) => `• [${m.memory_type}] ${m.content}`).join("\n")}`
      : "";

  const summariesSection =
    summaries.length > 0
      ? `\nRECENT SESSION SUMMARIES:\n${summaries.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
      : "";

  const timelineSection =
    timelineMonths && timelineMonths.length > 0
      ? `\nMONTHLY GOALS & TIMELINE (what the user is working toward):\n${timelineMonths
          .map(
            (m) =>
              `\n[${m.monthKey}]\nGoals: ${m.context.slice(0, 400)}${m.context.length > 400 ? "..." : ""}`,
          )
          .join("")}\n\nUse this to understand the user's broader goals when answering questions. If they ask about progress or plans, reference these goals.`
      : "";

  const taskSection =
    todayTasks.length > 0
      ? `\nTODAY'S TASKS (${todayKey}) — ${todayTasks.length} pending:\n${todayTasks.map((t) => `• ${t.taskTime} ${t.title} (${t.priority})`).join("\n")}${highPriority.length > 0 ? `\nHIGH PRIORITY TODAY: ${highPriority.map((t) => t.title).join(", ")}` : ""}`
      : `\nNo tasks scheduled for today (${todayKey}).`;

  return `You are JARVIS — Just A Rather Very Intelligent System.
You are the personal AI of a single user: a student, developer, and freelancer who juggles multiple contexts simultaneously.
${userContext}
Current time: ${timeStr} on ${dateStr}
Today's date: ${todayKey}
Tomorrow's date: ${tomorrowKey}

PERSONALITY:
- You are honest, direct, and occasionally blunt.
- You push back when the user is wrong or making a bad decision. You do this respectfully but without sugarcoating.
- You are not a yes-man. Correct the user when they are wrong. Name flaws in their plans.
- You are warm but not sycophantic. Do not say "Great question!" or "Absolutely!" or pad responses with fake enthusiasm.
- You speak like a sharp, aware person — not a corporate assistant.
- You notice emotional cues. If the user seems stressed, rushed, or overwhelmed, acknowledge it briefly and adjust your tone.
- You do not ask multiple questions at once. If you need clarification, ask one question only.
- You remember everything said in this conversation and reference it naturally when relevant.

RESPONSE STYLE:
- Keep responses concise unless depth is genuinely needed.
- Use plain language. No corporate jargon. No markdown, no asterisks.
- When confirming a task or memory action, confirm briefly and move on.
- When the user is just talking, just talk back. Not everything needs an action.

NAVIGATION:
If user says "open [page]" or "go to [page]", include: [NAVIGATE:/route]
Routes: /horizon, /ask, /desktop, /prompts, /links, /images, /messages, /insights, /context, /

IMPORTANT RULES:
- Never pretend to have done something you haven't.
- Never make up task IDs, dates, or data.
- If you don't know something, say so directly.
- If the user's request is ambiguous, make a reasonable assumption and state what you assumed.
${memoriesSection}
${summariesSection}
${timelineSection}
${taskSection}

CONVERSATIONAL BEHAVIOR:
- You are in a live voice conversation, not a chat interface.
- After answering, if the topic has natural follow-up potential, ask ONE short follow-up question to keep the conversation going.
- Do NOT ask follow-up questions after task creation or memory saves — just confirm briefly and stop.
- Do NOT ask follow-up questions if the user seems to be wrapping up.
- Keep conversational replies short — 1 to 3 sentences max unless the user explicitly asked for detail.
- If the user gives a short follow-up like "why?" or "how?" or "really?" — you know they're continuing the conversation. Respond naturally, briefly.
- Never start a response with "As an AI" or "I should mention" or similar.
- Current conversation turn: ${_conversationRuntime.turnCount}
- Current dialogue mode: ${_conversationRuntime.policy}`;
}

// ─── OpenWakeWord engine ──────────────────────────────────────────────────────

async function startWakeWordDetection(): Promise<void> {
  // Only on desktop — mobile users tap-to-talk exclusively
  if (isMobileUA()) return;
  if (_wakeWordActive) return;
  if (_wakeWordInitializing) return; // prevent parallel initialization
  if (!_state.enabled) return;

  _wakeWordInitializing = true;

  try {
    // Create engine locally — do NOT assign to module state until fully ready
    const engine = new WakeWordEngine({
      baseAssetUrl: "/openwakeword/models",
      keywords: ["hey_jarvis"],
      detectionThreshold: WAKE_DETECT_THRESHOLD,
      cooldownMs: WAKE_COOL_MS,
    });

    // Step 1 — load() must complete before wiring any events
    await engine.load();

    // Step 2 — check we're still wanted after the async gap
    // (user may have disabled JARVIS while load was in progress)
    if (!_state.enabled) {
      _wakeWordInitializing = false;
      return;
    }

    // Step 3 — wire events only after load completes
    engine.on("detect", ({ keyword, score }: { keyword: string; score: number }) => {
      console.log(`[WakeWord] Detected: ${keyword} (score: ${score.toFixed(2)})`);
      if (_state.voiceState === "idle" && _state.enabled) {
        transitionAudioState("listening");
        startCommandListening();
      }
    });

    engine.on("error", (err: Error) => {
      console.warn("[WakeWord] Runtime error:", err.message);
    });

    // Step 4 — start() only after events are wired
    await engine.start();

    // Step 5 — commit to module state only after full success
    _wakeWordEngine = engine;
    _wakeWordActive = true;
    _wakeWordInitializing = false;

    console.log('[JARVIS] Wake word detection active — say "Hey Jarvis"');
  } catch (err) {
    _wakeWordInitializing = false;
    _wakeWordActive = false;
    _wakeWordEngine = null;
    console.warn("[WakeWord] Init failed — tap-to-talk still works:", (err as Error).message);
  }
}

async function stopWakeWordDetection(): Promise<void> {
  _wakeWordActive = false;
  _wakeWordInitializing = false;

  if (_wakeWordEngine) {
    // Capture reference before nulling — prevents race on event handlers
    const engine = _wakeWordEngine;
    _wakeWordEngine = null;
    try {
      await engine.stop();
    } catch {
      // Silent — engine may already be stopped
    }
  }
}

function startCommandListening(): void {
  stopRecognition();
  accumulatedFinalText = "";
  latestInterimText = "";
  patch({ isAwake: true, transcript: "" });
  startRecognition();
  commandTimeout = setTimeout(() => {
    if (_state.voiceState === "listening") {
      clearSilenceTimer();
      const fullText = [accumulatedFinalText, latestInterimText].filter(Boolean).join(" ").trim();
      stopRecognition();
      if (fullText.length > 1) {
        handleCommand(stripWakeWord(fullText));
      } else {
        patch({ isAwake: false, transcript: "" });
        transitionAudioState("idle");
      }
    }
  }, MAX_LISTEN_MS);
}

// ─── SpeechRecognition engine ─────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let recRef: any = null;
let intentionalStop = false;
let restartTimer: ReturnType<typeof setTimeout> | undefined;
let commandTimeout: ReturnType<typeof setTimeout> | undefined;
let silenceTimer: ReturnType<typeof setTimeout> | undefined;
let accumulatedFinalText = "";
let latestInterimText = "";

const SILENCE_THRESHOLD_MS = 1200;
const MAX_LISTEN_MS = 20000;

function clearSilenceTimer() {
  clearTimeout(silenceTimer);
  silenceTimer = undefined;
}

function armSilenceTimer() {
  clearSilenceTimer();
  silenceTimer = setTimeout(() => {
    const fullText = [accumulatedFinalText, latestInterimText].filter(Boolean).join(" ").trim();
    if (fullText.length > 1) {
      stopRecognition();
      const stripped = stripWakeWord(fullText);
      if (stripped.length > 1) {
        handleCommand(stripped);
      } else {
        patch({ isAwake: false, transcript: "" });
        transitionAudioState("idle");
        if (_state.enabled) void startWakeWordDetection();
      }
    } else {
      stopRecognition();
      patch({ isAwake: false, transcript: "" });
      transitionAudioState("idle");
      if (_state.enabled) void startWakeWordDetection();
    }
  }, SILENCE_THRESHOLD_MS);
}

function startRecognition(): void {
  if (!SpeechRecognitionCtor) return;
  if (recRef) return;

  clearTimeout(restartTimer);
  intentionalStop = false;
  accumulatedFinalText = "";
  latestInterimText = "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rec = new (SpeechRecognitionCtor as new () => any)();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-US";
  rec.maxAlternatives = 1;
  recRef = rec;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rec.onresult = (event: any) => {
    if (recRef !== rec) return;

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text: string = event.results[i][0].transcript.trim();
      const isFinal: boolean = event.results[i].isFinal;
      const lower = text.toLowerCase();

      // Interrupt detection while speaking
      if (_state.voiceState === "speaking") {
        if (INTERRUPT_WORDS.some((w) => lower.includes(w))) {
          ttsQueue.interrupt();
          const interruptMsg: JarvisMessage = {
            id: crypto.randomUUID(),
            role: "jarvis",
            content: "— interrupted —",
            timestamp: Date.now(),
            type: "interrupted",
          };
          patch({ messages: [..._state.messages, interruptMsg] });
          return;
        }
      }

      // Command mode — accumulate transcript and arm silence timer
      clearTimeout(commandTimeout);
      clearSilenceTimer();
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
            patch({ isAwake: false, transcript: "" });
            transitionAudioState("idle");
            void startWakeWordDetection();
          }
        }
      }, MAX_LISTEN_MS);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rec.onerror = (e: any) => {
    if (recRef !== rec) return;
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      stopRecognition();
      patch({ isAwake: false });
      transitionAudioState("idle");
    }
  };

  rec.onend = () => {
    if (recRef !== rec) return;
    recRef = null;
    if (intentionalStop) return;
    // Harvest any accumulated text before restarting wake word detection
    clearSilenceTimer();
    const fullText = [accumulatedFinalText, latestInterimText].filter(Boolean).join(" ").trim();
    if (fullText.length > 1) {
      handleCommand(stripWakeWord(fullText));
      return;
    }
    void startWakeWordDetection();
  };

  try {
    rec.start();
  } catch {
    recRef = null;
    void startWakeWordDetection();
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
    try {
      recRef.abort();
    } catch {
      /* ignore */
    }
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

// ─── Markdown stripper (for display, not TTS) ─────────────────────────────────

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

// ─── Navigation parser ────────────────────────────────────────────────────────

function parseNavigate(text: string): { clean: string; route: string | null } {
  const navMatch = text.match(/\[NAVIGATE:([^\]]+)\]/);
  if (!navMatch) return { clean: text, route: null };
  const route = navMatch[1].trim();
  const clean = text.replace(/\[NAVIGATE:[^\]]+\]/, "").trim();
  return { clean, route };
}

// ─── Conversation Runtime Functions ───────────────────────────────────────────

/**
 * Starts an active conversation session.
 * Called when user first speaks after wake word or tap.
 */
function startConversation(): void {
  if (_conversationRuntime.cooldownTimeoutId) {
    clearTimeout(_conversationRuntime.cooldownTimeoutId);
    _conversationRuntime.cooldownTimeoutId = null;
  }

  _conversationRuntime.mode = "active";
  _conversationRuntime.turnCount = 0;
  _conversationRuntime.lastUserMessageAt = Date.now();

  console.log("[JARVIS] Conversation started");
}

/**
 * Ends the active conversation and returns to idle wake-word mode.
 * Called after cooldown expires or user says goodbye.
 */
function endConversation(): void {
  if (_conversationRuntime.cooldownTimeoutId) {
    clearTimeout(_conversationRuntime.cooldownTimeoutId);
    _conversationRuntime.cooldownTimeoutId = null;
  }

  _conversationRuntime.mode = "idle";
  _conversationRuntime.policy = "answering";
  _conversationRuntime.turnCount = 0;

  if (_state.voiceState !== "idle") {
    transitionAudioState("idle");
  }

  console.log("[JARVIS] Conversation ended — returning to wake word mode");
}

/**
 * Called after JARVIS finishes speaking a reply.
 * Starts cooldown timer — if user speaks within CONVERSATION_COOLDOWN_MS,
 * conversation continues. Otherwise ends.
 */
function startConversationCooldown(): void {
  // Allow reset even in cooling-down (e.g. long speech overlapping a previous cooldown)
  if (_conversationRuntime.mode === "idle") return;

  _conversationRuntime.mode = "cooling-down";
  _conversationRuntime.lastReplyAt = Date.now();

  if (_conversationRuntime.cooldownTimeoutId) {
    clearTimeout(_conversationRuntime.cooldownTimeoutId);
  }

  _conversationRuntime.cooldownTimeoutId = setTimeout(() => {
    console.log("[JARVIS] Cooldown expired — ending conversation");
    endConversation();
  }, CONVERSATION_COOLDOWN_MS);

  // Auto-resume listening for follow-up.
  // 600ms delay — gives TTS audio time to fully stop so the mic doesn't
  // pick up the final syllable as a new command.
  setTimeout(() => {
    if (
      _conversationRuntime.mode === "cooling-down" &&
      _state.enabled &&
      _state.voiceState === "idle"
    ) {
      console.log("[JARVIS] Auto-resuming — listening for follow-up");
      transitionAudioState("listening");
      startCommandListening();
    }
  }, 600);
}

/**
 * Called when user speaks during cooldown or active mode.
 * Resets cooldown and marks conversation as active again.
 */
function onUserFollowUp(): void {
  if (_conversationRuntime.cooldownTimeoutId) {
    clearTimeout(_conversationRuntime.cooldownTimeoutId);
    _conversationRuntime.cooldownTimeoutId = null;
  }

  _conversationRuntime.mode = "active";
  _conversationRuntime.turnCount += 1;
  _conversationRuntime.lastUserMessageAt = Date.now();
}

/**
 * Detects if the user's message signals they want to end the conversation.
 */
function isConversationEndingMessage(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  return CONVERSATION_END_PHRASES.some(
    (phrase) => normalized === phrase || normalized.startsWith(phrase + " "),
  );
}

/**
 * Classifies the dialogue policy for the current exchange.
 * Used to hint Gemini on how to respond.
 */
function classifyDialoguePolicy(
  userMessage: string,
  intentType: IntentType,
): DialoguePolicy {
  const normalized = userMessage.toLowerCase();

  if (isConversationEndingMessage(normalized)) return "closing";

  if (intentType === "task_creation" || intentType === "memory_capture") {
    return "task-executing";
  }

  if (intentType === "task_query" || intentType === "memory_query") {
    return "answering";
  }

  // Short messages in active conversation = likely follow-up or casual reply
  if (_conversationRuntime.mode === "active" && userMessage.length < 30) {
    return "conversational";
  }

  // Questions without clear intent may need clarification
  if (/\?$/.test(normalized) && userMessage.length < 60) {
    return "clarifying";
  }

  return "answering";
}

// ─── Conversation history (module-level) ──────────────────────────────────────

let conversationHistory: GeminiMessage[] = [];

// ─── Main command handler ─────────────────────────────────────────────────────

async function handleCommand(commandText: string) {
  if (!commandText.trim()) return;

  // ── Conversation runtime tracking ────────────────────────────────────────────
  if (_conversationRuntime.mode === "idle") {
    startConversation();
  } else {
    onUserFollowUp();
  }

  // Detect farewell — speak goodbye and end conversation
  if (isConversationEndingMessage(commandText)) {
    const farewell = "Goodbye. I'll be here when you need me.";
    patch({
      messages: [
        ..._state.messages,
        {
          id: `jarvis_${Date.now()}`,
          role: "jarvis" as const,
          content: farewell,
          timestamp: Date.now(),
          type: "text" as const,
        },
      ],
    });
    ttsQueue.enqueue(cleanTextForSpeech(farewell));
    endConversation();
    return;
  }

  // Classify dialogue policy for Gemini context
  const dialoguePolicy = classifyDialoguePolicy(
    commandText,
    classifyIntent(commandText),
  );
  _conversationRuntime.policy = dialoguePolicy;

  // Lazy session creation — only when user actually sends a message
  if (!_state.currentSessionId) {
    await startSession();
  }
  const sessionId = _state.currentSessionId ?? "";

  patch({ isAwake: true });
  transitionAudioState("processing");

  const userMsg: JarvisMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: commandText,
    timestamp: Date.now(),
    type: "text",
  };
  patch({ messages: [..._state.messages, userMsg], transcript: commandText });

  saveMessage(sessionId, "user", commandText, "conversation").then(() => {
    updateSessionMessageCount(sessionId).catch(() => null);
  }).catch(() => null);

  try {
    await ensureBooted();

    const intent = classifyIntent(commandText);
    const systemPrompt =
      _state.systemPrompt ||
      buildJarvisSystemPrompt(_state.recentMemories, _state.sessionSummaries);

    const userGeminiMsg: GeminiMessage = {
      role: "user",
      parts: [{ text: commandText }],
    };

    if (intent === "search_query") {
      const searchResult = await geminiAPI.generateWithSearch(
        [...conversationHistory, userGeminiMsg],
        systemPrompt,
      );

      conversationHistory = [
        ...conversationHistory,
        { role: "user", parts: [{ text: commandText }] },
        { role: "model", parts: [{ text: searchResult.text }] },
      ];
      if (conversationHistory.length > 20) {
        conversationHistory = conversationHistory.slice(-20);
      }

      const jarvisMsg: JarvisMessage = {
        id: crypto.randomUUID(),
        role: "jarvis",
        content: searchResult.text,
        timestamp: Date.now(),
        type: "search_result",
        metadata: { sources: searchResult.sources, searchType: searchResult.searchType },
      };

      patch({ messages: [..._state.messages, jarvisMsg] });
      transitionAudioState("speaking");

      saveMessage(sessionId, "assistant", searchResult.text, "search_result", {
        sources: searchResult.sources,
        searchType: searchResult.searchType,
      }).then(() => {
        updateSessionMessageCount(sessionId).catch(() => null);
        window.dispatchEvent(new CustomEvent("jarvis:history-refresh"));
      }).catch(() => null);

      ttsQueue.enqueue(cleanTextForSpeech(searchResult.text), () => {
        if (_state.enabled && _conversationRuntime.mode === "idle") {
          setTimeout(() => void startWakeWordDetection(), 400);
        }
      });

      return;
    }

    const intentHint = `\nThe user's message has been pre-classified as: ${intent}. Use this as a hint when deciding whether to call a tool.`;
    const fullSystemPrompt = systemPrompt + intentHint;

    const rawResponse = await geminiAPI.generateWithTools(
      [...conversationHistory, userGeminiMsg],
      fullSystemPrompt,
      sessionId,
    );

    conversationHistory = [
      ...conversationHistory,
      { role: "user", parts: [{ text: commandText }] },
      { role: "model", parts: [{ text: rawResponse }] },
    ];
    if (conversationHistory.length > 20) {
      conversationHistory = conversationHistory.slice(-20);
    }

    const { clean: afterNav, route } = parseNavigate(rawResponse);
    const clean = stripMarkdown(afterNav);

    if (route) {
      setTimeout(() => {
        win?.history?.pushState({}, "", route);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, 300);
    }

    const jarvisMsg: JarvisMessage = {
      id: crypto.randomUUID(),
      role: "jarvis",
      content: clean,
      timestamp: Date.now(),
      type: "text",
    };

    patch({ messages: [..._state.messages, jarvisMsg] });
    transitionAudioState("speaking");

    saveMessage(sessionId, "assistant", clean, "conversation").then(() => {
      updateSessionMessageCount(sessionId).catch(() => null);
      window.dispatchEvent(new CustomEvent("jarvis:history-refresh"));
    }).catch(() => null);

    ttsQueue.enqueue(cleanTextForSpeech(clean), () => {
      if (_state.enabled && _conversationRuntime.mode === "idle") {
        setTimeout(() => void startWakeWordDetection(), 400);
      }
    });
  } catch (err) {
    console.error("[JARVIS] handleCommand error:", err);
    toast.error("JARVIS encountered an error", { duration: 3000 });
    const errMsg: JarvisMessage = {
      id: crypto.randomUUID(),
      role: "jarvis",
      content: "I encountered an error processing that request, sir.",
      timestamp: Date.now(),
      type: "error",
    };
    patch({
      messages: [..._state.messages, errMsg],
      isAwake: false,
      transcript: "",
    });
    transitionAudioState("idle");
    if (_state.enabled) void startWakeWordDetection();
  }
}

// ─── Context initializer (called from UI on mount) ────────────────────────────

/**
 * Loads memories, session summaries, and builds the system prompt.
 * Does NOT create a session — session creation is deferred until first message.
 * Also cleans up any legacy empty sessions on first call.
 */
export async function initJarvisSession(): Promise<void> {
  try {
    // Clean up legacy empty sessions from before the lazy-session fix
    void supabase
      .from("jarvis_sessions")
      .delete()
      .eq("message_count", 0)
      .then(() => null, () => null);

    const [memories, summaries, timelineMonths] = await Promise.all([
      getRecentMemories(20),
      getRecentSessionSummaries(3),
      fetchTimelineContext(),
    ]);
    const systemPrompt = buildJarvisSystemPrompt(memories, summaries, timelineMonths);
    patch({ recentMemories: memories, sessionSummaries: summaries, systemPrompt });
  } catch (err) {
    console.warn("[JARVIS] initJarvisSession failed:", err);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

// ─── Conversational runtime exports ───────────────────────────────────────────

export function getConversationMode(): ConversationMode {
  return _conversationRuntime.mode;
}

export function getConversationTurnCount(): number {
  return _conversationRuntime.turnCount;
}

export function forceEndConversation(): void {
  endConversation();
}

export const jarvis = {
  enable() {
    try {
      localStorage.setItem("jarvis:enabled", "true");
    } catch {
      /* ignore */
    }
    patch({ enabled: true });
    transitionAudioState("idle");
    void startWakeWordDetection();
  },

  disable() {
    try {
      localStorage.setItem("jarvis:enabled", "false");
    } catch {
      /* ignore */
    }
    void stopWakeWordDetection();
    stopRecognition();
    ttsQueue.interrupt();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    patch({ enabled: false, isAwake: false, transcript: "" });
    transitionAudioState("idle");
  },

  activate() {
    stopRecognition();
    accumulatedFinalText = "";
    latestInterimText = "";
    patch({ isAwake: true, transcript: "" });
    transitionAudioState("listening");
    startRecognition();
    commandTimeout = setTimeout(() => {
      if (_state.voiceState === "listening") {
        clearSilenceTimer();
        const fullText = [accumulatedFinalText, latestInterimText].filter(Boolean).join(" ").trim();
        stopRecognition();
        if (fullText.length > 1) {
          handleCommand(stripWakeWord(fullText));
        } else {
          patch({ isAwake: false, transcript: "" });
          transitionAudioState("idle");
          if (_state.enabled) void startWakeWordDetection();
        }
      }
    }, MAX_LISTEN_MS);
  },

  async sendText(text: string) {
    stopRecognition();
    await handleCommand(text);
  },

  dismiss() {
    ttsQueue.interrupt();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    stopRecognition();
    patch({ isAwake: false, transcript: "" });
    transitionAudioState("idle");
    if (_state.enabled) void startWakeWordDetection();
  },

  clearMessages() {
    conversationHistory = [];
    patch({ messages: [] });
  },

  autoStartIfEnabled() {
    if (!SpeechRecognitionCtor) return;

    const doStart = () => {
      if (!_state.enabled) {
        try {
          localStorage.setItem("jarvis:enabled", "true");
        } catch {
          /* ignore */
        }
        patch({ enabled: true });
        transitionAudioState("idle");
      }
      if (!_wakeWordActive) void startWakeWordDetection();
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
          if (_state.enabled) void startWakeWordDetection();
        });
    } else if (_state.enabled) {
      void startWakeWordDetection();
    }
  },
} as const;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useJarvis() {
  return useSyncExternalStore(subscribeJarvis, getJarvisSnapshot, getJarvisSnapshot);
}

export { stopWakeWordDetection };
