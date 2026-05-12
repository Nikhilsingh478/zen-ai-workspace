import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, MicOff, Send, Trash2, ChevronDown, Zap, Radio, Clock, CheckSquare, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useJarvis, jarvis } from "@/lib/jarvis";
import { useHorizon } from "@/lib/horizon";
import { AICore } from "@/components/jarvis/ai-core";
import { isVoiceAssistantSupported } from "@/hooks/use-voice-assistant";

export const Route = createFileRoute("/jarvis")({ component: JarvisPage });

// ─── Background ───────────────────────────────────────────────────────────────

function JarvisBackground() {
  return (
    <>
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #020508 0%, #040C14 50%, #020810 100%)" }} />
      {/* Dot grid */}
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle, rgba(0,191,255,0.12) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      {/* Ambient corner glows */}
      <div className="absolute top-0 left-0 w-96 h-96 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(0,191,255,0.04) 0%, transparent 70%)", transform: "translate(-30%, -30%)" }} />
      <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(0,191,255,0.03) 0%, transparent 70%)", transform: "translate(30%, 30%)" }} />
    </>
  );
}

// ─── Status panel (left) ──────────────────────────────────────────────────────

function StatusPanel({ voiceState, isAwake, enabled }: { voiceState: string; isAwake: boolean; enabled: boolean }) {
  const [time, setTime] = useState(() => new Date());
  const { tasks } = useHorizon();
  const todayStr = new Date().toISOString().split("T")[0];
  const pendingToday = tasks.filter((t) => t.taskDate === todayStr && !t.completed).length;
  const completedToday = tasks.filter((t) => t.taskDate === todayStr && t.completed).length;

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const stateLabel: Record<string, string> = {
    idle: "STANDBY", listening: "LISTENING", processing: "PROCESSING", speaking: "RESPONDING",
  };
  const stateColor: Record<string, string> = {
    idle: "rgba(0,191,255,0.4)", listening: "#4DEBFF", processing: "#00BFFF", speaking: "#4DEBFF",
  };

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto pr-1" style={{ scrollbarWidth: "none" }}>
      {/* JARVIS wordmark */}
      <div className="mb-2">
        <p className="text-[11px] tracking-[0.3em] font-light" style={{ color: "rgba(0,191,255,0.5)" }}>SYSTEM</p>
        <p className="text-[22px] font-bold tracking-widest" style={{ color: "#00BFFF", textShadow: "0 0 20px rgba(0,191,255,0.4)" }}>J.A.R.V.I.S</p>
        <p className="text-[9px] tracking-[0.15em] font-light mt-0.5" style={{ color: "rgba(0,191,255,0.3)" }}>JUST A RATHER VERY INTELLIGENT SYSTEM</p>
      </div>

      {/* AI Status */}
      <HudCard label="AI STATUS">
        <div className="flex items-center gap-2">
          <motion.div className="h-2 w-2 rounded-full" style={{ background: enabled ? "#00BFFF" : "rgba(0,191,255,0.25)" }}
            animate={enabled ? { opacity: [0.5, 1, 0.5], scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />
          <span className="text-[11px] font-medium tracking-wider" style={{ color: enabled ? "#4DEBFF" : "rgba(0,191,255,0.35)" }}>
            {enabled ? "ONLINE" : "OFFLINE"}
          </span>
        </div>
      </HudCard>

      {/* Voice state */}
      <HudCard label="VOICE MODE">
        <motion.p key={voiceState} initial={{ opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }} className="text-[12px] font-semibold tracking-widest"
          style={{ color: stateColor[voiceState] ?? "rgba(0,191,255,0.4)" }}>
          {stateLabel[voiceState] ?? "STANDBY"}
        </motion.p>
      </HudCard>

      {/* Clock */}
      <HudCard label="SYSTEM TIME">
        <p className="text-[18px] font-light tabular-nums" style={{ color: "#00BFFF", fontVariantNumeric: "tabular-nums" }}>
          {time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: "rgba(0,191,255,0.35)" }}>
          {time.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
        </p>
      </HudCard>

      {/* Task stats */}
      <HudCard label="HORIZON TASKS">
        <div className="space-y-1.5">
          <Stat icon={<CheckSquare size={10} />} label="Pending Today" value={pendingToday} />
          <Stat icon={<Zap size={10} />} label="Completed Today" value={completedToday} />
          <Stat icon={<Radio size={10} />} label="Total Active" value={tasks.filter((t) => !t.completed).length} />
        </div>
      </HudCard>

      {/* Wake words */}
      <HudCard label="WAKE PHRASES">
        {["Jarvis", "Hey Jarvis", "Okay Jarvis"].map((w) => (
          <p key={w} className="text-[10px] tracking-wider mb-0.5" style={{ color: "rgba(0,191,255,0.45)" }}>"{w}"</p>
        ))}
      </HudCard>

      {/* Quick commands */}
      <HudCard label="QUICK COMMANDS">
        {[
          "What's pending today?",
          "Open Horizon",
          "Schedule a meeting",
          "Open Ask",
        ].map((cmd) => (
          <button key={cmd} onClick={() => jarvis.sendText(cmd)}
            className="text-left text-[10px] py-1 px-2 rounded w-full mb-0.5 transition-colors tracking-wide"
            style={{ color: "rgba(0,191,255,0.5)", border: "1px solid rgba(0,191,255,0.1)", background: "rgba(0,191,255,0.04)" }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "#00BFFF"; (e.target as HTMLElement).style.background = "rgba(0,191,255,0.1)"; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "rgba(0,191,255,0.5)"; (e.target as HTMLElement).style.background = "rgba(0,191,255,0.04)"; }}>
            {">"} {cmd}
          </button>
        ))}
      </HudCard>
    </div>
  );
}

function HudCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(0,17,27,0.7)", border: "1px solid rgba(0,191,255,0.1)", backdropFilter: "blur(8px)" }}>
      <p className="text-[9px] tracking-[0.25em] font-light mb-2" style={{ color: "rgba(0,191,255,0.35)" }}>{label}</p>
      {children}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5" style={{ color: "rgba(0,191,255,0.4)" }}>
        {icon}
        <span className="text-[10px] tracking-wider">{label}</span>
      </div>
      <span className="text-[12px] font-semibold tabular-nums" style={{ color: "#00BFFF" }}>{value}</span>
    </div>
  );
}

// ─── Chat panel (right) ───────────────────────────────────────────────────────

function ChatPanel({ messages }: { messages: ReturnType<typeof useJarvis>["messages"] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[9px] tracking-[0.25em]" style={{ color: "rgba(0,191,255,0.4)" }}>NEURAL LINK — CONVERSATION</p>
        {messages.length > 0 && (
          <button onClick={() => jarvis.clearMessages()} className="flex items-center gap-1 text-[9px] tracking-wider px-2 py-1 rounded transition-colors"
            style={{ color: "rgba(0,191,255,0.3)", border: "1px solid rgba(0,191,255,0.08)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(0,191,255,0.6)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(0,191,255,0.3)")}>
            <Trash2 size={9} /> CLEAR
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1" style={{ scrollbarWidth: "none" }}>
        <AnimatePresence initial={false}>
          {messages.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full text-center gap-3 pt-8">
              <div className="rounded-full p-3" style={{ border: "1px solid rgba(0,191,255,0.12)", background: "rgba(0,17,27,0.5)" }}>
                <Volume2 size={20} style={{ color: "rgba(0,191,255,0.3)" }} />
              </div>
              <p className="text-[11px] tracking-[0.15em]" style={{ color: "rgba(0,191,255,0.3)" }}>AWAITING COMMAND</p>
              <p className="text-[10px]" style={{ color: "rgba(0,191,255,0.18)" }}>Say "Hey Jarvis" or type below</p>
            </motion.div>
          ) : (
            messages.map((msg) => (
              <motion.div key={msg.id} initial={{ opacity: 0, x: msg.role === "user" ? 8 : -8, y: 4 }}
                animate={{ opacity: 1, x: 0, y: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className="max-w-[90%] rounded-2xl px-3.5 py-2.5"
                  style={msg.role === "user"
                    ? { background: "rgba(0,60,100,0.6)", border: "1px solid rgba(0,191,255,0.25)", color: "#B0E8FF" }
                    : { background: "rgba(0,17,27,0.8)", border: "1px solid rgba(0,191,255,0.12)", color: "rgba(200,235,255,0.85)" }}>
                  {msg.role === "jarvis" && (
                    <p className="text-[8px] tracking-[0.2em] mb-1.5" style={{ color: "rgba(0,191,255,0.45)" }}>J.A.R.V.I.S</p>
                  )}
                  <p className="text-[12px] leading-relaxed">{msg.content}</p>
                  {msg.tasks && msg.tasks.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {msg.tasks.map((t, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1"
                          style={{ background: "rgba(0,191,255,0.08)", border: "1px solid rgba(0,191,255,0.15)" }}>
                          <CheckSquare size={10} style={{ color: "#4DEBFF", flexShrink: 0 }} />
                          <div>
                            <p className="text-[11px] font-medium" style={{ color: "#4DEBFF" }}>{t.title}</p>
                            <p className="text-[9px]" style={{ color: "rgba(0,191,255,0.5)" }}>{t.taskDate} at {t.taskTime}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[9px] mt-1.5 text-right" style={{ color: "rgba(0,191,255,0.25)" }}>
                    {new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
        <div ref={endRef} />
      </div>
    </div>
  );
}

// ─── State label ──────────────────────────────────────────────────────────────

const STATE_DISPLAY = {
  idle:       { text: "Standing by, sir.",     sub: `Say "Hey Jarvis" to activate` },
  listening:  { text: "Listening…",            sub: "Speak your command"           },
  processing: { text: "Processing request…",   sub: "One moment, sir"              },
  speaking:   { text: "Responding…",           sub: "J.A.R.V.I.S is speaking"     },
};

// ─── Main page ────────────────────────────────────────────────────────────────

function JarvisPage() {
  const { voiceState, isAwake, messages, transcript, enabled } = useJarvis();
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [showRight, setShowRight] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-start JARVIS passive listening when page opens
  useEffect(() => {
    if (!enabled) return;
    jarvis.autoStartIfEnabled();
  }, [enabled]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    await jarvis.sendText(text);
  }, [input]);

  const handleVoice = () => {
    if (!enabled) {
      jarvis.enable();
      return;
    }
    if (voiceState === "listening") {
      jarvis.dismiss();
    } else {
      jarvis.activate();
    }
  };

  const stateInfo = STATE_DISPLAY[voiceState] ?? STATE_DISPLAY.idle;
  const isListening = voiceState === "listening";
  const isActive = isAwake || isListening;

  return (
    <div className="relative h-full overflow-hidden" style={{ fontFamily: "'SF Pro Display', 'Segoe UI', system-ui, sans-serif" }}>
      <JarvisBackground />

      {/* ── Header ── */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-4 pb-3"
        style={{ borderBottom: "1px solid rgba(0,191,255,0.08)" }}>
        <div className="flex items-center gap-3">
          <motion.div className="h-2 w-2 rounded-full" style={{ background: enabled ? "#00BFFF" : "rgba(0,191,255,0.2)" }}
            animate={enabled ? { opacity: [0.4, 1, 0.4] } : {}}
            transition={{ duration: 2, repeat: Infinity }} />
          <span className="text-[13px] font-semibold tracking-[0.2em]" style={{ color: enabled ? "#00BFFF" : "rgba(0,191,255,0.35)" }}>J.A.R.V.I.S</span>
          <span className="text-[9px] tracking-[0.15em] hidden md:block" style={{ color: "rgba(0,191,255,0.3)" }}>PERSONAL AI OPERATING SYSTEM</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle enable */}
          <button onClick={() => enabled ? jarvis.disable() : jarvis.enable()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] tracking-wider font-medium transition-all"
            style={{
              background: enabled ? "rgba(0,191,255,0.1)" : "rgba(0,191,255,0.04)",
              border: `1px solid ${enabled ? "rgba(0,191,255,0.3)" : "rgba(0,191,255,0.1)"}`,
              color: enabled ? "#00BFFF" : "rgba(0,191,255,0.35)",
            }}>
            <Zap size={11} />
            {enabled ? "ACTIVE" : "ENABLE"}
          </button>

          {/* Mobile: toggle right panel */}
          <button onClick={() => setShowRight((v) => !v)}
            className="md:hidden flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] transition-all"
            style={{ background: "rgba(0,17,27,0.6)", border: "1px solid rgba(0,191,255,0.1)", color: "rgba(0,191,255,0.5)" }}>
            <Clock size={11} />
            LOG
          </button>

          {/* Navigate away */}
          <button onClick={() => void navigate({ to: "/" })}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] transition-all"
            style={{ background: "rgba(0,17,27,0.4)", border: "1px solid rgba(0,191,255,0.08)", color: "rgba(0,191,255,0.3)" }}>
            <ChevronDown size={11} />
            <span className="hidden md:inline">MINIMISE</span>
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="relative z-10 flex h-[calc(100%-56px-72px)]">
        {/* Left status panel */}
        <div className="hidden md:flex flex-col w-56 shrink-0 px-4 py-4"
          style={{ borderRight: "1px solid rgba(0,191,255,0.08)" }}>
          <StatusPanel voiceState={voiceState} isAwake={isAwake} enabled={enabled} />
        </div>

        {/* Center: AI Core */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-4 relative">
          {/* Transcript strip */}
          <AnimatePresence>
            {transcript && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full max-w-xs truncate text-center"
                style={{ background: "rgba(0,17,27,0.85)", border: "1px solid rgba(0,191,255,0.2)", color: "rgba(0,191,255,0.7)", fontSize: 12, backdropFilter: "blur(8px)" }}>
                {transcript}
              </motion.div>
            )}
          </AnimatePresence>

          <AICore voiceState={voiceState} isAwake={isActive} size={Math.min(window.innerWidth * 0.45, 340)} />

          {/* State label */}
          <div className="text-center">
            <motion.p key={voiceState} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
              className="text-[13px] tracking-wider font-light"
              style={{ color: isActive ? "#00BFFF" : "rgba(0,191,255,0.4)" }}>
              {stateInfo.text}
            </motion.p>
            <p className="text-[10px] tracking-[0.1em] mt-1" style={{ color: "rgba(0,191,255,0.25)" }}>
              {stateInfo.sub}
            </p>
          </div>

          {/* Mobile: chat toggle */}
          <AnimatePresence>
            {showRight && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                className="md:hidden absolute inset-x-0 top-0 bottom-0 px-3 py-4 overflow-y-auto"
                style={{ background: "rgba(2,5,8,0.97)", backdropFilter: "blur(16px)", zIndex: 10 }}>
                <ChatPanel messages={messages} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right chat panel */}
        <div className="hidden md:flex flex-col w-72 shrink-0 px-4 py-4"
          style={{ borderLeft: "1px solid rgba(0,191,255,0.08)" }}>
          <ChatPanel messages={messages} />
        </div>
      </div>

      {/* ── Input bar ── */}
      <div className="relative z-10 px-4 py-3" style={{ borderTop: "1px solid rgba(0,191,255,0.08)", background: "rgba(2,5,8,0.8)", backdropFilter: "blur(12px)" }}>
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          {/* Mic button */}
          <motion.button
            type="button"
            onClick={handleVoice}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.93 }}
            disabled={!isVoiceAssistantSupported}
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-all"
            style={{
              background: isListening ? "rgba(0,191,255,0.2)" : "rgba(0,17,27,0.8)",
              border: `1px solid ${isListening ? "rgba(0,191,255,0.5)" : "rgba(0,191,255,0.15)"}`,
              boxShadow: isListening ? "0 0 16px rgba(0,191,255,0.25)" : "none",
              color: isListening ? "#00BFFF" : "rgba(0,191,255,0.4)",
            }}>
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          </motion.button>

          {/* Text input */}
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter command, sir…"
              className="w-full h-10 rounded-xl px-4 text-[13px] outline-none transition-all"
              style={{
                background: "rgba(0,17,27,0.7)",
                border: "1px solid rgba(0,191,255,0.15)",
                color: "rgba(200,235,255,0.85)",
                caretColor: "#00BFFF",
              }}
              onFocus={(e) => { e.target.style.borderColor = "rgba(0,191,255,0.4)"; e.target.style.boxShadow = "0 0 12px rgba(0,191,255,0.1)"; }}
              onBlur={(e) => { e.target.style.borderColor = "rgba(0,191,255,0.15)"; e.target.style.boxShadow = "none"; }}
            />
          </div>

          {/* Send button */}
          <motion.button
            type="submit"
            disabled={!input.trim()}
            whileHover={{ scale: input.trim() ? 1.05 : 1 }}
            whileTap={{ scale: input.trim() ? 0.93 : 1 }}
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-all"
            style={{
              background: input.trim() ? "rgba(0,191,255,0.15)" : "rgba(0,17,27,0.6)",
              border: `1px solid ${input.trim() ? "rgba(0,191,255,0.4)" : "rgba(0,191,255,0.1)"}`,
              color: input.trim() ? "#00BFFF" : "rgba(0,191,255,0.25)",
            }}>
            <Send size={15} />
          </motion.button>
        </form>
      </div>
    </div>
  );
}
