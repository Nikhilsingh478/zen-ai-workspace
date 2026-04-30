import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { geminiAPI } from "@/lib/gemini";
import { useWebsites, usePrompts } from "@/lib/store";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const Route = createFileRoute("/ask")({
  head: () => ({
    meta: [
      { title: "Ask — AI Metrics" },
      { name: "description", content: "A calm space to think out loud." },
    ],
  }),
  component: AskPage,
});

type Message = { id: string; role: "user" | "assistant"; content: string };

const STARTERS = [
  "Plan my next 90 minutes",
  "Edit this paragraph for me",
  "Brainstorm names for…",
  "Explain a concept simply",
];

async function getReply(input: string, userWebsites: any[], userPrompts: any[]) {
  const response = await geminiAPI.generateContent(input, [], {
    websites: userWebsites,
    prompts: userPrompts,
  });
  return response;
}

function AskPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { websites } = useWebsites();
  const { prompts } = usePrompts();

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, thinking]);

  // Auto-resize textarea as user types
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 128) + "px";
  }, [input]);

  const send = async (text: string) => {
    const value = text.trim();
    if (!value || thinking) return;

    const user: Message = { id: crypto.randomUUID(), role: "user", content: value };
    setMessages((m) => [...m, user]);
    setInput("");

    // Reset textarea height after clearing
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    setThinking(true);
    try {
      const response = await getReply(value, websites, prompts);
      const assistant: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response,
      };
      setMessages((m) => [...m, assistant]);
    } catch (err) {
      console.error("Error getting AI response:", err);
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const empty = messages.length === 0;

  return (
    /*
     * FIX: h-full instead of h-[100dvh]
     *
     * h-[100dvh] was fighting with the parent layout — the component was
     * trying to claim the full viewport height again INSIDE a container
     * that already had height constraints, causing double-overflow.
     *
     * h-full fills exactly what AppShell's <main> gives it:
     *   100dvh - pb-20 (mobile) = viewport minus nav clearance
     *   100dvh - 0 (desktop)   = full viewport
     *
     * The flex column then splits this exact space between the scrollable
     * message area (flex-1 min-h-0) and the fixed input bar (shrink-0).
     * Nothing escapes the container. No position:fixed needed.
     */
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Scrollable messages area ── */}
      {/*
        min-h-0 is required: without it, this flex child won't shrink below
        its natural content height and the whole component overflows again.
      */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-8 pt-10 pb-4">
          {empty ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="min-h-[55vh] flex flex-col items-center justify-center text-center"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
                className="h-14 w-14 rounded-2xl bg-[var(--surface-2)] border border-border grid place-items-center mb-6"
              >
                <Sparkles className="h-6 w-6 text-copy-secondary" strokeWidth={1.75} />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                className="text-2xl md:text-[32px] font-semibold tracking-tight text-foreground"
              >
                What's on your mind?
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                className="text-sm text-copy-secondary mt-2"
              >
                A calm space to think, draft, and explore.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
                className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md"
              >
                {STARTERS.map((s, i) => (
                  <motion.button
                    key={s}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.3,
                      ease: [0.22, 1, 0.36, 1],
                      delay: 0.5 + i * 0.05,
                    }}
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => send(s)}
                    className="text-left text-sm text-copy-secondary hover:text-foreground rounded-2xl border border-border/50 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] px-4 py-3.5 transition-all duration-200"
                  >
                    {s}
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>
          ) : (
            <div className="space-y-5">
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <Bubble key={m.id} message={m} />
                ))}

                {thinking && (
                  <motion.div
                    key="thinking"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="flex"
                  >
                    <div className="rounded-2xl bg-[var(--surface-2)] border border-border/50 px-4 py-3 flex items-center gap-1.5">
                      <Dot delay={0} />
                      <Dot delay={0.15} />
                      <Dot delay={0.3} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* ── Input bar — always visible at the bottom ── */}
      {/*
        shrink-0 means this panel never compresses no matter how many messages
        are in the scroll area. It always occupies its natural height.
        No position:fixed — just a plain flex child that sits at the bottom.
      */}
      <div className="shrink-0 bg-gradient-to-t from-background via-background/95 to-transparent pt-3 pb-3 md:pb-5">
        <form onSubmit={onSubmit} className="max-w-3xl mx-auto px-4 md:px-8">
          <div className="flex items-end gap-3 rounded-3xl border border-border/30 bg-[var(--surface-1)] px-4 py-3 focus-within:border-white/20 focus-within:bg-[var(--surface-2)] transition-all duration-300 shadow-[0_8px_32px_-16px_rgba(0,0,0,0.4)]">
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
              placeholder="Ask anything..."
              className="flex-1 bg-transparent resize-none outline-none text-[15px] leading-relaxed py-1.5 px-1 max-h-32 text-foreground placeholder:text-copy-muted overflow-y-auto"
            />
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
          </div>

          <p className="text-[11px] text-copy-muted text-center mt-2 opacity-60 hidden md:block">
            Enter to send · Shift+Enter for newline
          </p>
        </form>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={
          isUser
            ? "max-w-[80%] rounded-2xl rounded-br-sm bg-foreground text-background px-4 py-3 text-[15px] leading-relaxed"
            : "max-w-[88%] rounded-2xl rounded-bl-sm bg-[var(--surface-2)] border border-border/50 px-4 py-3 text-[15px] leading-relaxed text-foreground"
        }
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-lg font-semibold text-foreground mt-4 mb-2">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-base font-semibold text-foreground mt-3 mb-2">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-semibold text-foreground mt-2 mb-1">{children}</h3>
                ),
                p: ({ children }) => (
                  <p className="text-[15px] leading-relaxed mb-3 last:mb-0">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>
                ),
                li: ({ children }) => <li className="text-[15px] leading-relaxed">{children}</li>,
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
                strong: ({ children }) => (
                  <strong className="font-semibold text-foreground">{children}</strong>
                ),
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
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <motion.span
      className="h-1.5 w-1.5 rounded-full bg-foreground/40"
      animate={{
        scale: [1, 1.4, 1],
        opacity: [0.4, 0.8, 0.4],
        y: [0, -3, 0],
      }}
      transition={{
        duration: 1.2,
        repeat: Infinity,
        delay,
        ease: [0.4, 0, 0.6, 1],
      }}
    />
  );
}
