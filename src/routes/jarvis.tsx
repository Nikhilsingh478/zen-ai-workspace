import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic, MicOff, Send, Trash2, Zap, CheckSquare,
  Volume2, ChevronLeft, ChevronRight, Radio, Brain, Clock, Tag,
  ChevronDown, X, MessageSquare, Database, Sparkles,
  Copy, Check, Maximize2,
} from "lucide-react";
import ExtendedWindow from "@/components/jarvis/extended-window";
import { cn } from "@/lib/utils";
import { useJarvis, jarvis, initJarvisSession, endSession, getSessions, deleteSession, getAllMemories, deleteMemory, deliverMorningBriefing, kokoroManager, stopWakeWordDetection, getConversationMode, getConversationTurnCount, forceEndConversation } from "@/lib/jarvis";
import type { JarvisSession, Memory } from "@/lib/jarvis";
import type { SearchSource, SearchType } from "@/lib/gemini";
import { useHorizon } from "@/lib/horizon";
import { AICore } from "@/components/jarvis/ai-core";
import { SearchResult } from "@/components/jarvis/search-result";
import { isVoiceAssistantSupported } from "@/hooks/use-voice-assistant";

export const Route = createFileRoute("/jarvis")({ component: JarvisPage });

// ─── Background layers ─────────────────────────────────────────────────────────

function JarvisBackground() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -5%, rgba(125,211,252,0.07) 0%, transparent 70%), " +
            "radial-gradient(ellipse 40% 35% at 85% 85%, rgba(56,189,248,0.03) 0%, transparent 60%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(125,211,252,0.045) 1px, transparent 1px), " +
            "linear-gradient(90deg, rgba(125,211,252,0.045) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 35%, rgba(5,6,9,0.75) 100%)",
        }}
      />
    </>
  );
}

// ─── Header waveform EQ ────────────────────────────────────────────────────────

function HeaderEQ({ active }: { active: boolean }) {
  const bases = [0.35, 0.7, 1, 0.8, 0.55, 0.9, 0.45];
  if (!active) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 14 }}>
      {bases.map((b, i) => (
        <div
          key={i}
          className="jarvis-eq-bar"
          style={{ height: 14, "--b": `${b * 0.5}s`, "--d": `${i * 0.07}s` } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// ─── Signal bars ──────────────────────────────────────────────────────────────

function SignalBars() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2 }}>
      {[5, 8, 11, 14].map((h, i) => (
        <div
          key={i}
          style={{
            width: 3, height: h, borderRadius: 1,
            background: i < 3 ? "#7DD3FC" : "rgba(125,211,252,0.2)",
          }}
        />
      ))}
    </div>
  );
}

// ─── HUD panel ────────────────────────────────────────────────────────────────

function HudPanel({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn("rounded-xl p-3 transition-all duration-200", className)}
      style={{ background: "rgba(125,211,252,0.025)", border: "1px solid rgba(125,211,252,0.09)" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(125,211,252,0.18)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(125,211,252,0.09)"; }}
    >
      <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 7, letterSpacing: "0.32em", color: "rgba(125,211,252,0.3)", textTransform: "uppercase", marginBottom: 8, fontWeight: 700 }}>
        {label}
      </p>
      {children}
    </div>
  );
}

// ─── Live clock ───────────────────────────────────────────────────────────────

function LiveClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const hh = t.getHours().toString().padStart(2, "0");
  const mm = t.getMinutes().toString().padStart(2, "0");
  const ss = t.getSeconds().toString().padStart(2, "0");
  const date = t.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 20, fontWeight: 700, color: "#7DD3FC", letterSpacing: "0.04em", lineHeight: 1 }}>
          {hh}:{mm}
        </span>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "rgba(125,211,252,0.4)", letterSpacing: "0.06em" }}>
          {ss}
        </span>
      </div>
      <p style={{ fontSize: 9, color: "rgba(125,211,252,0.28)", letterSpacing: "0.1em", marginTop: 3 }}>{date}</p>
    </div>
  );
}

// ─── Stat row ─────────────────────────────────────────────────────────────────

function StatRow({ icon, label, value, color = "#7DD3FC" }: { icon: React.ReactNode; label: string; value: number; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(125,211,252,0.38)" }}>
        {icon}
        <span style={{ fontSize: 9, letterSpacing: "0.05em" }}>{label}</span>
      </div>
      <motion.span
        key={value}
        initial={{ opacity: 0, y: -3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color }}
      >
        {value}
      </motion.span>
    </div>
  );
}

// ─── Left status panel ────────────────────────────────────────────────────────

function StatusPanel({
  voiceState,
  enabled,
  conversationMode,
  conversationTurns,
  onEndConversation,
}: {
  voiceState: string;
  enabled: boolean;
  conversationMode: "idle" | "active" | "cooling-down";
  conversationTurns: number;
  onEndConversation: () => void;
}) {
  const { tasks } = useHorizon();
  const todayStr = new Date().toISOString().split("T")[0];
  const pendingToday = tasks.filter((t) => t.taskDate === todayStr && !t.completed).length;
  const completedToday = tasks.filter((t) => t.taskDate === todayStr && t.completed).length;
  const totalActive = tasks.filter((t) => !t.completed).length;
  const totalToday = pendingToday + completedToday;
  const pct = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  const STATE_COLOR: Record<string, string> = {
    idle: "rgba(125,211,252,0.35)", listening: "#93C5FD",
    processing: "#7DD3FC", speaking: "#BAE6FD",
    interrupted: "#FCD34D", error: "#F87171",
  };
  const STATE_LABEL: Record<string, string> = {
    idle: "STANDBY", listening: "LISTENING", processing: "PROCESSING",
    speaking: "RESPONDING", interrupted: "INTERRUPTED", error: "ERROR",
  };

  return (
    <div className="flex flex-col gap-2 h-full overflow-y-auto" style={{ scrollbarWidth: "none" }}>
      <HudPanel label="AI STATUS">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            className={enabled ? "jarvis-blink" : ""}
            style={{ width: 6, height: 6, borderRadius: "50%", background: enabled ? "#7DD3FC" : "rgba(125,211,252,0.18)", boxShadow: enabled ? "0 0 6px rgba(125,211,252,0.7)" : "none", flexShrink: 0 }}
          />
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: enabled ? "#93C5FD" : "rgba(125,211,252,0.28)" }}>
            {enabled ? "ONLINE" : "OFFLINE"}
          </span>
        </div>
      </HudPanel>

      <HudPanel label="VOICE MODE">
        <AnimatePresence mode="wait">
          <motion.div key={voiceState} initial={{ opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -2 }} transition={{ duration: 0.15 }} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: STATE_COLOR[voiceState] ?? "rgba(125,211,252,0.3)", flexShrink: 0 }} />
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", color: STATE_COLOR[voiceState] ?? "rgba(125,211,252,0.35)" }}>
              {STATE_LABEL[voiceState] ?? "STANDBY"}
            </span>
          </motion.div>
        </AnimatePresence>
      </HudPanel>

      {/* Conversation mode indicator */}
      <AnimatePresence>
        {conversationMode !== "idle" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <HudPanel label="CONVERSATION">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      conversationMode === "active"
                        ? "bg-sky-400 animate-pulse"
                        : "bg-amber-400 animate-pulse"
                    }`}
                  />
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                    {conversationMode === "active" ? "Conversing" : "Listening..."}
                  </span>
                </div>
                {conversationTurns > 0 && (
                  <span className="text-[10px] text-zinc-700 font-mono">
                    {conversationTurns} turns
                  </span>
                )}
              </div>

              {conversationMode === "active" && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={onEndConversation}
                  className="mt-2 w-full text-[10px] text-zinc-700
                             hover:text-zinc-400 font-mono uppercase tracking-widest
                             py-1.5 rounded-md border border-zinc-800/60
                             hover:border-zinc-700 transition-all duration-150"
                >
                  End conversation
                </motion.button>
              )}
            </HudPanel>
          </motion.div>
        )}
      </AnimatePresence>

      <HudPanel label="SYSTEM TIME"><LiveClock /></HudPanel>

      <HudPanel label="HORIZON TASKS">
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <StatRow icon={<CheckSquare size={9} />} label="Pending Today" value={pendingToday} />
          <StatRow icon={<Zap size={9} />} label="Completed" value={completedToday} color="#34D399" />
          <StatRow icon={<Radio size={9} />} label="Total Active" value={totalActive} color="#93C5FD" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
          <div style={{ flex: 1, height: 3, borderRadius: 99, background: "rgba(125,211,252,0.1)", overflow: "hidden" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg, #0369A1, #7DD3FC)" }}
            />
          </div>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "rgba(125,211,252,0.45)" }}>{pct}%</span>
        </div>
      </HudPanel>

      <HudPanel label="QUICK COMMANDS">
        {["What's pending today?", "Open Horizon", "Schedule a meeting", "Open Ask"].map((cmd) => (
          <motion.button
            key={cmd}
            onClick={() => jarvis.sendText(cmd)}
            whileHover={{ x: 2 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "5px 8px", borderRadius: 7, fontSize: 9, color: "rgba(125,211,252,0.45)", letterSpacing: "0.04em", background: "transparent", border: "1px solid rgba(125,211,252,0.07)", cursor: "pointer", marginBottom: 3, transition: "all 0.15s ease" }}
            onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = "#7DD3FC"; el.style.background = "rgba(125,211,252,0.08)"; el.style.borderColor = "rgba(125,211,252,0.2)"; }}
            onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = "rgba(125,211,252,0.45)"; el.style.background = "transparent"; el.style.borderColor = "rgba(125,211,252,0.07)"; }}
          >
            <span style={{ color: "rgba(125,211,252,0.4)", marginRight: 4 }}>›</span>{cmd}
          </motion.button>
        ))}
      </HudPanel>
    </div>
  );
}

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — silent fail
    }
  }, [content]);

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => void handleCopy()}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md
                 text-[10px] text-zinc-600 hover:text-zinc-300
                 hover:bg-zinc-800/60 transition-all duration-150
                 font-mono"
      title="Copy message"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-emerald-400" />
          <span className="text-emerald-400">COPIED</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          <span>COPY</span>
        </>
      )}
    </motion.button>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  onExpand,
}: {
  msg: ReturnType<typeof useJarvis>["messages"][number];
  onExpand: (content: string) => void;
}) {
  const isUser = msg.role === "user";
  const isInterrupted = msg.type === "interrupted";
  const isMorningBrief = msg.type === "morning_briefing";
  const isSearchResult = msg.type === "search_result";
  const isTaskCreated  = msg.type === "task_created";

  const time = new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const MONO = { fontFamily: "'Space Mono', monospace" };

  if (isInterrupted) {
    return (
      <div style={{ textAlign: "center", padding: "4px 0" }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "rgba(125,211,252,0.25)", letterSpacing: "0.14em" }}>
          — interrupted —
        </span>
      </div>
    );
  }

  if (isTaskCreated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: "rgba(6,78,59,0.2)", border: "1px solid rgba(52,211,153,0.25)", alignSelf: "flex-start" }}
      >
        <CheckSquare size={11} style={{ color: "#34D399", flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: "#34D399" }}>{msg.content}</span>
      </motion.div>
    );
  }

  if (isMorningBrief) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ borderRadius: 10, padding: "10px 12px", background: "rgba(125,211,252,0.04)", border: "1px solid rgba(125,211,252,0.18)" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
          <Sparkles size={10} style={{ color: "rgba(125,211,252,0.6)", flexShrink: 0 }} />
          <span style={{ ...MONO, fontSize: 7, color: "rgba(125,211,252,0.5)", letterSpacing: "0.22em", textTransform: "uppercase" as const }}>
            Morning Briefing
          </span>
        </div>
        <p style={{ fontSize: 12, color: "rgba(186,230,253,0.85)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{msg.content}</p>
        <p style={{ ...MONO, fontSize: 8, color: "rgba(125,211,252,0.22)", marginTop: 7, textAlign: "right" as const }}>{time}</p>
      </motion.div>
    );
  }

  if (isSearchResult && msg.metadata) {
    const sources = (msg.metadata.sources as SearchSource[]) ?? [];
    const searchType = (msg.metadata.searchType as SearchType) ?? "general";
    return (
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
        <SearchResult text={msg.content} sources={sources} searchType={searchType} />
        <p style={{ ...MONO, fontSize: 8, color: "rgba(125,211,252,0.22)", marginTop: 4, paddingLeft: 2 }}>{time}</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: isUser ? 8 : -8, y: 4 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className={cn("flex group", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <div style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, background: "rgba(125,211,252,0.1)", border: "1px solid rgba(125,211,252,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#7DD3FC", fontWeight: 700, marginRight: 7, alignSelf: "flex-end" }}>
          J
        </div>
      )}
      <div
        style={{
          maxWidth: "86%",
          borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
          padding: "9px 12px",
          ...(isUser
            ? { background: "rgba(125,211,252,0.09)", border: "1px solid rgba(125,211,252,0.22)" }
            : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(125,211,252,0.1)" }),
        }}
      >
        {!isUser && (
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 7, letterSpacing: "0.22em", color: "rgba(125,211,252,0.5)", marginBottom: 4 }}>
            J.A.R.V.I.S
          </p>
        )}
        <p style={{ fontSize: 12, lineHeight: 1.55, color: isUser ? "rgba(186,230,253,0.92)" : "rgba(243,247,250,0.82)", whiteSpace: "pre-wrap" }}>
          {msg.content}
        </p>
        <p style={{ fontSize: 9, marginTop: 4, textAlign: "right", color: "rgba(125,211,252,0.22)", fontFamily: "'Space Mono', monospace" }}>
          {new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </p>
        {!isUser && (
          <div className="flex items-center justify-end gap-1.5 mt-2 px-1
                          opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <CopyButton content={msg.content} />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onExpand(msg.content)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md
                         text-[10px] text-zinc-600 hover:text-sky-400
                         hover:bg-sky-950/30 border border-transparent
                         hover:border-sky-900/40 transition-all duration-150
                         font-mono"
              title="Open in extended view"
            >
              <Maximize2 className="w-3 h-3" />
              <span>EXPAND</span>
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── History Panel ────────────────────────────────────────────────────────────

function HistoryPanel() {
  const [sessions, setSessions] = useState<JarvisSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const PER_PAGE = 10;

  useEffect(() => {
    loadPage(0);
  }, []);

  // Refresh history after any message exchange
  useEffect(() => {
    const handler = () => loadPage(0);
    window.addEventListener("jarvis:history-refresh", handler);
    return () => window.removeEventListener("jarvis:history-refresh", handler);
  }, []);

  async function loadPage(p: number) {
    setLoading(true);
    const data = await getSessions(p, PER_PAGE);
    if (p === 0) {
      setSessions(data);
    } else {
      setSessions((prev) => [...prev, ...data]);
    }
    setHasMore(data.length === PER_PAGE);
    setPage(p);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    const ok = await deleteSession(id);
    if (ok) {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setConfirmDelete(null);
    }
  }

  const MONO = { fontFamily: "'Space Mono', monospace" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "12px 12px 8px", borderBottom: "1px solid rgba(125,211,252,0.07)", flexShrink: 0 }}>
        <span style={{ ...MONO, fontSize: 7, letterSpacing: "0.32em", color: "rgba(125,211,252,0.3)" }}>
          SESSION ARCHIVE
        </span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        {loading && sessions.length === 0 ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
            <span style={{ ...MONO, fontSize: 9, color: "rgba(125,211,252,0.3)", letterSpacing: "0.16em" }}>LOADING…</span>
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8, textAlign: "center" }}>
            <Clock size={18} style={{ color: "rgba(125,211,252,0.2)" }} />
            <p style={{ ...MONO, fontSize: 9, color: "rgba(125,211,252,0.28)", letterSpacing: "0.16em" }}>NO SESSIONS YET</p>
          </div>
        ) : (
          <>
            {sessions.map((session) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ borderRadius: 10, padding: "10px 12px", background: "rgba(125,211,252,0.03)", border: "1px solid rgba(125,211,252,0.09)" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <div>
                    <p style={{ ...MONO, fontSize: 9, color: "rgba(125,211,252,0.6)", letterSpacing: "0.12em" }}>
                      {new Date(session.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    <p style={{ fontSize: 9, color: "rgba(125,211,252,0.3)", marginTop: 1 }}>
                      {new Date(session.started_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} · {session.message_count} messages
                    </p>
                  </div>

                  {confirmDelete === session.id ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={() => handleDelete(session.id)}
                        style={{ ...MONO, fontSize: 8, padding: "2px 7px", borderRadius: 5, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)", color: "#FCA5A5", cursor: "pointer", letterSpacing: "0.1em" }}
                      >
                        DELETE
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        style={{ ...MONO, fontSize: 8, padding: "2px 7px", borderRadius: 5, background: "transparent", border: "1px solid rgba(125,211,252,0.15)", color: "rgba(125,211,252,0.4)", cursor: "pointer" }}
                      >
                        <X size={8} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(session.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(125,211,252,0.2)", padding: 2, transition: "color 0.15s" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(239,68,68,0.7)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(125,211,252,0.2)"; }}
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>

                {session.session_summary && (
                  <p style={{ fontSize: 10, color: "rgba(125,211,252,0.45)", lineHeight: 1.5, marginTop: 4, borderTop: "1px solid rgba(125,211,252,0.06)", paddingTop: 6 }}>
                    {session.session_summary}
                  </p>
                )}

                {session.tags?.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                    {session.tags.map((tag) => (
                      <span key={tag} style={{ ...MONO, fontSize: 7, padding: "1px 5px", borderRadius: 4, background: "rgba(125,211,252,0.07)", border: "1px solid rgba(125,211,252,0.15)", color: "rgba(125,211,252,0.4)", letterSpacing: "0.08em" }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}

            {hasMore && (
              <button
                onClick={() => loadPage(page + 1)}
                disabled={loading}
                style={{ ...MONO, fontSize: 8, letterSpacing: "0.18em", padding: "6px 12px", borderRadius: 7, background: "rgba(125,211,252,0.04)", border: "1px solid rgba(125,211,252,0.12)", color: "rgba(125,211,252,0.4)", cursor: "pointer", textAlign: "center" }}
              >
                {loading ? "LOADING…" : "LOAD MORE"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Memory Panel ─────────────────────────────────────────────────────────────

const MEMORY_TYPE_COLORS: Record<string, string> = {
  general: "rgba(125,211,252,0.6)",
  preference: "#93C5FD",
  commitment: "#FCD34D",
  idea: "#86EFAC",
  fact: "#C084FC",
};

function MemoryPanel() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const FILTERS = ["all", "preference", "commitment", "idea", "fact", "general"];
  const MONO = { fontFamily: "'Space Mono', monospace" };

  useEffect(() => {
    loadMemories(activeFilter);
  }, [activeFilter]);

  async function loadMemories(type: string) {
    setLoading(true);
    const data = await getAllMemories(type === "all" ? undefined : type);
    setMemories(data);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    const ok = await deleteMemory(id);
    if (ok) {
      setMemories((prev) => prev.filter((m) => m.id !== id));
      setConfirmDelete(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "12px 12px 8px", borderBottom: "1px solid rgba(125,211,252,0.07)", flexShrink: 0 }}>
        <span style={{ ...MONO, fontSize: 7, letterSpacing: "0.32em", color: "rgba(125,211,252,0.3)" }}>
          MEMORY BANKS
        </span>
      </div>

      <div style={{ display: "flex", gap: 4, padding: "8px 12px 0", flexWrap: "wrap", flexShrink: 0 }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            style={{
              ...MONO, fontSize: 7, padding: "2px 7px", borderRadius: 5, cursor: "pointer", letterSpacing: "0.1em",
              background: activeFilter === f ? "rgba(125,211,252,0.12)" : "transparent",
              border: `1px solid ${activeFilter === f ? "rgba(125,211,252,0.35)" : "rgba(125,211,252,0.1)"}`,
              color: activeFilter === f ? "#7DD3FC" : "rgba(125,211,252,0.35)",
              transition: "all 0.15s",
            }}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
            <span style={{ ...MONO, fontSize: 9, color: "rgba(125,211,252,0.3)", letterSpacing: "0.16em" }}>LOADING…</span>
          </div>
        ) : memories.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8 }}>
            <Brain size={18} style={{ color: "rgba(125,211,252,0.2)" }} />
            <p style={{ ...MONO, fontSize: 9, color: "rgba(125,211,252,0.28)", letterSpacing: "0.16em" }}>NO MEMORIES</p>
          </div>
        ) : (
          memories.map((memory) => (
            <motion.div
              key={memory.id}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ borderRadius: 9, padding: "9px 10px", background: "rgba(125,211,252,0.03)", border: "1px solid rgba(125,211,252,0.08)" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                <p style={{ fontSize: 11, color: "rgba(243,247,250,0.78)", lineHeight: 1.5, flex: 1 }}>{memory.content}</p>

                {confirmDelete === memory.id ? (
                  <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                    <button
                      onClick={() => handleDelete(memory.id)}
                      style={{ ...MONO, fontSize: 7, padding: "2px 6px", borderRadius: 4, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)", color: "#FCA5A5", cursor: "pointer" }}
                    >
                      DEL
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(125,211,252,0.3)", padding: 1 }}
                    >
                      <X size={9} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(memory.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(125,211,252,0.18)", flexShrink: 0, padding: 2, transition: "color 0.15s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(239,68,68,0.6)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(125,211,252,0.18)"; }}
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                <span style={{ ...MONO, fontSize: 7, padding: "1px 5px", borderRadius: 4, border: `1px solid ${MEMORY_TYPE_COLORS[memory.memory_type] ?? "rgba(125,211,252,0.3)"}33`, color: MEMORY_TYPE_COLORS[memory.memory_type] ?? "rgba(125,211,252,0.4)", letterSpacing: "0.08em" }}>
                  {memory.memory_type.toUpperCase()}
                </span>
                <span style={{ fontSize: 9, color: "rgba(125,211,252,0.25)" }}>
                  {new Date(memory.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                {memory.recalled_count > 0 && (
                  <span style={{ fontSize: 9, color: "rgba(125,211,252,0.22)" }}>· recalled {memory.recalled_count}×</span>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Right panel with tabs ────────────────────────────────────────────────────

type RightTab = "chat" | "history" | "memory";

function RightPanel({
  messages,
  onExpand,
}: {
  messages: ReturnType<typeof useJarvis>["messages"];
  onExpand: (content: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<RightTab>("chat");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === "chat") {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  const MONO = { fontFamily: "'Space Mono', monospace" };

  const TAB_ICONS: Record<RightTab, React.ReactNode> = {
    chat: <MessageSquare size={9} />,
    history: <Clock size={9} />,
    memory: <Database size={9} />,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden" }}>
      {/* Tab bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px 0", borderBottom: "1px solid rgba(125,211,252,0.07)", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 2 }}>
          {(["chat", "history", "memory"] as RightTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                ...MONO, display: "flex", alignItems: "center", gap: 4, fontSize: 11, letterSpacing: "0.12em", padding: "4px 10px", borderRadius: "6px 6px 0 0", cursor: "pointer", transition: "all 0.15s",
                background: activeTab === tab ? "rgba(125,211,252,0.07)" : "transparent",
                border: `1px solid ${activeTab === tab ? "rgba(125,211,252,0.18)" : "transparent"}`,
                borderBottom: activeTab === tab ? "1px solid rgba(5,6,9,1)" : "1px solid transparent",
                color: activeTab === tab ? "#7DD3FC" : "rgba(125,211,252,0.3)",
                marginBottom: -1,
              }}
            >
              {TAB_ICONS[tab]}
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        {activeTab === "chat" && messages.length > 0 && (
          <motion.button
            onClick={() => jarvis.clearMessages()}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            style={{ display: "flex", alignItems: "center", gap: 4, ...MONO, fontSize: 8, letterSpacing: "0.16em", color: "rgba(125,211,252,0.28)", background: "none", border: "1px solid rgba(125,211,252,0.08)", padding: "3px 8px", borderRadius: 5, cursor: "pointer", marginBottom: 0, transition: "all 0.15s ease" }}
            onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = "rgba(125,211,252,0.7)"; el.style.borderColor = "rgba(125,211,252,0.25)"; }}
            onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = "rgba(125,211,252,0.28)"; el.style.borderColor = "rgba(125,211,252,0.08)"; }}
          >
            <Trash2 size={8} /> CLEAR
          </motion.button>
        )}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {activeTab === "chat" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden" }}>
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", scrollbarWidth: "none", display: "flex", flexDirection: "column", gap: 10, padding: "10px 12px" }}>
              <AnimatePresence initial={false}>
                {messages.length === 0 ? (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", gap: 10, padding: "24px 0" }}>
                    <div style={{ borderRadius: "50%", padding: 14, border: "1px solid rgba(125,211,252,0.1)", background: "rgba(125,211,252,0.04)" }}>
                      <Volume2 size={18} style={{ color: "rgba(125,211,252,0.28)" }} />
                    </div>
                    <p style={{ ...MONO, fontSize: 9, letterSpacing: "0.2em", color: "rgba(125,211,252,0.28)", textTransform: "uppercase" }}>Awaiting Command</p>
                    <p style={{ fontSize: 10, color: "rgba(125,211,252,0.16)" }}>Say "Hey Jarvis" or type below</p>
                  </motion.div>
                ) : (
                  messages.map((msg) => <MessageBubble key={msg.id} msg={msg} onExpand={onExpand} />)
                )}
              </AnimatePresence>
              <div ref={endRef} />
            </div>
          </div>
        )}

        {activeTab === "history" && <HistoryPanel />}
        {activeTab === "memory" && <MemoryPanel />}
      </div>
    </div>
  );
}

// ─── Frequency bars ───────────────────────────────────────────────────────────

function FreqBars({ active }: { active: boolean }) {
  const COUNT = 22;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 32, width: 220 }}>
      {Array.from({ length: COUNT }, (_, i) => {
        const h = (Math.sin(i * 0.7) * 0.35 + 0.55).toFixed(2);
        return (
          <div
            key={i}
            className="jarvis-freq-bar"
            style={{ height: 32, opacity: active ? 1 : 0.35, "--i": i, "--h": h } as React.CSSProperties}
          />
        );
      })}
    </div>
  );
}

// ─── State display ────────────────────────────────────────────────────────────

const STATE_DISPLAY: Record<string, { text: string; sub: string }> = {
  idle:        { text: "Standing by, sir.",   sub: 'Say "Hey Jarvis" to activate' },
  listening:   { text: "Listening…",          sub: "Speak your command" },
  processing:  { text: "Processing…",         sub: "One moment, sir" },
  speaking:    { text: "Responding…",         sub: "J.A.R.V.I.S is speaking" },
  interrupted: { text: "Interrupted.",        sub: "Ready for your next command" },
  error:       { text: "Error occurred.",     sub: "Please try again" },
};

// ─── Delay utility ────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ─── Main page ────────────────────────────────────────────────────────────────

function JarvisPage() {
  const { voiceState, isAwake, messages, transcript, enabled, currentSessionId } = useJarvis();
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [kokoroLoading, setKokoroLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const [coreSize, setCoreSize] = useState(260);
  const sessionIdRef = useRef<string>("");

  // Conversation mode state — polled from module-level runtime
  const [conversationMode, setConversationMode] = useState<"idle" | "active" | "cooling-down">("idle");
  const [conversationTurns, setConversationTurns] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setConversationMode(getConversationMode());
      setConversationTurns(getConversationTurnCount());
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Extended window state
  const [extendedWindowOpen, setExtendedWindowOpen] = useState(false);
  const [extendedWindowContent, setExtendedWindowContent] = useState<string>("");
  const [isAnimatingToExtended, setIsAnimatingToExtended] = useState(false);
  const [leftColumnVisible, setLeftColumnVisible] = useState(true);
  const [sidebarWasOpenBeforeExtended, setSidebarWasOpenBeforeExtended] = useState(false);
  const lastExtendedMsgId = useRef<string>("");
  const EXTENDED_WINDOW_THRESHOLD = 500;

  useEffect(() => {
    if (!coreRef.current) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setCoreSize(Math.min(width * 0.78, height * 0.78, 300));
    });
    obs.observe(coreRef.current);
    return () => obs.disconnect();
  }, []);

  // Sync currentSessionId from store into ref for unmount/beforeunload cleanup
  useEffect(() => {
    sessionIdRef.current = currentSessionId ?? "";
  }, [currentSessionId]);

  // Poll Kokoro ready state every 2s — clears once loaded
  useEffect(() => {
    if (!kokoroLoading) return;
    const id = setInterval(() => {
      if (kokoroManager.ready) {
        setKokoroLoading(false);
        clearInterval(id);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [kokoroLoading]);

  // Init on mount — loads memories/context, no session created until first message
  useEffect(() => {
    initJarvisSession().then(() => {
      deliverMorningBriefing();
    });

    // Initialize Kokoro TTS in background — non-blocking, falls back to browser TTS
    if (!kokoroManager.ready) {
      setKokoroLoading(true);
      kokoroManager.initialize((msg) => {
        console.log("[Kokoro]", msg);
      });
    }

    jarvis.autoStartIfEnabled();

    const handleBeforeUnload = () => {
      if (sessionIdRef.current) {
        endSession(sessionIdRef.current);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (sessionIdRef.current) {
        endSession(sessionIdRef.current);
      }
      void stopWakeWordDetection();
    };
  }, []);

  // ── Extended window animation sequence ──────────────────────────────────────

  const triggerExtendedWindowSequence = useCallback(async (content: string) => {
    if (isAnimatingToExtended || extendedWindowOpen) return;
    setIsAnimatingToExtended(true);

    // Read current sidebar state via synchronous custom event round-trip
    let sidebarCurrentlyOpen = false;
    const handleSidebarState = (e: Event) => {
      sidebarCurrentlyOpen = (e as CustomEvent).detail.isOpen as boolean;
    };
    window.addEventListener("jarvis:sidebar-state", handleSidebarState);
    window.dispatchEvent(new CustomEvent("jarvis:request-sidebar-state"));
    window.removeEventListener("jarvis:sidebar-state", handleSidebarState);

    setSidebarWasOpenBeforeExtended(sidebarCurrentlyOpen);

    // Step 1 — Collapse sidebar if expanded
    if (sidebarCurrentlyOpen) {
      window.dispatchEvent(new CustomEvent("jarvis:collapse-sidebar", {
        detail: { collapse: true },
      }));
      await delay(250);
    }

    // Step 2 — Slide left column out
    setLeftColumnVisible(false);
    await delay(300);

    // Step 3 — Center element animates up (driven by isAnimatingToExtended)
    await delay(350);

    // Step 4 — Open extended window
    setExtendedWindowContent(content);
    setExtendedWindowOpen(true);
    setIsAnimatingToExtended(false);
  }, [isAnimatingToExtended, extendedWindowOpen]);

  const closeExtendedWindowSequence = useCallback(async () => {
    // Close window first
    setExtendedWindowOpen(false);
    await delay(200);

    // Reverse Step 3 — center returns to normal (extendedWindowOpen is now false)
    setIsAnimatingToExtended(false);
    await delay(300);

    // Reverse Step 2 — left column slides back in
    setLeftColumnVisible(true);
    await delay(300);

    // Reverse Step 1 — reopen sidebar if it was open before
    if (sidebarWasOpenBeforeExtended) {
      window.dispatchEvent(new CustomEvent("jarvis:collapse-sidebar", {
        detail: { collapse: false },
      }));
    }
  }, [sidebarWasOpenBeforeExtended]);

  // Watch for long assistant replies — trigger extended window at 500+ chars
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (
      lastMsg.role === "jarvis" &&
      lastMsg.content.length > EXTENDED_WINDOW_THRESHOLD &&
      lastMsg.id !== lastExtendedMsgId.current
    ) {
      lastExtendedMsgId.current = lastMsg.id;
      setTimeout(() => {
        void triggerExtendedWindowSequence(lastMsg.content);
      }, 600);
    }
  }, [messages, triggerExtendedWindowSequence]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const text = input.trim();
      if (!text) return;
      setInput("");
      await jarvis.sendText(text);
    },
    [input],
  );

  const handleVoice = () => {
    if (!enabled) { jarvis.enable(); return; }
    voiceState === "listening" ? jarvis.dismiss() : jarvis.activate();
  };

  const stateInfo = STATE_DISPLAY[voiceState] ?? STATE_DISPLAY.idle;
  const isListening = voiceState === "listening";
  const isActive = isAwake || isListening;

  return (
    <div className="relative h-full flex flex-col overflow-hidden" style={{ background: "#050609" }}>
      <JarvisBackground />

      {/* ── Header ── */}
      <div
        className="relative z-10 shrink-0 flex items-center justify-between px-4 md:px-5"
        style={{ height: 48, borderBottom: "1px solid rgba(125,211,252,0.08)", background: "rgba(5,6,9,0.7)", backdropFilter: "blur(12px)" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            className={enabled ? "jarvis-blink" : ""}
            style={{ width: 7, height: 7, borderRadius: "50%", background: enabled ? "#7DD3FC" : "rgba(125,211,252,0.18)", boxShadow: enabled ? "0 0 8px rgba(125,211,252,0.8)" : "none", flexShrink: 0 }}
          />
          <span style={{ fontFamily: "'Space Mono', 'DM Mono', monospace", fontSize: 13, fontWeight: 700, letterSpacing: "0.28em", color: "#7DD3FC" }}>
            J.A.R.V.I.S
          </span>
          <span className="hidden md:block" style={{ fontSize: 8, letterSpacing: "0.18em", color: "rgba(125,211,252,0.25)", fontWeight: 400 }}>
            PERSONAL AI OPERATING SYSTEM
          </span>
          <div className="hidden md:flex" style={{ fontSize: 8, padding: "1px 6px", borderRadius: 4, background: "rgba(125,211,252,0.06)", border: "1px solid rgba(125,211,252,0.18)", color: "rgba(125,211,252,0.45)", letterSpacing: "0.12em", fontFamily: "'Space Mono', monospace" }}>
            v3.0
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <HeaderEQ active={isActive} />
          <div className="hidden md:block" style={{ width: 1, height: 18, background: "rgba(125,211,252,0.12)" }} />
          <SignalBars />

          <motion.button
            onClick={() => (enabled ? jarvis.disable() : jarvis.enable())}
            whileTap={{ scale: 0.95 }}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 8, fontFamily: "'Space Mono', monospace", fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", cursor: "pointer", transition: "all 0.2s ease", background: enabled ? "rgba(125,211,252,0.1)" : "rgba(125,211,252,0.03)", border: `1px solid ${enabled ? "rgba(125,211,252,0.4)" : "rgba(125,211,252,0.12)"}`, color: enabled ? "#7DD3FC" : "rgba(125,211,252,0.35)", boxShadow: enabled ? "0 0 16px rgba(125,211,252,0.15)" : "none" }}
          >
            <Zap size={9} />{enabled ? "ACTIVE" : "ENABLE"}
          </motion.button>

          <motion.button
            onClick={() => setShowChat((v) => !v)}
            whileTap={{ scale: 0.95 }}
            className="md:hidden"
            style={{ padding: "4px 10px", borderRadius: 7, fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: "0.12em", background: showChat ? "rgba(125,211,252,0.09)" : "rgba(125,211,252,0.03)", border: "1px solid rgba(125,211,252,0.12)", color: "rgba(125,211,252,0.5)", cursor: "pointer" }}
          >
            LOG
          </motion.button>

          <motion.button
            onClick={() => void navigate({ to: "/" })}
            whileTap={{ scale: 0.95 }}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 7, fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: "0.12em", background: "rgba(125,211,252,0.02)", border: "1px solid rgba(125,211,252,0.07)", color: "rgba(125,211,252,0.28)", cursor: "pointer" }}
          >
            <ChevronLeft size={10} /><span className="hidden md:inline">BACK</span>
          </motion.button>
        </div>
      </div>

      {/* ── Three-column body ── */}
      <div className="relative z-10 flex-1 min-h-0 flex overflow-hidden">

        {/* Left status panel */}
        <AnimatePresence>
          {leftColumnVisible && (
            <motion.div
              key="left-column"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{
                x: -320,
                opacity: 0,
                transition: { duration: 0.35, ease: [0.32, 0, 0.67, 0] },
              }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="hidden md:flex flex-col"
              style={{ width: 200, flexShrink: 0, padding: 12, borderRight: "1px solid rgba(125,211,252,0.07)", overflowY: "auto", scrollbarWidth: "none", gap: 6 }}
            >
              <StatusPanel
                voiceState={voiceState}
                enabled={enabled}
                conversationMode={conversationMode}
                conversationTurns={conversationTurns}
                onEndConversation={() => {
                  forceEndConversation();
                  setConversationMode("idle");
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chevron toggle — shown only when left column is hidden */}
        <AnimatePresence>
          {!leftColumnVisible && (
            <motion.button
              key="left-column-toggle"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              onClick={() => setLeftColumnVisible(true)}
              className="fixed left-0 top-1/2 -translate-y-1/2 z-40
                         w-5 h-12 bg-zinc-900 border border-zinc-700/50
                         border-l-0 rounded-r-lg
                         hidden md:flex items-center justify-center
                         hover:bg-zinc-800 hover:border-zinc-600
                         transition-colors duration-150 group"
              title="Show panel"
            >
              <ChevronRight className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Center: orb + labels + freq bars */}
        <motion.div
          animate={
            isAnimatingToExtended || extendedWindowOpen
              ? {
                  scale: 0.45,
                  y: -180,
                  transition: { duration: 0.5, ease: [0.32, 0, 0.67, 0], delay: 0.1 },
                }
              : {
                  scale: 1,
                  y: 0,
                  transition: { duration: 0.5, ease: [0.33, 1, 0.68, 1] },
                }
          }
          className="flex-1 min-w-0 flex flex-col items-center justify-center relative"
          style={{ padding: "20px 24px", overflow: "hidden" }}
          ref={coreRef}
        >
          <div className="jarvis-scan-line" />

          <AnimatePresence>
            {transcript && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 max-w-xs w-full text-center text-[11px] truncate px-4 py-1.5 rounded-full"
                style={{ background: "rgba(0,15,25,0.82)", border: "1px solid rgba(125,211,252,0.25)", color: "rgba(125,211,252,0.8)", backdropFilter: "blur(12px)", boxShadow: "0 4px 20px rgba(125,211,252,0.08)", zIndex: 5 }}
              >
                {transcript}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ flexShrink: 0, position: "relative" }}
          >
            <AICore voiceState={voiceState} isAwake={isActive} size={coreSize} />

            {/* Cooldown ring — visible only during conversation cooldown */}
            <AnimatePresence>
              {conversationMode === "cooling-down" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    border: "1px solid rgba(56, 189, 248, 0.2)",
                    boxShadow: "0 0 20px rgba(56, 189, 248, 0.06)",
                  }}
                />
              )}
            </AnimatePresence>
          </motion.div>

          <div style={{ textAlign: "center", flexShrink: 0, marginTop: 12 }}>
            <AnimatePresence mode="wait">
              <motion.p
                key={voiceState}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                style={{ fontSize: 14, letterSpacing: "0.12em", fontWeight: 300, color: isActive ? "#7DD3FC" : "rgba(125,211,252,0.38)" }}
              >
                {stateInfo.text}
              </motion.p>
            </AnimatePresence>
            <p style={{ fontSize: 9, letterSpacing: "0.12em", color: "rgba(125,211,252,0.2)", marginTop: 4 }}>{stateInfo.sub}</p>
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2" style={{ zIndex: 1 }}>
            <FreqBars active={isActive} />
          </div>

          <AnimatePresence>
            {showChat && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="md:hidden absolute inset-0 flex flex-col overflow-hidden"
                style={{ background: "rgba(5,6,9,0.97)", backdropFilter: "blur(16px)", zIndex: 20 }}
              >
                <RightPanel messages={messages} onExpand={(content) => void triggerExtendedWindowSequence(content)} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Right panel with tabs */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="hidden md:flex flex-col"
          style={{ width: 280, flexShrink: 0, borderLeft: "1px solid rgba(125,211,252,0.07)", minHeight: 0, overflow: "hidden" }}
        >
          <RightPanel messages={messages} onExpand={(content) => void triggerExtendedWindowSequence(content)} />
        </motion.div>
      </div>

      {/* Extended Window */}
      <ExtendedWindow
        content={extendedWindowContent}
        messages={messages}
        onClose={() => void closeExtendedWindowSequence()}
        isOpen={extendedWindowOpen}
      />

      {/* ── Input bar ── */}
      <div
        className="relative z-10 shrink-0 px-3 py-2.5"
        style={{ borderTop: "1px solid rgba(125,211,252,0.07)", background: "rgba(5,6,9,0.7)", backdropFilter: "blur(14px)" }}
      >
        {kokoroLoading && (
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "rgba(125,211,252,0.3)", textAlign: "center", paddingBottom: 6, letterSpacing: "0.12em" }}>
            Loading voice model…
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <motion.button
            type="button"
            onClick={handleVoice}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
            disabled={!isVoiceAssistantSupported}
            style={{ height: 36, width: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s ease", background: isListening ? "rgba(125,211,252,0.15)" : "rgba(125,211,252,0.04)", border: `1px solid ${isListening ? "rgba(125,211,252,0.48)" : "rgba(125,211,252,0.12)"}`, boxShadow: isListening ? "0 0 16px rgba(125,211,252,0.22)" : "none", color: isListening ? "#7DD3FC" : "rgba(125,211,252,0.38)", cursor: isVoiceAssistantSupported ? "pointer" : "not-allowed" }}
          >
            {isListening ? <MicOff size={14} /> : <Mic size={14} />}
          </motion.button>

          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter command, sir…"
            style={{ flex: 1, height: 36, borderRadius: 10, padding: "0 14px", fontSize: 12, outline: "none", transition: "all 0.2s ease", background: "rgba(125,211,252,0.04)", border: "1px solid rgba(125,211,252,0.12)", color: "rgba(200,235,255,0.85)", caretColor: "#7DD3FC" }}
            onFocus={(e) => { e.target.style.borderColor = "rgba(125,211,252,0.35)"; e.target.style.background = "rgba(125,211,252,0.06)"; }}
            onBlur={(e) => { e.target.style.borderColor = "rgba(125,211,252,0.12)"; e.target.style.background = "rgba(125,211,252,0.04)"; }}
          />

          <motion.button
            type="submit"
            disabled={!input.trim()}
            whileHover={{ scale: input.trim() ? 1.06 : 1 }}
            whileTap={{ scale: input.trim() ? 0.92 : 1 }}
            style={{ height: 36, width: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s ease", background: input.trim() ? "rgba(125,211,252,0.12)" : "rgba(125,211,252,0.03)", border: `1px solid ${input.trim() ? "rgba(125,211,252,0.35)" : "rgba(125,211,252,0.09)"}`, color: input.trim() ? "#7DD3FC" : "rgba(125,211,252,0.22)", boxShadow: input.trim() ? "0 0 14px rgba(125,211,252,0.2)" : "none", cursor: input.trim() ? "pointer" : "not-allowed" }}
          >
            <Send size={13} />
          </motion.button>
        </form>
      </div>

      {/* ── Footer status strip ── */}
      <div
        className="relative z-10 shrink-0 hidden md:flex items-center justify-between px-4"
        style={{ height: 24, borderTop: "1px solid rgba(125,211,252,0.06)", background: "rgba(5,6,9,0.6)" }}
      >
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 7, letterSpacing: "0.2em", color: "rgba(125,211,252,0.2)" }}>
          SYSTEM SECURE · NEURAL LINK ACTIVE · MEMORY ONLINE · ALL SENSORS NOMINAL
        </span>
        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
          {[1, 1, 1, 0, 1, 0, 0, 1].map((v, i) => (
            <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: v ? "rgba(125,211,252,0.5)" : "rgba(125,211,252,0.12)" }} />
          ))}
        </div>
      </div>
    </div>
  );
}
