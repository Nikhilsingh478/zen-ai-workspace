import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic, MicOff, Send, Trash2, Zap, CheckSquare,
  Volume2, ChevronLeft, Clock, X, Sparkles,
} from "lucide-react";
import {
  useJarvis, jarvis, initJarvisSession, endSession,
  getSessions, deleteSession, getAllMemories, deleteMemory,
  deliverMorningBriefing,
} from "@/lib/jarvis";
import type { JarvisSession, Memory } from "@/lib/jarvis";
import type { SearchSource, SearchType } from "@/lib/gemini";
import { useHorizon } from "@/lib/horizon";
import { AICore } from "@/components/jarvis/ai-core";
import { SearchResult } from "@/components/jarvis/search-result";
import { isVoiceAssistantSupported } from "@/hooks/use-voice-assistant";

export const Route = createFileRoute("/jarvis")({ component: JarvisPage });

// ─── Live clock ───────────────────────────────────────────────────────────────

function LiveClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const time = t.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  const date = t.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return (
    <div>
      <p style={{ fontSize: 30, fontFamily: "'Space Mono', monospace", fontWeight: 700, color: "#f0f0f0", lineHeight: 1, letterSpacing: "0.02em" }}>
        {time}
      </p>
      <p style={{ fontSize: 11, color: "#6b6b6b", marginTop: 4 }}>{date}</p>
    </div>
  );
}

// ─── Left status panel ────────────────────────────────────────────────────────

const STATE_DOT: Record<string, { color: string; pulse: boolean }> = {
  idle:        { color: "#52525b", pulse: false },
  listening:   { color: "#38bdf8", pulse: true },
  processing:  { color: "#fbbf24", pulse: true },
  speaking:    { color: "#34d399", pulse: true },
  interrupted: { color: "#f97316", pulse: false },
  error:       { color: "#f87171", pulse: false },
};

function StatusPanel({ voiceState, enabled }: { voiceState: string; enabled: boolean }) {
  const { tasks } = useHorizon();
  const todayStr = new Date().toISOString().split("T")[0];
  const todayTasks = tasks.filter((t) => t.taskDate === todayStr && !t.completed);
  const highPriority = todayTasks.filter((t) => t.priority === "high");
  const dotInfo = STATE_DOT[voiceState] ?? STATE_DOT.idle;

  const DIV = <div style={{ height: 1, background: "#1f1f1f", margin: "16px 0" }} />;

  return (
    <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", overflowY: "auto", scrollbarWidth: "none", height: "100%" }}>
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 9, letterSpacing: "0.3em", color: "#52525b", textTransform: "uppercase", fontFamily: "'Space Mono', monospace" }}>JARVIS</p>
        <p style={{ fontSize: 9, color: "#3f3f46", marginTop: 2, fontFamily: "'Space Mono', monospace" }}>v3.0</p>
      </div>

      <LiveClock />
      {DIV}

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <motion.div
          style={{ width: 6, height: 6, borderRadius: "50%", background: dotInfo.color, flexShrink: 0 }}
          animate={dotInfo.pulse ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
          transition={dotInfo.pulse ? { duration: 1.2, repeat: Infinity } : {}}
        />
        <AnimatePresence mode="wait">
          <motion.span
            key={voiceState}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.15 }}
            style={{ fontSize: 10, letterSpacing: "0.12em", color: "#6b6b6b", textTransform: "uppercase", fontFamily: "'Space Mono', monospace" }}
          >
            {voiceState}
          </motion.span>
        </AnimatePresence>
      </div>
      {DIV}

      <div>
        <p style={{ fontSize: 9, letterSpacing: "0.2em", color: "#3f3f46", textTransform: "uppercase", marginBottom: 8, fontFamily: "'Space Mono', monospace" }}>Today</p>
        <p style={{ fontSize: 14, color: "#d4d4d8", fontWeight: 500 }}>{todayTasks.length} tasks</p>
        {highPriority.length > 0 && (
          <p style={{ fontSize: 12, color: "#f87171", marginTop: 4 }}>{highPriority.length} high priority</p>
        )}
      </div>
      {DIV}

      <button
        onClick={() => (enabled ? jarvis.disable() : jarvis.enable())}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: 0, background: "none", border: "none", cursor: "pointer" }}
      >
        <div style={{ width: 28, height: 16, borderRadius: 8, position: "relative", background: enabled ? "rgba(56,189,248,0.15)" : "#27272a", border: `1px solid ${enabled ? "rgba(56,189,248,0.35)" : "#3f3f46"}`, transition: "all 0.2s", flexShrink: 0 }}>
          <motion.div
            style={{ position: "absolute", top: 2, width: 10, height: 10, borderRadius: "50%", background: enabled ? "#38bdf8" : "#52525b" }}
            animate={{ left: enabled ? 13 : 2 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </div>
        <span style={{ fontSize: 12, color: enabled ? "#38bdf8" : "#52525b", transition: "color 0.2s" }}>
          {enabled ? "JARVIS Active" : "JARVIS Inactive"}
        </span>
      </button>
      {DIV}

      <p style={{ fontSize: 9, letterSpacing: "0.2em", color: "#3f3f46", textTransform: "uppercase", marginBottom: 10, fontFamily: "'Space Mono', monospace" }}>Quick</p>
      {["What's pending today?", "Open Horizon", "Search latest news", "Open Ask"].map((cmd) => (
        <button
          key={cmd}
          onClick={() => jarvis.sendText(cmd)}
          style={{ display: "block", width: "100%", textAlign: "left", padding: "5px 0", background: "none", border: "none", fontSize: 12, color: "#52525b", cursor: "pointer", transition: "color 0.15s", marginBottom: 2 }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#a1a1aa"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#52525b"; }}
        >
          <span style={{ marginRight: 6, color: "#3f3f46" }}>›</span>{cmd}
        </button>
      ))}
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ReturnType<typeof useJarvis>["messages"][number] }) {
  const isUser          = msg.role === "user";
  const isInterrupted   = msg.type === "interrupted";
  const isMorningBrief  = msg.type === "morning_briefing";
  const isSearchResult  = msg.type === "search_result";
  const isTaskCreated   = msg.type === "task_created";

  const time = new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  if (isInterrupted) {
    return (
      <div style={{ textAlign: "center", padding: "4px 0" }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#3f3f46", letterSpacing: "0.14em" }}>
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
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: "rgba(6,78,59,0.2)", border: "1px solid rgba(52,211,153,0.2)", alignSelf: "flex-start" }}
      >
        <CheckSquare size={11} style={{ color: "#34d399", flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: "#34d399" }}>{msg.content}</span>
      </motion.div>
    );
  }

  if (isMorningBrief) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ borderRadius: 12, padding: "12px 14px", background: "rgba(8,47,73,0.4)", border: "1px solid rgba(56,189,248,0.15)" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Sparkles size={11} style={{ color: "rgba(56,189,248,0.6)" }} />
          <span style={{ fontSize: 9, color: "rgba(56,189,248,0.6)", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "'Space Mono', monospace" }}>
            Morning Briefing
          </span>
        </div>
        <p style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{msg.content}</p>
        <p style={{ fontSize: 10, color: "#3a3a3a", marginTop: 8, textAlign: "right" }}>{time}</p>
      </motion.div>
    );
  }

  if (isSearchResult && msg.metadata) {
    const sources = (msg.metadata.sources as SearchSource[]) ?? [];
    const searchType = (msg.metadata.searchType as SearchType) ?? "general";
    return (
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
        <SearchResult text={msg.content} sources={sources} searchType={searchType} />
        <p style={{ fontSize: 10, color: "#3a3a3a", marginTop: 4, paddingLeft: 2 }}>{time}</p>
      </motion.div>
    );
  }

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 8, y: 4 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        style={{ display: "flex", justifyContent: "flex-end" }}
      >
        <div
          style={{
            maxWidth: "80%",
            padding: "8px 12px",
            borderRadius: "16px 16px 4px 16px",
            background: "rgba(39,39,42,0.6)",
            border: "1px solid rgba(63,63,70,0.4)",
          }}
        >
          <p style={{ fontSize: 13, color: "#f0f0f0", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{msg.content}</p>
          <p style={{ fontSize: 10, color: "#3f3f46", marginTop: 4, textAlign: "right" }}>{time}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -8, y: 4 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      style={{ display: "flex", gap: 8, alignItems: "flex-start" }}
    >
      <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 2, background: "#1c1c1e", border: "1px solid #2a2a2a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Mono', monospace", fontSize: 8, color: "#6b6b6b", fontWeight: 700 }}>
        J
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{msg.content}</p>
        <p style={{ fontSize: 10, color: "#3a3a3a", marginTop: 4 }}>{time}</p>
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

  useEffect(() => { loadPage(0); }, []);

  async function loadPage(p: number) {
    setLoading(true);
    const data = await getSessions(p, PER_PAGE);
    if (p === 0) setSessions(data);
    else setSessions((prev) => [...prev, ...data]);
    setHasMore(data.length === PER_PAGE);
    setPage(p);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    const ok = await deleteSession(id);
    if (ok) { setSessions((prev) => prev.filter((s) => s.id !== id)); setConfirmDelete(null); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "12px 14px 8px", borderBottom: "1px solid #1f1f1f", flexShrink: 0 }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 8, letterSpacing: "0.25em", color: "#3f3f46", textTransform: "uppercase" }}>
          Session Archive
        </span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
        {loading && sessions.length === 0 ? (
          <div style={{ padding: "24px 14px", color: "#3f3f46", fontSize: 12 }}>Loading…</div>
        ) : sessions.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8 }}>
            <Clock size={16} style={{ color: "#3f3f46" }} />
            <p style={{ fontSize: 11, color: "#3f3f46" }}>No sessions yet</p>
          </div>
        ) : (
          <>
            {sessions.map((session) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ padding: "12px 14px", borderBottom: "1px solid #1f1f1f" }}
                className="jarvis-history-row"
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontSize: 12, color: "#a1a1aa" }}>
                      {new Date(session.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    <p style={{ fontSize: 10, color: "#52525b", marginTop: 2 }}>
                      {new Date(session.started_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} · {session.message_count} messages
                    </p>
                  </div>

                  {confirmDelete === session.id ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={() => handleDelete(session.id)}
                        style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", cursor: "pointer" }}
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        style={{ background: "none", border: "1px solid #2a2a2a", borderRadius: 5, padding: "2px 6px", color: "#52525b", cursor: "pointer", display: "flex", alignItems: "center" }}
                      >
                        <X size={8} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(session.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#3f3f46", padding: 2, transition: "color 0.15s" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#f87171"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#3f3f46"; }}
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>

                {session.session_summary && (
                  <p style={{ fontSize: 12, color: "#6b6b6b", lineHeight: 1.5, marginTop: 6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {session.session_summary}
                  </p>
                )}
              </motion.div>
            ))}

            {hasMore && (
              <button
                onClick={() => loadPage(page + 1)}
                disabled={loading}
                style={{ width: "100%", padding: "10px", fontSize: 11, color: "#52525b", background: "none", border: "none", cursor: "pointer", borderTop: "1px solid #1f1f1f" }}
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Memory Panel ─────────────────────────────────────────────────────────────

const MEMORY_BADGES: Record<string, React.CSSProperties> = {
  preference: { background: "rgba(88,28,135,0.25)", border: "1px solid rgba(139,92,246,0.25)", color: "#a78bfa" },
  commitment: { background: "rgba(92,45,0,0.25)",   border: "1px solid rgba(251,191,36,0.25)",  color: "#fbbf24" },
  idea:       { background: "rgba(8,47,73,0.25)",   border: "1px solid rgba(56,189,248,0.25)",  color: "#38bdf8" },
  fact:       { background: "rgba(24,24,27,0.4)",   border: "1px solid rgba(63,63,70,0.3)",     color: "#a1a1aa" },
  general:    { background: "rgba(24,24,27,0.4)",   border: "1px solid rgba(63,63,70,0.3)",     color: "#6b6b6b" },
};

function MemoryPanel() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const FILTERS = ["all", "preference", "commitment", "idea", "fact", "general"];

  useEffect(() => { loadMemories(activeFilter); }, [activeFilter]);

  async function loadMemories(type: string) {
    setLoading(true);
    const data = await getAllMemories(type === "all" ? undefined : type);
    setMemories(data);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    const ok = await deleteMemory(id);
    if (ok) { setMemories((prev) => prev.filter((m) => m.id !== id)); setConfirmDelete(null); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "12px 14px 8px", borderBottom: "1px solid #1f1f1f", flexShrink: 0 }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 8, letterSpacing: "0.25em", color: "#3f3f46", textTransform: "uppercase" }}>
          Memory Banks
        </span>
      </div>

      <div style={{ display: "flex", gap: 6, padding: "8px 14px", flexWrap: "wrap", flexShrink: 0, borderBottom: "1px solid #1f1f1f" }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            style={{
              fontSize: 9, padding: "2px 8px", borderRadius: 4, cursor: "pointer", letterSpacing: "0.08em",
              background: activeFilter === f ? "#27272a" : "transparent",
              border: `1px solid ${activeFilter === f ? "#3f3f46" : "#1f1f1f"}`,
              color: activeFilter === f ? "#a1a1aa" : "#52525b",
              transition: "all 0.15s",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
        {loading ? (
          <div style={{ padding: "24px 14px", color: "#3f3f46", fontSize: 12 }}>Loading…</div>
        ) : memories.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8 }}>
            <p style={{ fontSize: 11, color: "#3f3f46" }}>No memories yet</p>
          </div>
        ) : (
          memories.map((memory) => (
            <motion.div
              key={memory.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ padding: "10px 14px", borderBottom: "1px solid #1f1f1f" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, ...MEMORY_BADGES[memory.memory_type] ?? MEMORY_BADGES.general }}>
                      {memory.memory_type}
                    </span>
                    {memory.recalled_count > 0 && (
                      <span style={{ fontSize: 9, color: "#3f3f46" }}>recalled {memory.recalled_count}×</span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: "#a1a1aa", lineHeight: 1.5 }}>{memory.content}</p>
                  <p style={{ fontSize: 10, color: "#3f3f46", marginTop: 4 }}>
                    {new Date(memory.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>

                {confirmDelete === memory.id ? (
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={() => handleDelete(memory.id)}
                      style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", cursor: "pointer" }}
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      style={{ background: "none", border: "1px solid #2a2a2a", borderRadius: 5, padding: "2px 6px", color: "#52525b", cursor: "pointer", display: "flex", alignItems: "center" }}
                    >
                      <X size={8} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(memory.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#3f3f46", padding: 2, flexShrink: 0, transition: "color 0.15s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#f87171"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#3f3f46"; }}
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Right panel ──────────────────────────────────────────────────────────────

type RightTab = "chat" | "history" | "memory";

function RightPanel({ messages }: { messages: ReturnType<typeof useJarvis>["messages"] }) {
  const [activeTab, setActiveTab] = useState<RightTab>("chat");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === "chat") endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTab]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", borderBottom: "1px solid #1f1f1f", flexShrink: 0 }}>
        <div style={{ display: "flex" }}>
          {(["chat", "history", "memory"] as RightTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "10px 12px", background: "none", border: "none",
                borderBottom: activeTab === tab ? "1px solid #f0f0f0" : "1px solid transparent",
                fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase",
                color: activeTab === tab ? "#f0f0f0" : "#52525b",
                cursor: "pointer", transition: "color 0.15s",
                fontFamily: "'Space Mono', monospace",
              }}
              onMouseEnter={(e) => { if (activeTab !== tab) (e.currentTarget as HTMLElement).style.color = "#a1a1aa"; }}
              onMouseLeave={(e) => { if (activeTab !== tab) (e.currentTarget as HTMLElement).style.color = "#52525b"; }}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "chat" && messages.length > 0 && (
          <button
            onClick={() => jarvis.clearMessages()}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#3f3f46", fontSize: 10, display: "flex", alignItems: "center", gap: 4, padding: "4px 6px", borderRadius: 4, transition: "color 0.15s" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#6b6b6b"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#3f3f46"; }}
          >
            <Trash2 size={9} /> clear
          </button>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {activeTab === "chat" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", scrollbarWidth: "none", display: "flex", flexDirection: "column", gap: 12, padding: "14px 14px 10px" }}>
              <AnimatePresence initial={false}>
                {messages.length === 0 ? (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, padding: "24px 0" }}>
                    <div style={{ borderRadius: "50%", padding: 14, border: "1px solid #1f1f1f", background: "#111111" }}>
                      <Volume2 size={16} style={{ color: "#3f3f46" }} />
                    </div>
                    <p style={{ fontSize: 12, color: "#52525b" }}>Say "Hey Jarvis" or type below</p>
                  </motion.div>
                ) : (
                  messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
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

// ─── Main page ────────────────────────────────────────────────────────────────

function JarvisPage() {
  const { voiceState, isAwake, messages, transcript, enabled } = useJarvis();
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [showChat, setShowChat] = useState(false);
  const sessionIdRef = useRef<string>("");

  useEffect(() => {
    let isMounted = true;

    initJarvisSession().then(async (id) => {
      if (!isMounted) return;
      sessionIdRef.current = id;
      await deliverMorningBriefing(id);
    });

    jarvis.autoStartIfEnabled();

    const handleBeforeUnload = () => {
      if (sessionIdRef.current) endSession(sessionIdRef.current);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      isMounted = false;
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (sessionIdRef.current) endSession(sessionIdRef.current);
    };
  }, []);

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

  const isListening = voiceState === "listening";
  const isActive = isAwake || isListening;

  return (
    <div className="relative h-full flex flex-col overflow-hidden" style={{ background: "#0a0a0a" }}>

      {/* ── Header ── */}
      <div
        className="relative z-10 shrink-0 flex items-center justify-between px-4"
        style={{ height: 48, borderBottom: "1px solid #1f1f1f", background: "#0a0a0a" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <motion.div
            style={{ width: 6, height: 6, borderRadius: "50%", background: enabled ? "#38bdf8" : "#3f3f46", flexShrink: 0 }}
            animate={enabled ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
            transition={enabled ? { duration: 2, repeat: Infinity } : {}}
          />
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", color: "#f0f0f0" }}>
            JARVIS
          </span>
          <span className="hidden md:block" style={{ fontSize: 9, color: "#3f3f46", fontFamily: "'Space Mono', monospace", letterSpacing: "0.12em" }}>
            PERSONAL AI OS
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setShowChat((v) => !v)}
            className="md:hidden"
            style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, background: "transparent", border: "1px solid #1f1f1f", color: "#52525b", cursor: "pointer", fontFamily: "'Space Mono', monospace" }}
          >
            log
          </button>

          <button
            onClick={() => void navigate({ to: "/" })}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, fontSize: 10, background: "transparent", border: "1px solid #1f1f1f", color: "#52525b", cursor: "pointer", transition: "color 0.15s" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#a1a1aa"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#52525b"; }}
          >
            <ChevronLeft size={11} /><span className="hidden md:inline" style={{ fontFamily: "'Space Mono', monospace" }}>back</span>
          </button>
        </div>
      </div>

      {/* ── Three-column body ── */}
      <div className="relative z-10 flex-1 min-h-0 flex overflow-hidden">

        {/* Left panel */}
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="hidden md:flex flex-col"
          style={{ width: 220, flexShrink: 0, borderRight: "1px solid #1f1f1f", overflowY: "auto", scrollbarWidth: "none" }}
        >
          <StatusPanel voiceState={voiceState} enabled={enabled} />
        </motion.div>

        {/* Center */}
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center relative" style={{ padding: "24px", overflow: "hidden" }}>

          <AnimatePresence>
            {transcript && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 max-w-xs w-full text-center"
                style={{ zIndex: 5 }}
              >
                <p style={{ fontSize: 13, color: "#a1a1aa", padding: "6px 16px", background: "#111111", border: "1px solid #1f1f1f", borderRadius: 20, display: "inline-block", maxWidth: "100%" }}>
                  {transcript}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <AICore voiceState={voiceState} isAwake={isActive} size={120} onClick={isVoiceAssistantSupported ? handleVoice : undefined} />
          </motion.div>

          {/* State hint below orb — only show when not active, to avoid redundancy with left panel */}
          {!isActive && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ fontSize: 11, color: "#3f3f46", marginTop: 16, textAlign: "center" }}
            >
              {isVoiceAssistantSupported ? "tap orb or type below" : "type below to talk"}
            </motion.p>
          )}

          {/* Mobile chat overlay */}
          <AnimatePresence>
            {showChat && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="md:hidden absolute inset-0 flex flex-col overflow-hidden"
                style={{ background: "#0a0a0a", zIndex: 20 }}
              >
                <RightPanel messages={messages} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right panel */}
        <motion.div
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="hidden md:flex flex-col"
          style={{ width: 320, flexShrink: 0, borderLeft: "1px solid #1f1f1f", minHeight: 0, overflow: "hidden" }}
        >
          <RightPanel messages={messages} />
        </motion.div>
      </div>

      {/* ── Input bar ── */}
      <div
        className="relative z-10 shrink-0 px-3 py-2"
        style={{ borderTop: "1px solid #1f1f1f", background: "#0a0a0a" }}
      >
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "#111111", border: "1px solid #1f1f1f", borderRadius: 10, padding: "4px 4px 4px 10px", transition: "border-color 0.2s" }}
          onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#2a2a2a"; }}
          onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#1f1f1f"; }}
        >
          <button
            type="button"
            onClick={isVoiceAssistantSupported ? handleVoice : undefined}
            disabled={!isVoiceAssistantSupported}
            style={{ background: "none", border: "none", cursor: isVoiceAssistantSupported ? "pointer" : "default", padding: 4, display: "flex", alignItems: "center", justifyContent: "center", color: isListening ? "#38bdf8" : "#52525b", transition: "color 0.15s" }}
            onMouseEnter={(e) => { if (isVoiceAssistantSupported) (e.currentTarget as HTMLElement).style.color = "#38bdf8"; }}
            onMouseLeave={(e) => { if (!isListening) (e.currentTarget as HTMLElement).style.color = "#52525b"; }}
          >
            {isListening ? <MicOff size={14} /> : <Mic size={14} />}
          </button>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type or speak…"
            style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "#f0f0f0", caretColor: "#38bdf8" }}
          />

          <button
            type="submit"
            disabled={!input.trim()}
            style={{
              height: 30, width: 30, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              background: input.trim() ? "rgba(56,189,248,0.1)" : "transparent",
              border: `1px solid ${input.trim() ? "rgba(56,189,248,0.25)" : "transparent"}`,
              color: input.trim() ? "#38bdf8" : "#3f3f46",
              cursor: input.trim() ? "pointer" : "default",
              transition: "all 0.15s",
            }}
          >
            <Send size={11} />
          </button>
        </form>
      </div>

      {/* ── Footer ── */}
      <div
        className="relative z-10 shrink-0 hidden md:flex items-center justify-between px-4"
        style={{ height: 22, borderTop: "1px solid #1f1f1f" }}
      >
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 7, letterSpacing: "0.18em", color: "#2a2a2a", textTransform: "uppercase" }}>
          JARVIS · SECURE CONNECTION · {enabled ? "ACTIVE" : "STANDBY"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Zap size={8} style={{ color: enabled ? "#38bdf8" : "#2a2a2a" }} />
        </div>
      </div>
    </div>
  );
}
