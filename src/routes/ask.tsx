import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Mic, Square, Sparkles, Wand2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { geminiAPI } from "@/lib/gemini";
import type { GeminiMessage, UserContext } from "@/lib/gemini";
import { useWebsites, usePrompts, useDesktopStorage } from "@/lib/store";
import { useLinkBoard } from "@/lib/link-board";
import { useImportantMessages } from "@/lib/important-messages";
import { useVoiceInput, isSpeechSupported } from "@/hooks/use-voice-input";
import { useWakeWord, isWakeWordSupported } from "@/hooks/use-wake-word";
import { cn } from "@/lib/utils";

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/ask")({
  head: () => ({
    meta: [
      { title: "Ask — AI Metrics" },
      { name: "description", content: "A calm space to think out loud." },
    ],
  }),
  component: AskPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = { id: string; role: "user" | "assistant"; content: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const STARTERS = [
  "Plan my next 90 minutes",
  "Edit this paragraph for me",
  "Brainstorm names for…",
  "Explain a concept simply",
];

const EASE = [0.22, 1, 0.36, 1] as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

function AskPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [wakeActivated, setWakeActivated] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Input value ref to avoid stale closures in callbacks
  const inputValueRef = useRef("");
  useEffect(() => { inputValueRef.current = input; }, [input]);

  // Stable send ref for use inside effects
  const sendRef = useRef<(text: string) => void>(() => {});

  // Data stores — everything the workspace knows about
  const { websites } = useWebsites();
  const { prompts } = usePrompts();
  const { desktop } = useDesktopStorage();
  const { links } = useLinkBoard();
  const { messages: importantMessages } = useImportantMessages();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`;
  }, [input]);

  const send = useCallback(async (text: string) => {
    const value = text.trim();
    if (!value || thinking) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: value };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    setThinking(true);
    try {
      // Build full context from all workspace data
      const context: UserContext = {
        websites,
        prompts,
        links,
        messages: importantMessages,
        folders: desktop.folders.map((f) => ({
          name: f.name,
          items: f.children,
        })),
      };

      // Convert display messages → Gemini history format
      // (The first user message carries the system context; subsequent turns are raw)
      const geminiHistory: GeminiMessage[] = messages.map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      }));

      const reply = await geminiAPI.generateContent(value, geminiHistory, context);

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setThinking(false);
    }
  }, [thinking, websites, prompts, links, importantMessages, desktop.folders, messages]);

  // Keep sendRef stable for use in effects
  useEffect(() => { sendRef.current = send; }, [send]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  // ─── Voice input ───────────────────────────────────────────────────────────

  const wakeTriggeredRef = useRef(false);

  const handleTranscript = useCallback((text: string) => {
    const newInput = inputValueRef.current.trim()
      ? `${inputValueRef.current} ${text}`
      : text;
    setInput(newInput);
    textareaRef.current?.focus();

    // If triggered by wake word → auto-send
    if (wakeTriggeredRef.current) {
      wakeTriggeredRef.current = false;
      setTimeout(() => {
        if (newInput.trim()) sendRef.current(newInput);
      }, 80);
    }
  }, []);

  const { voiceState, toggle: toggleVoice } = useVoiceInput({ onTranscript: handleTranscript });
  const isListening = voiceState === "listening";

  // ─── Wake word "Hey Jarvis" ────────────────────────────────────────────────

  const handleWakeDetected = useCallback(() => {
    wakeTriggeredRef.current = true;
    // Visual feedback
    setWakeActivated(true);
    setTimeout(() => setWakeActivated(false), 1200);
    toast("Jarvis activated — speak your command", {
      duration: 2000,
      icon: "🎙️",
    });
    // Start recording after brief delay for UX
    setTimeout(() => toggleVoice(), 250);
  }, [toggleVoice]);

  const wakeWord = useWakeWord({ onDetected: handleWakeDetected });

  // After command recording ends, resume wake word listener
  const prevVoiceStateRef = useRef(voiceState);
  useEffect(() => {
    const prev = prevVoiceStateRef.current;
    prevVoiceStateRef.current = voiceState;
    if ((prev === "listening" || prev === "processing") && voiceState === "idle" && wakeWord.enabled) {
      // Resume after auto-send completes
      setTimeout(() => wakeWord.resume(), 1800);
    }
  }, [voiceState, wakeWord.enabled, wakeWord.resume]);

  const empty = messages.length === 0;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Wake word status banner */}
      <AnimatePresence>
        {wakeWord.enabled && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="shrink-0 flex items-center justify-center gap-2 py-1.5 text-[11px] text-copy-muted bg-transparent"
          >
            <motion.span
              className="h-1.5 w-1.5 rounded-full bg-violet-400"
              animate={{ opacity: wakeWord.isWatching ? [0.4, 1, 0.4] : 1 }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            />
            {wakeWord.isWatching ? 'Listening for "Hey Jarvis"' : "Wake word ready"}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable messages area */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-8 pt-8 pb-4">
          {empty ? (
            <EmptyState onStarter={send} wakeEnabled={wakeWord.enabled} />
          ) : (
            <div className="space-y-5">
              <AnimatePresence initial={false}>
                {messages.map((m) => <Bubble key={m.id} message={m} />)}
                {thinking && <ThinkingIndicator key="thinking" />}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Input bar */}
      <div className="shrink-0 bg-gradient-to-t from-background via-background/95 to-transparent pt-3 pb-3 md:pb-5">
        <form onSubmit={onSubmit} className="max-w-3xl mx-auto px-4 md:px-8">
          <motion.div
            animate={
              wakeActivated
                ? { boxShadow: "0 0 0 2px rgba(167,139,250,0.5), 0 8px 32px -16px rgba(0,0,0,0.4)" }
                : { boxShadow: "0 8px 32px -16px rgba(0,0,0,0.4)" }
            }
            transition={{ duration: 0.3 }}
            className={cn(
              "flex items-end gap-2 rounded-3xl border px-4 py-3 transition-colors duration-300",
              "bg-[var(--surface-1)]",
              wakeActivated
                ? "border-violet-500/40 bg-violet-500/[0.03]"
                : isListening
                  ? "border-red-500/30 bg-red-500/[0.03]"
                  : "border-border/30 focus-within:border-white/20 focus-within:bg-[var(--surface-2)]",
            )}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder={
                wakeActivated ? "Jarvis activated…"
                : isListening ? "Listening…"
                : "Ask anything…"
              }
              className="flex-1 bg-transparent resize-none outline-none text-[15px] leading-relaxed py-1.5 px-1 max-h-32 text-foreground placeholder:text-copy-muted overflow-y-auto"
            />

            {/* Waveform — visible while listening */}
            <AnimatePresence>
              {isListening && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-end gap-0.5 mb-2.5 shrink-0"
                >
                  {[0, 0.12, 0.24, 0.36].map((delay, i) => (
                    <motion.span
                      key={i}
                      className="w-[3px] rounded-full bg-red-400"
                      animate={{ height: ["4px", "14px", "4px"] }}
                      transition={{ duration: 0.7, repeat: Infinity, delay, ease: "easeInOut" }}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Wake word toggle — only shown when speech is supported */}
            {isWakeWordSupported && (
              <motion.button
                type="button"
                onClick={wakeWord.enabled ? wakeWord.disable : wakeWord.enable}
                whileTap={{ scale: 0.92 }}
                title={wakeWord.enabled ? 'Disable "Hey Jarvis"' : 'Enable "Hey Jarvis" wake word'}
                className={cn(
                  "relative h-9 w-9 shrink-0 grid place-items-center rounded-xl transition-all duration-200 mb-0.5",
                  wakeWord.enabled
                    ? "text-violet-400 bg-violet-500/10"
                    : "text-copy-muted hover:text-foreground hover:bg-white/[0.06]",
                )}
                aria-label={wakeWord.enabled ? "Disable wake word" : "Enable wake word"}
              >
                {wakeWord.enabled && wakeWord.isWatching && (
                  <span className="absolute inset-0 rounded-xl bg-violet-500/15 animate-ping opacity-60" />
                )}
                <Wand2 className="h-4 w-4 relative z-10" />
              </motion.button>
            )}

            {/* Mic button */}
            {isSpeechSupported && (
              <motion.button
                type="button"
                onClick={toggleVoice}
                whileTap={{ scale: 0.93 }}
                className={cn(
                  "relative h-9 w-9 shrink-0 grid place-items-center rounded-xl transition-all duration-200 mb-0.5",
                  isListening
                    ? "text-red-400 bg-red-500/10"
                    : "text-copy-muted hover:text-foreground hover:bg-white/[0.06]",
                )}
                aria-label={isListening ? "Stop recording" : "Start voice input"}
              >
                {isListening && (
                  <span className="absolute inset-0 rounded-xl bg-red-500/20 animate-ping opacity-75" />
                )}
                {isListening ? (
                  <Square className="h-3.5 w-3.5 fill-current relative z-10" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </motion.button>
            )}

            {/* Send button */}
            <motion.button
              type="submit"
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
              disabled={!input.trim() || thinking}
              className="h-9 w-9 shrink-0 grid place-items-center rounded-xl bg-foreground text-background disabled:bg-[var(--surface-3)] disabled:text-copy-muted disabled:cursor-not-allowed transition-all duration-200 mb-0.5"
              aria-label="Send"
            >
              <ArrowUp className="h-4 w-4" />
            </motion.button>
          </motion.div>

          <p className="text-[11px] text-copy-muted text-center mt-2 opacity-60 hidden md:block">
            Enter to send · Shift+Enter for newline
            {isSpeechSupported ? " · Click mic to speak" : ""}
            {isWakeWordSupported ? ' · Click wand for "Hey Jarvis"' : ""}
          </p>
        </form>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  onStarter,
  wakeEnabled,
}: {
  onStarter: (s: string) => void;
  wakeEnabled: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="min-h-[55vh] flex flex-col items-center justify-center text-center"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
        className="h-14 w-14 rounded-2xl bg-[var(--surface-2)] border border-border grid place-items-center mb-6"
      >
        <Sparkles className="h-6 w-6 text-copy-secondary" strokeWidth={1.75} />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.2 }}
        className="text-2xl md:text-[32px] font-semibold tracking-tight text-foreground"
      >
        {wakeEnabled ? "Listening for Jarvis…" : "What's on your mind?"}
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.3 }}
        className="text-sm text-copy-secondary mt-2"
      >
        {wakeEnabled
          ? 'Say "Hey Jarvis" to activate voice input'
          : "A calm space to think, draft, and explore."}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.4 }}
        className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md"
      >
        {STARTERS.map((s, i) => (
          <motion.button
            key={s}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE, delay: 0.5 + i * 0.06 }}
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onStarter(s)}
            className="text-left text-sm text-copy-secondary hover:text-foreground rounded-2xl border border-border/50 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] px-4 py-3.5 transition-all duration-200"
          >
            {s}
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function Bubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: EASE }}
      className={cn("flex", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          isUser
            ? "max-w-[80%] rounded-2xl rounded-br-sm bg-foreground text-background px-4 py-3 text-[15px] leading-relaxed"
            : "max-w-[88%] rounded-2xl rounded-bl-sm bg-[var(--surface-2)] border border-border/50 px-4 py-3 text-[15px] leading-relaxed text-foreground",
        )}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <AssistantMarkdown content={message.content} />
        )}
      </div>
    </motion.div>
  );
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-lg font-semibold text-foreground mt-4 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-semibold text-foreground mt-3 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold text-foreground mt-2 mb-1">{children}</h3>,
          p: ({ children }) => <p className="text-[15px] leading-relaxed mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-[15px] leading-relaxed">{children}</li>,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          code: ({ inline, children }: any) =>
            inline ? (
              <code className="bg-[var(--surface-3)] px-1.5 py-0.5 rounded text-sm text-foreground font-mono">
                {children}
              </code>
            ) : (
              <pre className="bg-[var(--surface-3)] p-3 rounded-lg overflow-x-auto mb-3">
                <code className="text-sm text-foreground font-mono">{children}</code>
              </pre>
            ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border/30 pl-3 py-1 my-3 text-copy-secondary italic">
              {children}
            </blockquote>
          ),
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-copy-secondary hover:text-foreground underline transition-colors"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ─── Thinking indicator ───────────────────────────────────────────────────────

function ThinkingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4, scale: 0.95 }}
      transition={{ duration: 0.25, ease: EASE }}
      className="flex"
    >
      <div className="rounded-2xl bg-[var(--surface-2)] border border-border/50 px-4 py-3 flex items-center gap-1.5">
        <Dot delay={0} />
        <Dot delay={0.15} />
        <Dot delay={0.3} />
      </div>
    </motion.div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <motion.span
      className="h-1.5 w-1.5 rounded-full bg-foreground/40"
      animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.8, 0.4], y: [0, -3, 0] }}
      transition={{ duration: 1.2, repeat: Infinity, delay, ease: [0.4, 0, 0.6, 1] }}
    />
  );
}
