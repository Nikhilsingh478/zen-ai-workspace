import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/ask")({
  head: () => ({
    meta: [
      { title: "Ask — AI Matrix" },
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

function fakeReply(input: string) {
  const trimmed = input.trim();
  return `Here's a thought on "${trimmed.slice(0, 60)}${trimmed.length > 60 ? "…" : ""}".\n\nThis workspace is offline — connect Lovable Cloud and an AI provider to wire this chat to a real model. Until then, I'll mirror your message back so the interface stays alive.`;
}

function AskPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const send = (text: string) => {
    const value = text.trim();
    if (!value) return;
    const user: Message = { id: crypto.randomUUID(), role: "user", content: value };
    setMessages((m) => [...m, user]);
    setInput("");
    setThinking(true);
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", content: fakeReply(value) },
      ]);
      setThinking(false);
    }, 700);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const empty = messages.length === 0;

  return (
    <div className="h-[100dvh] md:h-screen flex flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-5 md:px-8 pt-12 pb-32">
          {empty ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="min-h-[60vh] flex flex-col items-center justify-center text-center"
            >
              <div className="h-12 w-12 rounded-2xl bg-[var(--surface-2)] border border-border/60 grid place-items-center mb-5">
                <Sparkles className="h-5 w-5 text-secondary" strokeWidth={1.75} />
              </div>
              <h1 className="text-2xl md:text-[28px] font-semibold tracking-tight">What's on your mind?</h1>
              <p className="text-sm text-secondary mt-2">A calm space to think, draft, and explore.</p>
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left text-sm text-secondary hover:text-foreground rounded-xl border border-border/60 bg-[var(--surface-1)] hover:bg-[var(--surface-2)] px-4 py-3 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
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
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex"
                  >
                    <div className="rounded-2xl bg-[var(--surface-2)] border border-border/60 px-4 py-3 flex items-center gap-1.5">
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

      <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-6 pb-6 md:pb-8">
        <form onSubmit={onSubmit} className="max-w-3xl mx-auto px-5 md:px-8">
          <div className="flex items-end gap-2 rounded-2xl border border-border/70 bg-[var(--surface-2)] px-3 py-2.5 focus-within:border-white/20 transition shadow-[0_10px_40px_-20px_rgba(0,0,0,0.6)]">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Ask anything…"
              className="flex-1 bg-transparent resize-none outline-none text-[14.5px] leading-relaxed py-1.5 px-2 max-h-40 text-foreground placeholder:text-muted-foreground"
            />
            <motion.button
              type="submit"
              whileTap={{ scale: 0.94 }}
              disabled={!input.trim()}
              className="h-9 w-9 shrink-0 grid place-items-center rounded-xl bg-foreground text-background disabled:opacity-30 disabled:cursor-not-allowed transition"
              aria-label="Send"
            >
              <ArrowUp className="h-4 w-4" />
            </motion.button>
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            Press Enter to send · Shift+Enter for newline
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
            ? "max-w-[85%] rounded-2xl rounded-br-md bg-[var(--surface-3)] border border-border/60 px-4 py-3 text-[14.5px] leading-relaxed text-foreground whitespace-pre-wrap"
            : "max-w-[90%] rounded-2xl rounded-bl-md bg-[var(--surface-1)] border border-border/60 px-4 py-3 text-[14.5px] leading-relaxed text-secondary whitespace-pre-wrap"
        }
      >
        {message.content}
      </div>
    </motion.div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <motion.span
      className="h-1.5 w-1.5 rounded-full bg-secondary"
      animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
      transition={{ duration: 1, repeat: Infinity, delay, ease: "easeInOut" }}
    />
  );
}