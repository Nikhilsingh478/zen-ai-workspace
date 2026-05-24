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
    <div className="flex items-center justify-between px-5 py-3.5
                    border-b border-zinc-800/60 flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
        </div>
        <div className="w-px h-3.5 bg-zinc-800" />
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em]">
          {isHistory ? "Past Session" : "J.A.R.V.I.S"}
        </span>
        {isHistory && sessionDate && (
          <span className="text-[10px] text-zinc-700 font-mono">
            {sessionDate.toLocaleDateString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
        <span className="text-[10px] text-zinc-700 font-mono">
          {messageCount} messages
        </span>
      </div>

      <div className="flex items-center gap-1">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onToggleFullscreen}
          className="w-7 h-7 rounded-md flex items-center justify-center
                     text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/60
                     transition-colors duration-150"
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
          className="w-7 h-7 rounded-md flex items-center justify-center
                     text-zinc-600 hover:text-red-400 hover:bg-red-950/30
                     transition-colors duration-150"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </motion.button>
      </div>
    </div>
  );
}

// ─── Copy action (inside window, live mode only) ──────────────────────────────

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
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md
                 text-[10px] text-zinc-600 hover:text-zinc-300
                 hover:bg-zinc-800/60 transition-all duration-150
                 opacity-0 group-hover:opacity-100"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-emerald-400" />
          <span className="text-emerald-400">Copied</span>
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
          <div className="bg-zinc-800/70 border border-zinc-700/40
                          rounded-2xl rounded-br-sm px-4 py-3">
            <p className="text-sm text-zinc-200 leading-relaxed">
              {message.content}
            </p>
          </div>
          <p className="text-[10px] text-zinc-600 text-right mt-1 pr-1">
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
      <div className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-700/60
                      flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-[9px] font-mono text-zinc-400 font-bold">J</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="bg-zinc-900/60 border border-zinc-800/40
                        rounded-2xl rounded-tl-sm px-5 py-4">
          <div className="prose prose-invert prose-sm max-w-none
                          prose-p:text-zinc-200 prose-p:leading-relaxed
                          prose-headings:text-zinc-100 prose-headings:font-semibold
                          prose-strong:text-zinc-100
                          prose-code:text-sky-400 prose-code:bg-zinc-800/80
                          prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                          prose-code:text-xs prose-code:font-mono
                          prose-pre:bg-zinc-900 prose-pre:border
                          prose-pre:border-zinc-700/50 prose-pre:rounded-xl
                          prose-li:text-zinc-300 prose-li:marker:text-zinc-600
                          prose-a:text-sky-400 prose-a:no-underline
                          hover:prose-a:underline">
            <Markdown>{message.content}</Markdown>
          </div>
        </div>

        <div className="flex items-center justify-between mt-1.5 px-1">
          <p className="text-[10px] text-zinc-600">{formattedTime}</p>
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

const windowedStyle: React.CSSProperties = {
  bottom: 24,
  right: 24,
  width: 680,
  height: 520,
  borderRadius: 16,
};

const fullscreenStyle: React.CSSProperties = {
  top: 16,
  bottom: 16,
  right: 16,
  left: 16,
  borderRadius: 20,
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

  // Auto-scroll to bottom — live mode only
  useEffect(() => {
    if (isHistory) return;
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isHistory]);

  // Reset fullscreen when window closes
  useEffect(() => {
    if (!isOpen) setIsFullscreen(false);
  }, [isOpen]);

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const visibleMessages = messages.filter(
    (m) => m.type !== "interrupted",
  );

  const displayedMessageCount = isHistory
    ? visibleMessages.length
    : messages.filter((m) => m.role === "jarvis").length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key={`extended-window-backdrop-${mode}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
            onClick={onClose}
          />

          <motion.div
            key={`extended-window-${mode}`}
            layout
            variants={windowEnterExit}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed z-50 flex flex-col
                       bg-[#0d0d0d] border border-zinc-800/60
                       shadow-2xl shadow-black/60 overflow-hidden"
            style={{
              transition: "top 0.35s cubic-bezier(0.33,1,0.68,1), bottom 0.35s cubic-bezier(0.33,1,0.68,1), left 0.35s cubic-bezier(0.33,1,0.68,1), right 0.35s cubic-bezier(0.33,1,0.68,1), width 0.35s cubic-bezier(0.33,1,0.68,1), height 0.35s cubic-bezier(0.33,1,0.68,1), border-radius 0.35s cubic-bezier(0.33,1,0.68,1)",
              ...(isFullscreen ? fullscreenStyle : windowedStyle),
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-px
                            bg-gradient-to-r from-transparent
                            via-sky-500/20 to-transparent" />

            <WindowHeader
              isFullscreen={isFullscreen}
              onToggleFullscreen={handleToggleFullscreen}
              onClose={onClose}
              messageCount={displayedMessageCount}
              mode={mode}
              sessionDate={historySession?.startedAt}
            />

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-5 py-4
                         scrollbar-thin scrollbar-track-transparent
                         scrollbar-thumb-zinc-800 hover:scrollbar-thumb-zinc-700"
            >
              {visibleMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800
                                  flex items-center justify-center">
                    <span className="text-zinc-600 text-xs font-mono">J</span>
                  </div>
                  <p className="text-zinc-600 text-sm font-mono text-center">
                    {isHistory
                      ? "No messages saved for this session"
                      : "Start talking to JARVIS"
                    }
                  </p>
                  {isHistory && (
                    <p className="text-zinc-700 text-xs text-center max-w-48">
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

            <div className="flex items-center justify-between
                            px-5 py-2.5 border-t border-zinc-800/40
                            flex-shrink-0">
              <div className="flex items-center gap-2">
                {isHistory ? (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                    <span className="text-[10px] font-mono text-zinc-600
                                     uppercase tracking-widest">
                      Read-only
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/60
                                    animate-pulse" />
                    <span className="text-[10px] font-mono text-zinc-600
                                     uppercase tracking-widest">
                      Live
                    </span>
                  </>
                )}
              </div>

              {isHistory && historySession?.summary ? (
                <span
                  className="text-[10px] text-zinc-700 font-mono max-w-[300px] truncate"
                  title={historySession.summary}
                >
                  {historySession.summary}
                </span>
              ) : (
                !isHistory && (
                  <span className="text-[10px] text-zinc-700 font-mono">
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
