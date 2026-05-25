import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Maximize2, Minimize2, Copy, Check } from "lucide-react";
import Markdown from "react-markdown";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DisplayMessage {
  id: string;
  role: "user" | "jarvis";
  content: string;
  timestamp: number;
  type?: "text" | "task_created" | "memory_saved" | "error" | "interrupted" | "morning_briefing" | "search_result";
  metadata?: Record<string, unknown>;
}

interface HistorySessionInfo {
  startedAt: Date;
  messageCount: number;
  summary: string | null;
}

interface ExtendedWindowProps {
  content: string;
  messages: DisplayMessage[];
  onClose: () => void;
  isOpen: boolean;
  mode?: "live" | "history";
  historySession?: HistorySessionInfo | null;
}

interface WindowHeaderProps {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onClose: () => void;
  messageCount: number;
  mode: "live" | "history";
  sessionDate?: Date;
}

interface WindowMessageProps {
  message: DisplayMessage;
  mode: "live" | "history";
}

interface CopyActionProps {
  content: string;
}

// ─── Position constants ───────────────────────────────────────────────────────

const WINDOWED_STYLE: React.CSSProperties = {
  top: "50%",
  left: "50%",
  transform: "translate(-55%, -50%)",
  width: "72vw",
  maxWidth: "920px",
  minWidth: "600px",
  height: "68vh",
  maxHeight: "780px",
  minHeight: "480px",
  borderRadius: "16px",
  bottom: "auto",
  right: "auto",
};

const FULLSCREEN_STYLE: React.CSSProperties = {
  top: "16px",
  left: "16px",
  right: "16px",
  bottom: "16px",
  width: "auto",
  height: "auto",
  transform: "none",
  borderRadius: "20px",
};

// ─── Window Header ────────────────────────────────────────────────────────────

function WindowHeader({
  isFullscreen,
  onToggleFullscreen,
  onClose,
  messageCount,
  mode,
  sessionDate,
}: WindowHeaderProps) {
  const isHistory = mode === "history";

  return (
    <div
      className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
      style={{ background: "#060e1c", borderBottom: "1px solid rgba(56,189,248,0.1)" }}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-full"
              style={{
                background: "rgba(56,189,248,0.15)",
                border: "1px solid rgba(56,189,248,0.2)",
              }}
            />
          ))}
        </div>
        <div className="w-px h-3.5" style={{ background: "rgba(56,189,248,0.1)" }} />
        <span
          className="text-[10px] font-mono uppercase"
          style={{ color: "rgba(56,189,248,0.7)", letterSpacing: "0.2em" }}
        >
          {isHistory ? "Past Session" : "J.A.R.V.I.S"}
        </span>
        {isHistory && sessionDate && (
          <span className="text-[10px] font-mono" style={{ color: "rgba(56,189,248,0.35)" }}>
            {sessionDate.toLocaleDateString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
        <span className="text-[10px] font-mono" style={{ color: "rgba(56,189,248,0.25)" }}>
          {messageCount} messages
        </span>
      </div>

      <div className="flex items-center gap-1">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onToggleFullscreen}
          className="w-7 h-7 rounded-md flex items-center justify-center transition-colors duration-150"
          style={{ color: "rgba(56,189,248,0.4)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "rgba(56,189,248,0.8)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "rgba(56,189,248,0.4)";
          }}
          title={isFullscreen ? "Restore window" : "Maximize window"}
        >
          {isFullscreen
            ? <Minimize2 className="w-3.5 h-3.5" />
            : <Maximize2 className="w-3.5 h-3.5" />
          }
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          className="w-7 h-7 rounded-md flex items-center justify-center transition-colors duration-150"
          style={{ color: "rgba(56,189,248,0.4)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "rgba(248,113,113,0.8)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "rgba(56,189,248,0.4)";
          }}
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </motion.button>
      </div>
    </div>
  );
}

// ─── Copy action (live mode only) ─────────────────────────────────────────────

function CopyAction({ content }: CopyActionProps) {
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
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px]
                 transition-all duration-150 opacity-0 group-hover:opacity-100"
      style={{ color: "rgba(56,189,248,0.4)" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.color = "rgba(56,189,248,0.8)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.color = "rgba(56,189,248,0.4)";
      }}
    >
      {copied ? (
        <>
          <Check className="w-3 h-3" style={{ color: "#38bdf8" }} />
          <span style={{ color: "#38bdf8" }}>Copied</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          <span>Copy</span>
        </>
      )}
    </motion.button>
  );
}

// ─── Window Message ───────────────────────────────────────────────────────────

function WindowMessage({ message, mode }: WindowMessageProps) {
  const isUser = message.role === "user";
  const isLive = mode === "live";

  const formattedTime = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, ease: [0.33, 1, 0.68, 1] }}
        className="flex justify-end mb-4"
      >
        <div className="max-w-[75%]">
          <div
            className="px-4 py-3"
            style={{
              background: "rgba(56, 189, 248, 0.08)",
              border: "1px solid rgba(56, 189, 248, 0.15)",
              borderRadius: "16px 16px 4px 16px",
            }}
          >
            <p className="text-sm leading-relaxed" style={{ color: "#e2e8f0" }}>
              {message.content}
            </p>
          </div>
          <p className="text-[10px] text-right mt-1 pr-1" style={{ color: "#64748b" }}>
            {formattedTime}
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: [0.33, 1, 0.68, 1] }}
      className="flex gap-3 mb-4 group"
    >
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{
          background: "rgba(56,189,248,0.1)",
          border: "1px solid rgba(56,189,248,0.2)",
        }}
      >
        <span className="text-[9px] font-mono font-bold" style={{ color: "#38bdf8" }}>J</span>
      </div>

      <div className="flex-1 min-w-0">
        <div
          className="px-5 py-4"
          style={{
            background: "rgba(10, 22, 40, 0.8)",
            border: "1px solid rgba(30, 58, 95, 0.6)",
            borderRadius: "4px 16px 16px 16px",
          }}
        >
          <div className="prose prose-invert prose-sm max-w-none
                          prose-p:leading-relaxed
                          prose-headings:font-semibold
                          prose-code:text-xs prose-code:font-mono
                          prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                          prose-pre:rounded-xl
                          prose-a:no-underline hover:prose-a:underline"
            style={{
              "--tw-prose-body": "#e2e8f0",
              "--tw-prose-headings": "#e2e8f0",
              "--tw-prose-bold": "#e2e8f0",
              "--tw-prose-code": "#38bdf8",
              "--tw-prose-pre-bg": "#040b15",
              "--tw-prose-bullets": "#64748b",
              "--tw-prose-links": "#38bdf8",
            } as React.CSSProperties}
          >
            <Markdown>{message.content}</Markdown>
          </div>
        </div>

        <div className="flex items-center justify-between mt-1.5 px-1">
          <p className="text-[10px]" style={{ color: "#64748b" }}>{formattedTime}</p>
          {isLive && <CopyAction content={message.content} />}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Extended Window ──────────────────────────────────────────────────────────

const EASE_OUT: [number, number, number, number] = [0.33, 1, 0.68, 1];
const EASE_IN: [number, number, number, number] = [0.32, 0, 0.67, 0];

const windowEnterExit = {
  hidden: {
    opacity: 0,
    scale: 0.92,
    y: 20,
    transition: { duration: 0.25, ease: EASE_IN },
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.35, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    scale: 0.94,
    y: 12,
    transition: { duration: 0.2, ease: EASE_IN },
  },
};

export default function ExtendedWindow({
  messages,
  onClose,
  isOpen,
  mode = "live",
  historySession,
}: ExtendedWindowProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isHistory = mode === "history";

  // Scenario A — window opens with content: scroll to bottom after animation completes
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      }
    }, 400); // matches window open animation duration

    return () => clearTimeout(timer);
  }, [isOpen]);

  // Scenario B — new message arrives while window is already open (live mode only)
  useEffect(() => {
    if (!isOpen) return;
    if (isHistory) return; // history mode — never auto-scroll

    const timer = setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      }
    }, 100); // small delay so DOM has rendered the new message

    return () => clearTimeout(timer);
  }, [messages, isOpen, isHistory]);

  // Reset fullscreen when window closes
  useEffect(() => {
    if (!isOpen) setIsFullscreen(false);
  }, [isOpen]);

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const visibleMessages = messages.filter((m) => m.type !== "interrupted");

  const displayedMessageCount = isHistory
    ? visibleMessages.length
    : messages.filter((m) => m.role === "jarvis").length;

  const positionStyle = isFullscreen ? FULLSCREEN_STYLE : WINDOWED_STYLE;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key={`extended-window-backdrop-${mode}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(2, 8, 20, 0.6)", backdropFilter: "blur(4px)" }}
            onClick={onClose}
          />

          {/* Window */}
          <motion.div
            key={`extended-window-${mode}`}
            layout
            variants={windowEnterExit}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ layout: { duration: 0.35, ease: EASE_OUT } }}
            className="fixed z-50 flex flex-col overflow-hidden"
            style={{
              ...positionStyle,
              background: "linear-gradient(135deg, #050d18 0%, #060e1c 100%)",
              border: "1px solid rgba(56, 189, 248, 0.15)",
              boxShadow: `
                0 0 0 1px rgba(56, 189, 248, 0.05),
                0 25px 60px rgba(0, 0, 0, 0.7),
                0 0 80px rgba(56, 189, 248, 0.04)
              `,
            }}
          >
            {/* Top accent line */}
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(56,189,248,0.4), transparent)",
              }}
            />

            <WindowHeader
              isFullscreen={isFullscreen}
              onToggleFullscreen={handleToggleFullscreen}
              onClose={onClose}
              messageCount={displayedMessageCount}
              mode={mode}
              sessionDate={historySession?.startedAt}
            />

            {/* Message scroll area */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-5 py-4"
              style={{ scrollbarWidth: "thin", scrollbarColor: "#0f2040 transparent" }}
            >
              {visibleMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      background: "rgba(56,189,248,0.06)",
                      border: "1px solid rgba(56,189,248,0.12)",
                    }}
                  >
                    <span className="text-xs font-mono" style={{ color: "rgba(56,189,248,0.5)" }}>J</span>
                  </div>
                  <p
                    className="text-sm font-mono text-center"
                    style={{ color: "rgba(56,189,248,0.3)" }}
                  >
                    {isHistory
                      ? "No messages saved for this session"
                      : "Start talking to JARVIS"
                    }
                  </p>
                  {isHistory && (
                    <p
                      className="text-xs text-center max-w-48"
                      style={{ color: "rgba(56,189,248,0.2)" }}
                    >
                      Messages are saved when JARVIS responds to your commands
                    </p>
                  )}
                </div>
              ) : (
                visibleMessages.map((message) => (
                  <WindowMessage key={message.id} message={message} mode={mode} />
                ))
              )}
            </div>

            {/* Status bar */}
            <div
              className="flex items-center justify-between px-5 py-2.5 flex-shrink-0"
              style={{ background: "#040b15", borderTop: "1px solid rgba(56,189,248,0.08)" }}
            >
              <div className="flex items-center gap-2">
                {isHistory ? (
                  <>
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "rgba(56,189,248,0.2)" }}
                    />
                    <span
                      className="text-[10px] font-mono uppercase tracking-widest"
                      style={{ color: "rgba(56,189,248,0.3)" }}
                    >
                      Read-only
                    </span>
                  </>
                ) : (
                  <>
                    <div
                      className="w-1.5 h-1.5 rounded-full animate-pulse"
                      style={{
                        background: "#38bdf8",
                        boxShadow: "0 0 6px rgba(56,189,248,0.6)",
                      }}
                    />
                    <span
                      className="text-[10px] font-mono uppercase tracking-widest"
                      style={{ color: "rgba(56,189,248,0.5)" }}
                    >
                      Live
                    </span>
                  </>
                )}
              </div>

              {isHistory && historySession?.summary ? (
                <span
                  className="text-[10px] font-mono max-w-[300px] truncate"
                  style={{ color: "rgba(56,189,248,0.25)" }}
                  title={historySession.summary}
                >
                  {historySession.summary}
                </span>
              ) : (
                !isHistory && (
                  <span className="text-[10px] font-mono" style={{ color: "rgba(56,189,248,0.25)" }}>
                    {new Date().toLocaleDateString([], {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
