import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic, MicOff, Send, Trash2, Zap, CheckSquare,
  Volume2, ChevronLeft, Radio, MessageSquare, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useJarvis, jarvis } from "@/lib/jarvis";
import { useHorizon } from "@/lib/horizon";
import { AICore } from "@/components/jarvis/ai-core";
import { isVoiceAssistantSupported } from "@/hooks/use-voice-assistant";

export const Route = createFileRoute("/jarvis")({ component: JarvisPage });

// ─── State colours ────────────────────────────────────────────────────────────

const STATE_DISPLAY: Record<string, { label: string; sub: string; color: string }> = {
  idle:       { label: "Standing by",   sub: 'Say "Hey Jarvis" or type below', color: "rgba(0,191,255,0.4)" },
  listening:  { label: "Listening…",    sub: "Speak your command, sir",        color: "#4DEBFF"              },
  processing: { label: "Processing…",   sub: "Analysing your request",          color: "#00BFFF"              },
  speaking:   { label: "Responding…",   sub: "J.A.R.V.I.S is speaking",       color: "#4DEBFF"              },
};

// ─── Chat message ─────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ReturnType<typeof useJarvis>["messages"][number] }) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className="max-w-[85%] rounded-2xl px-4 py-3"
        style={
          isUser
            ? {
                background: "rgba(0,191,255,0.1)",
                border: "1px solid rgba(0,191,255,0.25)",
                color: "rgba(200,235,255,0.92)",
              }
            : {
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(0,191,255,0.12)",
                color: "rgba(220,240,255,0.85)",
              }
        }
      >
        {!isUser && (
          <p className="text-[9px] tracking-[0.24em] mb-2 font-medium" style={{ color: "rgba(0,191,255,0.5)" }}>
            J.A.R.V.I.S
          </p>
        )}
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>

        {msg.tasks && msg.tasks.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {msg.tasks.map((t, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-xl px-3 py-2"
                style={{ background: "rgba(0,191,255,0.08)", border: "1px solid rgba(0,191,255,0.18)" }}
              >
                <CheckSquare size={11} style={{ color: "#4DEBFF", flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p className="text-[12px] font-medium" style={{ color: "#4DEBFF" }}>{t.title}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "rgba(0,191,255,0.5)" }}>
                    {t.taskDate} at {t.taskTime}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-[9px] mt-2 text-right" style={{ color: "rgba(0,191,255,0.25)" }}>
          {new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Chat drawer ──────────────────────────────────────────────────────────────

function ChatDrawer({
  messages,
  open,
  onClose,
}: {
  messages: ReturnType<typeof useJarvis>["messages"];
  open: boolean;
  onClose: () => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-30"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="absolute top-0 right-0 bottom-0 z-40 flex flex-col w-80 max-w-[90vw]"
            style={{
              background: "rgba(8,14,20,0.98)",
              borderLeft: "1px solid rgba(0,191,255,0.1)",
              backdropFilter: "blur(20px)",
            }}
          >
            {/* Drawer header */}
            <div
              className="flex items-center justify-between px-5 py-4 shrink-0"
              style={{ borderBottom: "1px solid rgba(0,191,255,0.08)" }}
            >
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] uppercase" style={{ color: "#00BFFF" }}>
                  Neural Log
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: "rgba(0,191,255,0.35)" }}>
                  {messages.length} {messages.length === 1 ? "message" : "messages"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {messages.length > 0 && (
                  <button
                    onClick={() => jarvis.clearMessages()}
                    className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg transition-all"
                    style={{
                      color: "rgba(0,191,255,0.4)",
                      border: "1px solid rgba(0,191,255,0.1)",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(0,191,255,0.75)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(0,191,255,0.4)"; }}
                  >
                    <Trash2 size={10} /> Clear
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="flex items-center justify-center h-7 w-7 rounded-lg transition-all"
                  style={{ color: "rgba(0,191,255,0.35)", border: "1px solid rgba(0,191,255,0.1)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(0,191,255,0.7)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(0,191,255,0.35)"; }}
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3" style={{ scrollbarWidth: "none" }}>
              <AnimatePresence initial={false}>
                {messages.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-full gap-4 py-16 text-center"
                  >
                    <div
                      className="rounded-full p-4"
                      style={{ border: "1px solid rgba(0,191,255,0.1)", background: "rgba(0,191,255,0.04)" }}
                    >
                      <Volume2 size={20} style={{ color: "rgba(0,191,255,0.3)" }} />
                    </div>
                    <div>
                      <p className="text-[11px] tracking-[0.18em] uppercase mb-1" style={{ color: "rgba(0,191,255,0.35)" }}>
                        Awaiting Command
                      </p>
                      <p className="text-[11px]" style={{ color: "rgba(0,191,255,0.2)" }}>
                        Say "Hey Jarvis" to begin
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
                )}
              </AnimatePresence>
              <div ref={endRef} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Quick commands strip ─────────────────────────────────────────────────────

const QUICK_CMDS = [
  "What's pending today?",
  "Open Horizon",
  "Schedule a meeting",
  "Open Ask",
];

function QuickCommands() {
  return (
    <div className="flex items-center gap-2 overflow-x-auto py-0.5" style={{ scrollbarWidth: "none" }}>
      {QUICK_CMDS.map((cmd) => (
        <button
          key={cmd}
          onClick={() => jarvis.sendText(cmd)}
          className="shrink-0 text-[11px] px-3 py-1.5 rounded-full whitespace-nowrap transition-all duration-150"
          style={{
            color: "rgba(0,191,255,0.5)",
            border: "1px solid rgba(0,191,255,0.12)",
            background: "rgba(0,191,255,0.04)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(0,191,255,0.1)";
            (e.currentTarget as HTMLElement).style.color = "#00BFFF";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,191,255,0.35)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(0,191,255,0.04)";
            (e.currentTarget as HTMLElement).style.color = "rgba(0,191,255,0.5)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,191,255,0.12)";
          }}
        >
          {cmd}
        </button>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function JarvisPage() {
  const { voiceState, isAwake, messages, transcript, enabled } = useJarvis();
  const { tasks } = useHorizon();
  const navigate   = useNavigate();
  const [input, setInput]       = useState("");
  const [showChat, setShowChat] = useState(false);
  const inputRef  = useRef<HTMLInputElement>(null);
  const coreRef   = useRef<HTMLDivElement>(null);
  const [coreSize, setCoreSize] = useState(280);

  // Today's task stats
  const todayStr = new Date().toISOString().split("T")[0];
  const pendingToday   = tasks.filter((t) => t.taskDate === todayStr && !t.completed).length;
  const completedToday = tasks.filter((t) => t.taskDate === todayStr &&  t.completed).length;

  // Measure center area for AI Core sizing
  useEffect(() => {
    if (!coreRef.current) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setCoreSize(Math.min(width * 0.72, height * 0.72, 340));
    });
    obs.observe(coreRef.current);
    return () => obs.disconnect();
  }, []);

  // Auto-start on page open
  useEffect(() => { jarvis.autoStartIfEnabled(); }, []);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    await jarvis.sendText(text);
  }, [input]);

  const handleVoice = () => {
    if (!enabled) { jarvis.enable(); return; }
    voiceState === "listening" ? jarvis.dismiss() : jarvis.activate();
  };

  const stateInfo   = STATE_DISPLAY[voiceState] ?? STATE_DISPLAY.idle;
  const isListening = voiceState === "listening";
  const isActive    = isAwake || isListening;
  const unreadCount = messages.length;

  return (
    <div className="relative h-full flex flex-col overflow-hidden" style={{ background: "#060c10" }}>

      {/* ── Ambient glow ── */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: "radial-gradient(ellipse 65% 45% at 50% 0%, rgba(0,191,255,0.055) 0%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.07]"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(0,191,255,0.8) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* ── Header ── */}
      <div
        className="relative z-10 shrink-0 flex items-center justify-between px-5 h-12"
        style={{ borderBottom: "1px solid rgba(0,191,255,0.07)" }}
      >
        {/* Left: back + wordmark */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => void navigate({ to: "/" })}
            className="flex items-center justify-center h-7 w-7 rounded-lg transition-all duration-200"
            style={{
              background: "rgba(0,191,255,0.04)",
              border: "1px solid rgba(0,191,255,0.1)",
              color: "rgba(0,191,255,0.4)",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(0,191,255,0.75)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(0,191,255,0.4)"; }}
          >
            <ChevronLeft size={13} />
          </button>

          <div className="flex items-center gap-2">
            <motion.div
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={{ background: enabled ? "#00BFFF" : "rgba(0,191,255,0.2)" }}
              animate={enabled ? { opacity: [0.4, 1, 0.4] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span
              className="text-[13px] font-bold tracking-[0.2em]"
              style={{ color: enabled ? "#00BFFF" : "rgba(0,191,255,0.35)" }}
            >
              J.A.R.V.I.S
            </span>
            <span className="hidden sm:block text-[9px] tracking-[0.12em] font-light" style={{ color: "rgba(0,191,255,0.22)" }}>
              PERSONAL AI
            </span>
          </div>
        </div>

        {/* Right: stats pill + enable toggle + chat toggle */}
        <div className="flex items-center gap-2">
          {/* Task mini stats */}
          <div
            className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-full"
            style={{ background: "rgba(0,191,255,0.04)", border: "1px solid rgba(0,191,255,0.08)" }}
          >
            <div className="flex items-center gap-1.5">
              <Radio size={9} style={{ color: "#4DEBFF" }} />
              <span className="text-[10px] tabular-nums" style={{ color: "rgba(0,191,255,0.55)" }}>
                <span style={{ color: "#4DEBFF" }}>{pendingToday}</span> pending
              </span>
            </div>
            <div className="w-px h-3" style={{ background: "rgba(0,191,255,0.12)" }} />
            <div className="flex items-center gap-1.5">
              <CheckSquare size={9} style={{ color: "rgba(0,191,255,0.4)" }} />
              <span className="text-[10px] tabular-nums" style={{ color: "rgba(0,191,255,0.55)" }}>
                <span style={{ color: "rgba(0,191,255,0.75)" }}>{completedToday}</span> done
              </span>
            </div>
          </div>

          {/* Enable / disable */}
          <button
            onClick={() => (enabled ? jarvis.disable() : jarvis.enable())}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] tracking-widest font-medium transition-all duration-200"
            style={{
              background: enabled ? "rgba(0,191,255,0.1)" : "rgba(0,191,255,0.03)",
              border: `1px solid ${enabled ? "rgba(0,191,255,0.3)" : "rgba(0,191,255,0.1)"}`,
              color: enabled ? "#00BFFF" : "rgba(0,191,255,0.35)",
            }}
          >
            <Zap size={10} />
            {enabled ? "ONLINE" : "ENABLE"}
          </button>

          {/* Chat log toggle */}
          <button
            onClick={() => setShowChat(true)}
            className="relative flex items-center justify-center h-8 w-8 rounded-full transition-all duration-200"
            style={{
              background: "rgba(0,191,255,0.04)",
              border: "1px solid rgba(0,191,255,0.1)",
              color: "rgba(0,191,255,0.45)",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#00BFFF"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(0,191,255,0.45)"; }}
          >
            <MessageSquare size={13} />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 h-4 w-4 rounded-full text-[8px] font-bold flex items-center justify-center"
                style={{ background: "#00BFFF", color: "#060c10" }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Main center area ── */}
      <div
        ref={coreRef}
        className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center gap-6 px-6 py-6"
      >
        {/* Live transcript banner */}
        <AnimatePresence>
          {transcript && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full max-w-sm w-full text-center text-[12px] z-10"
              style={{
                background: "rgba(0,15,25,0.85)",
                border: "1px solid rgba(0,191,255,0.28)",
                color: "rgba(0,191,255,0.85)",
                backdropFilter: "blur(12px)",
                boxShadow: "0 4px 24px rgba(0,191,255,0.1)",
              }}
            >
              {transcript}
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Core hologram */}
        <AICore voiceState={voiceState} isAwake={isActive} size={coreSize} />

        {/* State label */}
        <div className="text-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={voiceState}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="text-[15px] tracking-wider font-light"
              style={{ color: stateInfo.color }}
            >
              {stateInfo.label}
            </motion.p>
          </AnimatePresence>
          <p className="text-[10px] tracking-[0.1em] mt-1.5" style={{ color: "rgba(0,191,255,0.22)" }}>
            {stateInfo.sub}
          </p>
        </div>

        {/* Last jarvis reply — quick preview, no need to open drawer */}
        {messages.length > 0 && (() => {
          const last = messages[messages.length - 1];
          if (last.role !== "jarvis") return null;
          return (
            <motion.div
              key={last.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="max-w-sm w-full rounded-2xl px-4 py-3 text-center"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(0,191,255,0.1)",
              }}
            >
              <p className="text-[12px] leading-relaxed" style={{ color: "rgba(200,230,255,0.75)" }}>
                {last.content.slice(0, 160)}{last.content.length > 160 ? "…" : ""}
              </p>
            </motion.div>
          );
        })()}
      </div>

      {/* ── Quick commands ── */}
      <div
        className="relative z-10 shrink-0 px-4 py-2"
        style={{ borderTop: "1px solid rgba(0,191,255,0.05)" }}
      >
        <QuickCommands />
      </div>

      {/* ── Input bar ── */}
      <div
        className="relative z-10 shrink-0 px-4 py-3"
        style={{
          borderTop: "1px solid rgba(0,191,255,0.07)",
          background: "rgba(6,12,16,0.75)",
          backdropFilter: "blur(16px)",
        }}
      >
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          {/* Mic button */}
          <motion.button
            type="button"
            onClick={handleVoice}
            whileTap={{ scale: 0.92 }}
            disabled={!isVoiceAssistantSupported}
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200"
            style={{
              background: isListening ? "rgba(0,191,255,0.15)" : "rgba(0,191,255,0.05)",
              border: `1px solid ${isListening ? "rgba(0,191,255,0.5)" : "rgba(0,191,255,0.14)"}`,
              boxShadow: isListening ? "0 0 16px rgba(0,191,255,0.22)" : "none",
              color: isListening ? "#00BFFF" : "rgba(0,191,255,0.4)",
            }}
          >
            {isListening ? <MicOff size={15} /> : <Mic size={15} />}
          </motion.button>

          {/* Text input */}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter command, sir…"
            className="flex-1 h-10 rounded-xl px-4 text-[13px] outline-none transition-all duration-200"
            style={{
              background: "rgba(0,191,255,0.05)",
              border: "1px solid rgba(0,191,255,0.14)",
              color: "rgba(200,235,255,0.88)",
              caretColor: "#00BFFF",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "rgba(0,191,255,0.38)";
              e.target.style.background  = "rgba(0,191,255,0.07)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "rgba(0,191,255,0.14)";
              e.target.style.background  = "rgba(0,191,255,0.05)";
            }}
            onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
          />

          {/* Send button */}
          <motion.button
            type="submit"
            disabled={!input.trim()}
            whileTap={{ scale: input.trim() ? 0.92 : 1 }}
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200"
            style={{
              background: input.trim() ? "rgba(0,191,255,0.14)" : "rgba(0,191,255,0.03)",
              border: `1px solid ${input.trim() ? "rgba(0,191,255,0.4)" : "rgba(0,191,255,0.1)"}`,
              color: input.trim() ? "#00BFFF" : "rgba(0,191,255,0.25)",
            }}
          >
            <Send size={14} />
          </motion.button>
        </form>
      </div>

      {/* ── Chat drawer (slide-in from right) ── */}
      <ChatDrawer
        messages={messages}
        open={showChat}
        onClose={() => setShowChat(false)}
      />
    </div>
  );
}
