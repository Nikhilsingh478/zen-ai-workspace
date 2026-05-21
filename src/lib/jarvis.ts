/**
 * JARVIS — Just A Rather Very Intelligent System
 * Global state store + voice engine + Gemini integration
 * Phase 1: Persistent sessions, function calling, TTSQueue, audio state machine
 */

import { useSyncExternalStore } from "react";
import { geminiAPI } from "@/lib/gemini";
import type { GeminiMessage } from "@/lib/gemini";
import { getHorizonTasks, ensureBooted } from "@/lib/horizon";
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
  type?: "text" | "task_created" | "memory_saved" | "error" | "interrupted";
  tasks?: ParsedTask[];
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

export type IntentType =
  | "task_creation"
  | "memory_capture"
  | "task_query"
  | "memory_query"
  | "task_management"
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

function setAudioState(next: JarvisAudioState) {
  if (canTransitionTo(_state.voiceState, next)) {
    patch({ voiceState: next });
  } else {
    patch({ voiceState: next });
  }
}

// ─── TTSQueue ─────────────────────────────────────────────────────────────────

class TTSQueue {
  private queue: string[] = [];
  private isPlaying = false;
  private onDoneCallback: (() => void) | null = null;

  enqueue(text: string, onDone?: () => void): void {
    this.onDoneCallback = onDone ?? null;
    const sentences = this.splitIntoSentences(text);
    this.queue.push(...sentences);
    if (!this.isPlaying) this.playNext();
  }

  private playNext(): void {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      patch({ voiceState: "idle", isAwake: false, transcript: "" });
      this.onDoneCallback?.();
      this.onDoneCallback = null;
      return;
    }

    this.isPlaying = true;
    const sentence = this.queue.shift()!;

    if (!("speechSynthesis" in window)) {
      this.playNext();
      return;
    }

    const utt = new SpeechSynthesisUtterance(sentence);
    utt.rate = 0.95;
    utt.pitch = 0.9;
    utt.volume = 1;
    utt.lang = "en-US";

    const voices = window.speechSynthesis.getVoices();
    const pref =
      voices.find((v) => v.lang.startsWith("en") && v.name.includes("Natural")) ||
      voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Google") || v.name.includes("Daniel") || v.name.includes("Alex")),
      );
    if (pref) utt.voice = pref;

    utt.onend = () => this.playNext();
    utt.onerror = () => this.playNext();
    window.speechSynthesis.speak(utt);
  }

  interrupt(): void {
    this.queue = [];
    this.isPlaying = false;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    patch({ voiceState: "interrupted" });
    setTimeout(() => {
      patch({ voiceState: "listening" });
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

  return "conversation";
}

// ─── Session Management ───────────────────────────────────────────────────────

export async function startSession(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("jarvis_sessions")
      .insert({ started_at: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    const sessionId = (data as { id: string }).id;
    patch({ currentSessionId: sessionId });
    return sessionId;
  } catch (err) {
    console.warn("[JARVIS] Session creation failed — running without persistence:", err);
    return "";
  }
}

export async function endSession(sessionId: string): Promise<void> {
  if (!sessionId) return;
  try {
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
    console.warn("[JARVIS] endSession error:", err);
  }
}

export async function saveMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  messageType: "conversation" | "task_created" | "memory_saved" | "error" = "conversation",
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

export async function getSessions(page = 0, perPage = 10): Promise<JarvisSession[]> {
  try {
    const { data, error } = await supabase
      .from("jarvis_sessions")
      .select("*")
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

// ─── System Prompt Builder ────────────────────────────────────────────────────

export function buildJarvisSystemPrompt(
  memories: Memory[],
  summaries: string[],
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
${taskSection}`;
}

// ─── SpeechRecognition engine ─────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let recRef: any = null;
let intentionalStop = false;
let currentMode: "passive" | "command" = "passive";
let restartTimer: ReturnType<typeof setTimeout> | undefined;
let commandTimeout: ReturnType<typeof setTimeout> | undefined;
let silenceTimer: ReturnType<typeof setTimeout> | undefined;
let accumulatedFinalText = "";
let latestInterimText = "";

const SILENCE_THRESHOLD_MS = 1200;
const MAX_LISTEN_MS = 20000;
const INTERRUPT_WORDS = ["stop", "wait", "hold on", "shut up", "pause"];

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
  if (mode === "passive" && isMobileUA()) {
    patch({ voiceState: "idle", isAwake: false });
    return;
  }

  clearTimeout(restartTimer);
  currentMode = mode;
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

      if (currentMode === "passive") {
        const woke = WAKE_WORDS.some((w) => lower.includes(w));
        if (woke) {
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
  };

  rec.onend = () => {
    if (recRef !== rec) return;
    recRef = null;
    if (intentionalStop) return;
    if (currentMode === "command") {
      clearSilenceTimer();
      const fullText = [accumulatedFinalText, latestInterimText].filter(Boolean).join(" ").trim();
      if (fullText.length > 1) {
        handleCommand(stripWakeWord(fullText));
        return;
      }
    }
    if (_state.enabled && !isMobileUA()) {
      restartTimer = setTimeout(() => startRecognition("passive"), 500);
    }
  };

  try {
    rec.start();
  } catch {
    recRef = null;
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

// ─── Conversation history (module-level) ──────────────────────────────────────

let conversationHistory: GeminiMessage[] = [];

// ─── Main command handler ─────────────────────────────────────────────────────

async function handleCommand(commandText: string) {
  if (!commandText.trim()) return;

  patch({ voiceState: "processing", isAwake: true });

  const userMsg: JarvisMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: commandText,
    timestamp: Date.now(),
    type: "text",
  };
  patch({ messages: [..._state.messages, userMsg], transcript: commandText });

  const sessionId = _state.currentSessionId ?? "";
  saveMessage(sessionId, "user", commandText, "conversation").catch(() => null);

  try {
    await ensureBooted();

    const intent = classifyIntent(commandText);
    const systemPrompt =
      _state.systemPrompt ||
      buildJarvisSystemPrompt(_state.recentMemories, _state.sessionSummaries);

    const intentHint = `\nThe user's message has been pre-classified as: ${intent}. Use this as a hint when deciding whether to call a tool.`;
    const fullSystemPrompt = systemPrompt + intentHint;

    const userGeminiMsg: GeminiMessage = {
      role: "user",
      parts: [{ text: commandText }],
    };

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

    patch({ messages: [..._state.messages, userMsg, jarvisMsg], voiceState: "speaking" });

    saveMessage(sessionId, "assistant", clean, "conversation").catch(() => null);

    ttsQueue.enqueue(clean, () => {
      patch({ voiceState: "idle", isAwake: false, transcript: "" });
      if (_state.enabled) {
        setTimeout(() => startRecognition("passive"), 400);
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
      messages: [..._state.messages, userMsg, errMsg],
      voiceState: "idle",
      isAwake: false,
      transcript: "",
    });
    if (_state.enabled) startRecognition("passive");
  }
}

// ─── Session initializer (called from UI on mount) ────────────────────────────

export async function initJarvisSession(): Promise<string> {
  try {
    const [sessionId, memories, summaries] = await Promise.all([
      startSession(),
      getRecentMemories(20),
      getRecentSessionSummaries(3),
    ]);
    const systemPrompt = buildJarvisSystemPrompt(memories, summaries);
    patch({ currentSessionId: sessionId, recentMemories: memories, sessionSummaries: summaries, systemPrompt });
    return sessionId;
  } catch (err) {
    console.warn("[JARVIS] initJarvisSession failed:", err);
    return "";
  }
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
    ttsQueue.interrupt();
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
    ttsQueue.interrupt();
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
        .catch(() => { if (_state.enabled) startRecognition("passive"); });
    } else if (_state.enabled) {
      startRecognition("passive");
    }
  },
} as const;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useJarvis() {
  return useSyncExternalStore(subscribeJarvis, getJarvisSnapshot, getJarvisSnapshot);
}
