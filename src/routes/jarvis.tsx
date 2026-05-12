import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic, MicOff, Send, Trash2, Zap, CheckSquare,
  Volume2, Clock, ChevronLeft, Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useJarvis, jarvis } from "@/lib/jarvis";
import { useHorizon } from "@/lib/horizon";
import { AICore } from "@/components/jarvis/ai-core";
import { isVoiceAssistantSupported } from "@/hooks/use-voice-assistant";

export const Route = createFileRoute("/jarvis")({ component: JarvisPage });

// ─── Subtle ambient layer ─────────────────────────────────────────────────────

function JarvisAmbient() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(0,191,255,0.04) 0%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(0,191,255,0.09) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
    </>
  );
}

// ─── HUD card ─────────────────────────────────────────────────────────────────

function HudCard({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn("rounded-xl p-3", className)}
      style={{
        background: "rgba(0,191,255,0.03)",
        border: "1px solid rgba(0,191,255,0.09)",
      }}
    >
      <p
        className="text-[8px] tracking-[0.28em] font-medium mb-2 uppercase"
        style={{ color: "rgba(0,191,255,0.35)" }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

// ─── Task stat row ────────────────────────────────────────────────────────────

function StatRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <div className="flex items-center gap-2" style={{ color: "rgba(0,191,255,0.38)" }}>
        {icon}
        <span className="text-[10px] tracking-wide">{label}</span>
      </div>
      <span className="text-[12px] font-semibold tabular-nums" style={{ color: "#00BFFF" }}>
        {value}
      </span>
    </div>
  );
}

// ─── Left status panel ────────────────────────────────────────────────────────

function StatusPanel({
  voiceState,
  enabled,
}: {
  voiceState: string;
  enabled: boolean;
}) {
  const [time, setTime] = useState(() => new Date());
  const { tasks } = useHorizon();
  const todayStr = new Date().toISOString().split("T")[0];
  const pendingToday   = tasks.filter((t) => t.taskDate === todayStr && !t.completed).length;
  const completedToday = tasks.filter((t) => t.taskDate === todayStr &&  t.completed).length;
  const totalActive    = tasks.filter((t) => !t.completed).length;

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const STATE_COLOR: Record<string, string> = {
    idle:       "rgba(0,191,255,0.35)",
    listening:  "#4DEBFF",
    processing: "#00BFFF",
    speaking:   "#4DEBFF",
  };
  const STATE_LABEL: Record<string, string> = {
    idle: "STANDBY", listening: "LISTENING", processing: "PROCESSING", speaking: "RESPONDING",
  };

  return (
    <div className="flex flex-col gap-2.5 h-full overflow-y-auto" style={{ scrollbarWidth: "none" }}>
      {/* Wordmark */}
      <div className="mb-1">
        <p className="text-[8px] tracking-[0.35em] font-light mb-0.5" style={{ color: "rgba(0,191,255,0.3)" }}>
          SYSTEM
        </p>
        <p
          className="text-[20px] font-bold tracking-[0.18em] leading-none"
          style={{ color: "#00BFFF", textShadow: "0 0 18px rgba(0,191,255,0.35)" }}
        >
          J.A.R.V.I.S
        </p>
        <p className="text-[8px] tracking-[0.1em] mt-1 font-light leading-tight" style={{ color: "rgba(0,191,255,0.22)" }}>
          JUST A RATHER VERY<br />INTELLIGENT SYSTEM
        </p>
      </div>

      {/* Status */}
      <HudCard label="AI STATUS">
        <div className="flex items-center gap-2">
          <motion.div
            className="h-1.5 w-1.5 rounded-full shrink-0"
            style={{ background: enabled ? "#00BFFF" : "rgba(0,191,255,0.18)" }}
            animate={enabled ? { opacity: [0.5, 1, 0.5] } : {}}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
          <span className="text-[11px] font-semibold tracking-widest" style={{ color: enabled ? "#4DEBFF" : "rgba(0,191,255,0.28)" }}>
            {enabled ? "ONLINE" : "OFFLINE"}
          </span>
        </div>
      </HudCard>

      {/* Voice mode */}
      <HudCard label="VOICE MODE">
        <AnimatePresence mode="wait">
          <motion.p
            key={voiceState}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.2 }}
            className="text-[11px] font-semibold tracking-widest"
            style={{ color: STATE_COLOR[voiceState] ?? "rgba(0,191,255,0.35)" }}
          >
            {STATE_LABEL[voiceState] ?? "STANDBY"}
          </motion.p>
        </AnimatePresence>
      </HudCard>

      {/* Clock */}
      <HudCard label="SYSTEM TIME">
        <p className="text-[17px] font-light tabular-nums leading-none" style={{ color: "#00BFFF" }}>
          {time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </p>
        <p className="text-[9px] mt-1" style={{ color: "rgba(0,191,255,0.3)" }}>
          {time.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
        </p>
      </HudCard>

      {/* Horizon tasks */}
      <HudCard label="HORIZON TASKS">
        <div className="space-y-0.5">
          <StatRow icon={<CheckSquare size={9} />} label="Pending Today"   value={pendingToday}   />
          <StatRow icon={<Zap         size={9} />} label="Completed Today" value={completedToday} />
          <StatRow icon={<Radio       size={9} />} label="Total Active"    value={totalActive}    />
        </div>
      </HudCard>

      {/* Wake phrases */}
      <HudCard label="WAKE PHRASES">
        {["Jarvis", "Hey Jarvis", "Okay Jarvis"].map((w) => (
          <p key={w} className="text-[10px] tracking-wide mb-0.5" style={{ color: "rgba(0,191,255,0.42)" }}>
            "{w}"
          </p>
        ))}
      </HudCard>

      {/* Quick commands */}
      <HudCard label="QUICK COMMANDS">
        {["What's pending today?", "Open Horizon", "Schedule a meeting", "Open Ask"].map((cmd) => (
          <button
            key={cmd}
            onClick={() => jarvis.sendText(cmd)}
            className="group text-left text-[10px] py-1 px-2 rounded-lg w-full mb-0.5 transition-all duration-150"
            style={{
              color: "rgba(0,191,255,0.45)",
              border: "1px solid rgba(0,191,255,0.08)",
              background: "transparent",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(0,191,255,0.08)";
              (e.currentTarget as HTMLElement).style.color = "#00BFFF";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "rgba(0,191,255,0.45)";
            }}
          >
            › {cmd}
          </button>
        ))}
      </HudCard>
    </div>
  );
}

// ─── Chat message bubble ──────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ReturnType<typeof useJarvis>["messages"][number] }) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, x: isUser ? 8 : -8, y: 4 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className="max-w-[88%] rounded-2xl px-3.5 py-2.5"
        style={
          isUser
            ? { background: "rgba(0,191,255,0.1)", border: "1px solid rgba(0,191,255,0.22)", color: "rgba(180,230,255,0.9)" }
            : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(0,191,255,0.1)", color: "rgba(255,255,255,0.8)" }
        }
      >
        {!isUser && (
          <p className="text-[8px] tracking-[0.22em] mb-1.5 font-medium" style={{ color: "rgba(0,191,255,0.45)" }}>
            J.A.R.V.I.S
          </p>
        )}
        <p className="text-[12px] leading-relaxed">{msg.content}</p>

        {/* Task confirmations */}
        {msg.tasks && msg.tasks.length > 0 && (
          <div className="mt-2 space-y-1">
            {msg.tasks.map((t, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg px-2 py-1.5"
                style={{ background: "rgba(0,191,255,0.07)", border: "1px solid rgba(0,191,255,0.15)" }}
              >
                <CheckSquare size={10} style={{ color: "#4DEBFF", flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p className="text-[11px] font-medium" style={{ color: "#4DEBFF" }}>{t.title}</p>
                  <p className="text-[9px] mt-0.5" style={{ color: "rgba(0,191,255,0.45)" }}>
                    {t.taskDate} at {t.taskTime}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-[9px] mt-1.5 text-right" style={{ color: "rgba(0,191,255,0.22)" }}>
          {new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Right chat panel ─────────────────────────────────────────────────────────

function ChatPanel({ messages }: { messages: ReturnType<typeof useJarvis>["messages"] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <p className="text-[8px] tracking-[0.28em] font-medium uppercase" style={{ color: "rgba(0,191,255,0.35)" }}>
          Neural Link
        </p>
        {messages.length > 0 && (
          <button
            onClick={() => jarvis.clearMessages()}
            className="flex items-center gap-1 text-[9px] tracking-wider px-2 py-1 rounded-lg transition-all"
            style={{ color: "rgba(0,191,255,0.3)", border: "1px solid rgba(0,191,255,0.08)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(0,191,255,0.65)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(0,191,255,0.3)"; }}
          >
            <Trash2 size={9} /> CLEAR
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1" style={{ scrollbarWidth: "none" }}>
        <AnimatePresence initial={false}>
          {messages.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full text-center gap-3 py-8"
            >
              <div
                className="rounded-full p-3.5"
                style={{ border: "1px solid rgba(0,191,255,0.1)", background: "rgba(0,191,255,0.04)" }}
              >
                <Volume2 size={18} style={{ color: "rgba(0,191,255,0.28)" }} />
              </div>
              <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "rgba(0,191,255,0.28)" }}>
                Awaiting Command
              </p>
              <p className="text-[10px]" style={{ color: "rgba(0,191,255,0.16)" }}>
                Say "Hey Jarvis" or type below
              </p>
            </motion.div>
          ) : (
            messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
          )}
        </AnimatePresence>
        <div ref={endRef} />
      </div>
    </div>
  );
}

// ─── Center state label ───────────────────────────────────────────────────────

const STATE_DISPLAY: Record<string, { text: string; sub: string }> = {
  idle:       { text: "Standing by, sir.",   sub: 'Say "Hey Jarvis" to activate'   },
  listening:  { text: "Listening…",          sub: "Speak your command"             },
  processing: { text: "Processing…",         sub: "One moment, sir"               },
  speaking:   { text: "Responding…",         sub: "J.A.R.V.I.S is speaking"       },
};

// ─── Main page ────────────────────────────────────────────────────────────────

function JarvisPage() {
  const { voiceState, isAwake, messages, transcript, enabled } = useJarvis();
  const navigate   = useNavigate();
  const [input, setInput]       = useState("");
  const [showChat, setShowChat] = useState(false);
  const inputRef  = useRef<HTMLInputElement>(null);
  const coreRef   = useRef<HTMLDivElement>(null);
  const [coreSize, setCoreSize] = useState(260);

  // Measure available center space for AI Core
  useEffect(() => {
    if (!coreRef.current) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setCoreSize(Math.min(width * 0.85, height * 0.85, 320));
    });
    obs.observe(coreRef.current);
    return () => obs.disconnect();
  }, []);

  // Auto-start on page open
  useEffect(() => {
    jarvis.autoStartIfEnabled();
  }, []);

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

  const stateInfo  = STATE_DISPLAY[voiceState] ?? STATE_DISPLAY.idle;
  const isListening = voiceState === "listening";
  const isActive    = isAwake || isListening;

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      <JarvisAmbient />

      {/* ── Header bar ── */}
      <div
        className="relative z-10 shrink-0 flex items-center justify-between px-4 md:px-5 h-11"
        style={{ borderBottom: "1px solid rgba(0,191,255,0.07)" }}
      >
        {/* Left: wordmark + status dot */}
        <div className="flex items-center gap-2.5">
          <motion.div
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: enabled ? "#00BFFF" : "rgba(0,191,255,0.18)" }}
            animate={enabled ? { opacity: [0.4, 1, 0.4] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span
            className="text-[12px] font-bold tracking-[0.22em]"
            style={{ color: enabled ? "#00BFFF" : "rgba(0,191,255,0.32)" }}
          >
            J.A.R.V.I.S
          </span>
          <span
            className="hidden md:block text-[9px] tracking-[0.14em] font-light"
            style={{ color: "rgba(0,191,255,0.22)" }}
          >
            PERSONAL AI OPERATING SYSTEM
          </span>
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-1.5">
          {/* Enable / disable toggle */}
          <button
            onClick={() => (enabled ? jarvis.disable() : jarvis.enable())}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] tracking-widest font-medium transition-all duration-200"
            style={{
              background: enabled ? "rgba(0,191,255,0.09)" : "rgba(0,191,255,0.03)",
              border: `1px solid ${enabled ? "rgba(0,191,255,0.28)" : "rgba(0,191,255,0.09)"}`,
              color: enabled ? "#00BFFF" : "rgba(0,191,255,0.3)",
            }}
          >
            <Zap size={10} />
            {enabled ? "ACTIVE" : "ENABLE"}
          </button>

          {/* Mobile: toggle chat panel */}
          <button
            onClick={() => setShowChat((v) => !v)}
            className="md:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] transition-all duration-200"
            style={{ background: "rgba(0,191,255,0.03)", border: "1px solid rgba(0,191,255,0.09)", color: "rgba(0,191,255,0.45)" }}
          >
            <Clock size={10} />
            LOG
          </button>

          {/* Navigate back */}
          <button
            onClick={() => void navigate({ to: "/" })}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] tracking-wider transition-all duration-200"
            style={{ background: "rgba(0,191,255,0.02)", border: "1px solid rgba(0,191,255,0.07)", color: "rgba(0,191,255,0.28)" }}
          >
            <ChevronLeft size={10} />
            <span className="hidden md:inline">BACK</span>
          </button>
        </div>
      </div>

      {/* ── Three-column body ── */}
      <div className="relative z-10 flex-1 min-h-0 flex overflow-hidden">

        {/* Left status panel */}
        <div
          className="hidden md:flex flex-col w-44 shrink-0 px-3 py-3 overflow-hidden"
          style={{ borderRight: "1px solid rgba(0,191,255,0.07)" }}
        >
          <StatusPanel voiceState={voiceState} enabled={enabled} />
        </div>

        {/* Center: AI Core + state label */}
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center gap-4 px-4 py-4 relative" ref={coreRef}>

          {/* Transcript banner */}
          <AnimatePresence>
            {transcript && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full max-w-xs text-center truncate text-[11px]"
                style={{
                  background: "rgba(0,17,27,0.75)",
                  border: "1px solid rgba(0,191,255,0.22)",
                  color: "rgba(0,191,255,0.75)",
                  backdropFilter: "blur(10px)",
                }}
              >
                {transcript}
              </motion.div>
            )}
          </AnimatePresence>

          {/* AI Core — sized to measured container */}
          <AICore voiceState={voiceState} isAwake={isActive} size={coreSize} />

          {/* State label */}
          <div className="text-center shrink-0">
            <AnimatePresence mode="wait">
              <motion.p
                key={voiceState}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.22 }}
                className="text-[12px] tracking-wider font-light"
                style={{ color: isActive ? "#00BFFF" : "rgba(0,191,255,0.38)" }}
              >
                {stateInfo.text}
              </motion.p>
            </AnimatePresence>
            <p className="text-[9px] tracking-[0.1em] mt-1" style={{ color: "rgba(0,191,255,0.2)" }}>
              {stateInfo.sub}
            </p>
          </div>

          {/* Mobile chat overlay */}
          <AnimatePresence>
            {showChat && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="md:hidden absolute inset-0 px-4 py-4 flex flex-col overflow-hidden"
                style={{ background: "rgba(11,11,12,0.97)", backdropFilter: "blur(16px)", zIndex: 20 }}
              >
                <ChatPanel messages={messages} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right chat panel */}
        <div
          className="hidden md:flex flex-col w-60 shrink-0 px-3 py-3 overflow-hidden"
          style={{ borderLeft: "1px solid rgba(0,191,255,0.07)" }}
        >
          <ChatPanel messages={messages} />
        </div>
      </div>

      {/* ── Input bar ── */}
      <div
        className="relative z-10 shrink-0 px-3 py-2.5"
        style={{ borderTop: "1px solid rgba(0,191,255,0.07)", background: "rgba(11,11,12,0.6)", backdropFilter: "blur(12px)" }}
      >
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          {/* Mic */}
          <motion.button
            type="button"
            onClick={handleVoice}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.93 }}
            disabled={!isVoiceAssistantSupported}
            className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200"
            style={{
              background: isListening ? "rgba(0,191,255,0.15)" : "rgba(0,191,255,0.04)",
              border: `1px solid ${isListening ? "rgba(0,191,255,0.45)" : "rgba(0,191,255,0.12)"}`,
              boxShadow: isListening ? "0 0 14px rgba(0,191,255,0.2)" : "none",
              color: isListening ? "#00BFFF" : "rgba(0,191,255,0.38)",
            }}
          >
            {isListening ? <MicOff size={14} /> : <Mic size={14} />}
          </motion.button>

          {/* Text input */}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter command, sir…"
            className="flex-1 h-9 rounded-xl px-4 text-[12px] outline-none transition-all duration-200"
            style={{
              background: "rgba(0,191,255,0.04)",
              border: "1px solid rgba(0,191,255,0.12)",
              color: "rgba(200,235,255,0.85)",
              caretColor: "#00BFFF",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "rgba(0,191,255,0.35)";
              e.target.style.background  = "rgba(0,191,255,0.06)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "rgba(0,191,255,0.12)";
              e.target.style.background  = "rgba(0,191,255,0.04)";
            }}
            onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
          />

          {/* Send */}
          <motion.button
            type="submit"
            disabled={!input.trim()}
            whileHover={{ scale: input.trim() ? 1.05 : 1 }}
            whileTap={{ scale: input.trim() ? 0.93 : 1 }}
            className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200"
            style={{
              background: input.trim() ? "rgba(0,191,255,0.12)" : "rgba(0,191,255,0.03)",
              border: `1px solid ${input.trim() ? "rgba(0,191,255,0.35)" : "rgba(0,191,255,0.09)"}`,
              color: input.trim() ? "#00BFFF" : "rgba(0,191,255,0.22)",
            }}
          >
            <Send size={13} />
          </motion.button>
        </form>
      </div>
    </div>
  );
}
