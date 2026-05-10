import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Mic, Square, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { geminiAPI } from "@/lib/gemini";
import type { GeminiMessage, UserContext } from "@/lib/gemini";
import { useWebsites, usePrompts, useDesktopStorage } from "@/lib/store";
import { useLinkBoard } from "@/lib/link-board";
import { useImportantMessages } from "@/lib/important-messages";
import { useVoiceInput, isSpeechSupported } from "@/hooks/use-voice-input";
// import { useWakeWord, isWakeWordSupported } from "@/hooks/use-wake-word"; // JARVIS DISABLED
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

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// ─── Page ─────────────────────────────────────────────────────────────────────

function AskPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);

  // JARVIS DISABLED ───────────────────────────────────────────────────────────
  // const [wakeActivated, setWakeActivated] = useState(false);
  // const wakeTriggeredRef = useRef(false);
  // ─────────────────────────────────────────────────────────────────────────

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputValueRef = useRef("");
  const sendRef = useRef<(text: string) => void>(() => {});

  useEffect(() => { inputValueRef.current = input; }, [input]);

  const { websites } = useWebsites();
  const { prompts } = usePrompts();
  const { desktop } = useDesktopStorage();
  const { links } = useLinkBoard();
  const { messages: importantMessages } = useImportantMessages();

  // Auto-scroll to bottom on new messages / thinking state changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Small delay lets the new bubble paint first
    const id = setTimeout(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }, 60);
    return () => clearTimeout(id);
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
        { id: crypto.randomUUID(), role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setThinking(false);
    }
  }, [thinking, websites, prompts, links, importantMessages, desktop.folders, messages]);

  useEffect(() => { sendRef.current = send; }, [send]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  // ─── Voice input (mic only — Jarvis wake word disabled) ────────────────────

  const handleTranscript = useCallback((text: string) => {
    const newInput = inputValueRef.current.trim()
      ? `${inputValueRef.current} ${text}`
      : text;
    setInput(newInput);
    textareaRef.current?.focus();

    // JARVIS DISABLED — no auto-send on wake word
    // if (wakeTriggeredRef.current) {
    //   wakeTriggeredRef.current = false;
    //   setTimeout(() => { if (newInput.trim()) sendRef.current(newInput); }, 80);
    // }
  }, []);

  const { voiceState, toggle: toggleVoice } = useVoiceInput({ onTranscript: handleTranscript });
  const isListening = voiceState === "listening";

  // JARVIS DISABLED ───────────────────────────────────────────────────────────
  // const handleWakeDetected = useCallback(() => {
  //   wakeTriggeredRef.current = true;
  //   setWakeActivated(true);
  //   setTimeout(() => setWakeActivated(false), 1200);
  //   toast("Jarvis activated — speak your command", { duration: 2000, icon: "🎙️" });
  //   setTimeout(() => toggleVoice(), 250);
  // }, [toggleVoice]);
  //
  // const wakeWord = useWakeWord({ onDetected: handleWakeDetected });
  //
  // const prevVoiceStateRef = useRef(voiceState);
  // useEffect(() => {
  //   const prev = prevVoiceStateRef.current;
  //   prevVoiceStateRef.current = voiceState;
  //   if ((prev === "listening" || prev === "processing") && voiceState === "idle" && wakeWord.enabled) {
  //     setTimeout(() => wakeWord.resume(), 1800);
  //   }
  // }, [voiceState, wakeWord.enabled, wakeWord.resume]);
  // ─────────────────────────────────────────────────────────────────────────

  const empty = messages.length === 0;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* JARVIS DISABLED — wake word status banner removed */}
      {/* <AnimatePresence>
        {wakeWord.enabled && (
          <motion.div ...>
            Listening for "Hey Jarvis"
          </motion.div>
        )}
      </AnimatePresence> */}

      {/* ── Scrollable message area ─────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-8 pt-8 pb-4">
          {empty ? (
            <EmptyState onStarter={send} />
          ) : (
            <div className="space-y-1">
              <AnimatePresence initial={false} mode="popLayout">
                {messages.map((m, i) => (
                  <Bubble key={m.id} message={m} index={i} />
                ))}
                {thinking && <ThinkingBubble key="thinking" />}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* ── Input bar ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-gradient-to-t from-background via-background/95 to-transparent pt-4 pb-3 md:pb-6">
        <form onSubmit={onSubmit} className="max-w-3xl mx-auto px-4 md:px-8">
          <motion.div
            animate={{ boxShadow: input.trim() ? "0 12px 40px -16px rgba(0,0,0,0.5)" : "0 4px 20px -8px rgba(0,0,0,0.3)" }}
            transition={{ duration: 0.3 }}
            className={cn(
              "flex items-end gap-2 rounded-3xl border px-4 py-3 transition-colors duration-300 bg-[var(--surface-1)]",
              isListening
                ? "border-white/20 bg-white/[0.03]"
                : "border-white/[0.08] focus-within:border-white/[0.16] focus-within:bg-[var(--surface-2)]",
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
              placeholder={isListening ? "Listening…" : "Ask anything…"}
              className="flex-1 bg-transparent resize-none outline-none text-[15px] leading-relaxed py-1.5 px-1 max-h-32 text-foreground placeholder:text-copy-muted overflow-y-auto"
            />

            {/* Waveform — visible while listening */}
            <AnimatePresence>
              {isListening && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, width: 0 }}
                  animate={{ opacity: 1, scale: 1, width: "auto" }}
                  exit={{ opacity: 0, scale: 0.8, width: 0 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className="flex items-end gap-[3px] mb-2.5 shrink-0 overflow-hidden"
                >
                  {[0, 0.1, 0.2, 0.3, 0.15].map((delay, i) => (
                    <motion.span
                      key={i}
                      className="w-[2.5px] rounded-full bg-foreground/50"
                      animate={{ height: ["3px", `${10 + i * 3}px`, "3px"] }}
                      transition={{ duration: 0.65, repeat: Infinity, delay, ease: "easeInOut" }}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* JARVIS DISABLED — wand button removed */}
            {/* {isWakeWordSupported && (
              <motion.button type="button" onClick={wakeWord.enabled ? wakeWord.disable : wakeWord.enable} ...>
                <Wand2 className="h-4 w-4" />
              </motion.button>
            )} */}

            {/* Mic button */}
            {isSpeechSupported && (
              <motion.button
                type="button"
                onClick={toggleVoice}
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                className={cn(
                  "relative h-9 w-9 shrink-0 grid place-items-center rounded-xl transition-all duration-200 mb-0.5",
                  isListening
                    ? "text-foreground bg-white/[0.1] border border-white/[0.15]"
                    : "text-copy-muted hover:text-foreground hover:bg-white/[0.06]",
                )}
                aria-label={isListening ? "Stop recording" : "Start voice input"}
              >
                <AnimatePresence mode="wait">
                  {isListening ? (
                    <motion.span
                      key="stop"
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.7, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="relative z-10"
                    >
                      <Square className="h-3.5 w-3.5 fill-current" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="mic"
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.7, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Mic className="h-4 w-4" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            )}

            {/* Send button */}
            <motion.button
              type="submit"
              whileTap={{ scale: 0.9 }}
              whileHover={input.trim() && !thinking ? { scale: 1.05 } : {}}
              disabled={!input.trim() || thinking}
              className="h-9 w-9 shrink-0 grid place-items-center rounded-xl bg-foreground text-background disabled:bg-white/[0.06] disabled:text-copy-muted disabled:cursor-not-allowed transition-all duration-200 mb-0.5"
              aria-label="Send"
            >
              <motion.span
                animate={thinking ? { rotate: 180, opacity: 0.4 } : { rotate: 0, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <ArrowUp className="h-4 w-4" />
              </motion.span>
            </motion.button>
          </motion.div>

          <p className="text-[11px] text-copy-muted text-center mt-2 opacity-50 hidden md:block">
            Enter to send · Shift+Enter for newline
            {isSpeechSupported ? " · Click mic to speak" : ""}
          </p>
        </form>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onStarter }: { onStarter: (s: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
      className="min-h-[55vh] flex flex-col items-center justify-center text-center"
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.08 }}
        className="h-14 w-14 rounded-2xl bg-[var(--surface-2)] border border-white/[0.07] grid place-items-center mb-6"
      >
        <Sparkles className="h-6 w-6 text-white/40" strokeWidth={1.75} />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.16 }}
        className="text-2xl md:text-[32px] font-semibold tracking-tight text-foreground"
      >
        What&apos;s on your mind?
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.24 }}
        className="text-sm text-copy-secondary mt-2"
      >
        A calm space to think, draft, and explore.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.32 }}
        className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-md"
      >
        {STARTERS.map((s, i) => (
          <motion.button
            key={s}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE, delay: 0.38 + i * 0.07 }}
            whileHover={{ scale: 1.02, y: -1.5, transition: { duration: 0.15 } }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onStarter(s)}
            className="text-left text-sm text-copy-secondary hover:text-foreground rounded-2xl border border-white/[0.07] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] hover:border-white/[0.13] px-4 py-3.5 transition-colors duration-200"
          >
            {s}
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function Bubble({ message, index }: { message: Message; index: number }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      layout
      initial={
        isUser
          ? { opacity: 0, y: 12, x: 16, scale: 0.97 }
          : { opacity: 0, y: 10, x: -8, scale: 0.98 }
      }
      animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{
        duration: isUser ? 0.28 : 0.35,
        ease: EASE,
        delay: index === 0 ? 0 : 0,
      }}
      className={cn(
        "flex",
        isUser ? "justify-end" : "justify-start",
        isUser ? "mt-4" : "mt-3",
      )}
    >
      {/* Assistant avatar dot */}
      {!isUser && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: 0.05, ease: EASE }}
          className="h-6 w-6 rounded-full bg-white/[0.06] border border-white/[0.08] grid place-items-center shrink-0 mr-2.5 mt-1"
        >
          <Sparkles className="h-3 w-3 text-white/30" strokeWidth={1.75} />
        </motion.div>
      )}

      <motion.div
        layout
        className={cn(
          isUser
            ? "max-w-[78%] rounded-2xl rounded-br-[6px] bg-foreground text-background px-4 py-3 text-[15px] leading-relaxed shadow-[0_2px_16px_rgba(0,0,0,0.25)]"
            : "max-w-[86%] rounded-2xl rounded-bl-[6px] bg-[var(--surface-2)] border border-white/[0.07] px-4 py-3 text-[15px] leading-relaxed text-foreground",
        )}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <AssistantMarkdown content={message.content} />
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Assistant markdown ────────────────────────────────────────────────────────

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-lg font-semibold text-foreground mt-4 mb-2 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-semibold text-foreground mt-3 mb-2 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold text-foreground mt-2 mb-1 first:mt-0">{children}</h3>,
          p: ({ children }) => <p className="text-[15px] leading-relaxed mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-[15px] leading-relaxed">{children}</li>,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          code: ({ inline, children }: any) =>
            inline ? (
              <code className="bg-white/[0.07] border border-white/[0.07] px-1.5 py-0.5 rounded text-sm text-foreground font-mono">
                {children}
              </code>
            ) : (
              <pre className="bg-white/[0.04] border border-white/[0.06] p-3 rounded-xl overflow-x-auto mb-3">
                <code className="text-sm text-foreground font-mono">{children}</code>
              </pre>
            ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-[1.5px] border-white/20 pl-3 py-1 my-3 text-copy-secondary italic">
              {children}
            </blockquote>
          ),
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic text-copy-secondary">{children}</em>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-copy-secondary hover:text-foreground underline underline-offset-2 transition-colors"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="border-white/[0.08] my-4" />,
          table: ({ children }) => (
            <div className="overflow-x-auto mb-3">
              <table className="text-sm w-full border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="text-left px-3 py-2 border-b border-white/[0.1] text-white/60 font-medium text-xs uppercase tracking-wide">{children}</th>,
          td: ({ children }) => <td className="px-3 py-2 border-b border-white/[0.05] text-[13px]">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ─── Thinking bubble ─────────────────────────────────────────────────────────

function ThinkingBubble() {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, x: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.95, transition: { duration: 0.18 } }}
      transition={{ duration: 0.3, ease: EASE }}
      className="flex items-start mt-3"
    >
      {/* Avatar dot */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, delay: 0.05, ease: EASE }}
        className="h-6 w-6 rounded-full bg-white/[0.06] border border-white/[0.08] grid place-items-center shrink-0 mr-2.5 mt-1"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="h-3 w-3 text-white/40" strokeWidth={1.75} />
        </motion.div>
      </motion.div>

      {/* Thinking indicator */}
      <div className="rounded-2xl rounded-bl-[6px] bg-[var(--surface-2)] border border-white/[0.07] px-4 py-3.5 flex items-center gap-1">
        <ThinkingDot delay={0} />
        <ThinkingDot delay={0.18} />
        <ThinkingDot delay={0.36} />
      </div>
    </motion.div>
  );
}

function ThinkingDot({ delay }: { delay: number }) {
  return (
    <motion.span
      className="h-[5px] w-[5px] rounded-full bg-foreground/30"
      animate={{
        y: [0, -5, 0],
        opacity: [0.3, 0.8, 0.3],
        scale: [1, 1.2, 1],
      }}
      transition={{
        duration: 1.1,
        repeat: Infinity,
        delay,
        ease: [0.4, 0, 0.6, 1],
      }}
    />
  );
}
