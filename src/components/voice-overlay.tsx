/**
 * VoiceOverlay — premium floating voice assistant UI.
 * Renders as a small pill anchored to the bottom-right corner.
 * Expands into a settings panel on demand.
 */

import { AnimatePresence, motion } from "framer-motion";
import {
  Mic,
  MicOff,
  Settings2,
  X,
  Volume2,
  VolumeX,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import {
  getVoiceSettings,
  setVoiceSettings,
  subscribeVoiceSettings,
  type WakeWord,
} from "@/lib/voice-settings";
import {
  useVoiceAssistant,
  isVoiceAssistantSupported,
  type AssistantState,
} from "@/hooks/use-voice-assistant";

// Suppress unused import warning — Settings2 kept for future use
void Settings2;

// ─── Waveform bars ────────────────────────────────────────────────────────────

function Waveform({ active }: { active: boolean }) {
  const bars = [0.4, 0.7, 1, 0.65, 0.45, 0.8, 0.5];
  return (
    <div className="flex items-center gap-[2px] h-4">
      {bars.map((base, i) => (
        <motion.div
          key={i}
          className="w-[2px] rounded-full bg-white/70"
          animate={
            active
              ? {
                  scaleY: [base, base * 1.6, base],
                  opacity: [0.5, 0.9, 0.5],
                }
              : { scaleY: 0.2, opacity: 0.2 }
          }
          transition={
            active
              ? {
                  duration: 0.55 + i * 0.07,
                  repeat: Infinity,
                  repeatType: "mirror",
                  ease: "easeInOut",
                  delay: i * 0.06,
                }
              : { duration: 0.25 }
          }
          style={{ height: "100%", originY: "center" }}
        />
      ))}
    </div>
  );
}

// ─── Passive glow pulse ───────────────────────────────────────────────────────

function PassivePulse() {
  return (
    <motion.div
      className="absolute inset-0 rounded-full bg-white/10"
      animate={{ scale: [1, 1.35, 1], opacity: [0.12, 0, 0.12] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// ─── State dot ────────────────────────────────────────────────────────────────

function StateDot({ state }: { state: AssistantState }) {
  const color = {
    idle: "bg-white/20",
    passive: "bg-white/40",
    active: "bg-white/90",
    processing: "bg-white/70",
    speaking: "bg-white/80",
    error: "bg-red-400/70",
  }[state];

  return (
    <motion.div
      className={cn("h-1.5 w-1.5 rounded-full shrink-0", color)}
      animate={
        state === "passive"
          ? { opacity: [0.35, 0.85, 0.35] }
          : state === "active" || state === "speaking"
            ? { scale: [1, 1.3, 1], opacity: [0.65, 1, 0.65] }
            : {}
      }
      transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// ─── State label ──────────────────────────────────────────────────────────────

const STATE_LABELS: Record<AssistantState, string> = {
  idle: "Off",
  passive: "Listening…",
  active: "Speak now",
  processing: "Thinking…",
  speaking: "Speaking…",
  error: "Unavailable",
};

// ─── Settings panel ───────────────────────────────────────────────────────────

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const settings = useSyncExternalStore(
    subscribeVoiceSettings,
    getVoiceSettings,
    getVoiceSettings,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="absolute bottom-full right-0 mb-3 w-[260px] rounded-2xl border border-white/[0.09] bg-[var(--surface-1)] shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <span className="text-[13px] font-semibold text-foreground/90">Jarvis Settings</span>
        <button
          onClick={onClose}
          className="h-6 w-6 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Enable toggle */}
        <SettingRow
          label="Enable Jarvis"
          value={settings.enabled}
          onChange={(v) => setVoiceSettings({ enabled: v })}
        />

        {/* Auto-start toggle */}
        <SettingRow
          label="Auto-start on open"
          value={settings.autoStart}
          onChange={(v) => setVoiceSettings({ autoStart: v })}
          disabled={!settings.enabled}
        />

        {/* Voice responses toggle */}
        <SettingRow
          label="Voice responses"
          value={settings.voiceResponses}
          onChange={(v) => setVoiceSettings({ voiceResponses: v })}
          disabled={!settings.enabled}
          icon={settings.voiceResponses ? Volume2 : VolumeX}
        />

        {/* Wake word selector */}
        <div className="space-y-1">
          <p className="text-[11px] text-white/35 uppercase tracking-wider">Wake word</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(["jarvis", "hey jarvis"] as WakeWord[]).map((ww) => (
              <button
                key={ww}
                onClick={() => setVoiceSettings({ wakeWord: ww })}
                disabled={!settings.enabled}
                className={cn(
                  "px-3 py-2 rounded-xl text-[12px] font-medium border transition-all duration-150",
                  settings.wakeWord === ww
                    ? "border-white/20 bg-white/[0.1] text-white/90"
                    : "border-white/[0.06] bg-white/[0.03] text-white/35 hover:text-white/60 hover:border-white/10",
                  !settings.enabled && "opacity-40 cursor-not-allowed",
                )}
              >
                {ww === "jarvis" ? '"Jarvis"' : '"Hey Jarvis"'}
              </button>
            ))}
          </div>
        </div>

        {/* Silence tolerance note */}
        <div className="pt-1 border-t border-white/[0.05] space-y-1">
          <p className="text-[11px] text-white/30 leading-relaxed">
            Jarvis waits 3.5 seconds of silence before processing your command — allowing natural pauses.
          </p>
        </div>

        {/* Status row */}
        <div className="flex items-center justify-between pt-1 border-t border-white/[0.05]">
          <span className="text-[11px] text-white/30">Status</span>
          <span className="text-[11px] text-white/50">
            {!isVoiceAssistantSupported ? "Browser unsupported" : "—"}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function SettingRow({
  label,
  value,
  onChange,
  disabled = false,
  icon: Icon,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        disabled && "opacity-40 pointer-events-none",
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {Icon && <Icon className="h-3.5 w-3.5 text-white/40 shrink-0" />}
        <span className="text-[13px] text-white/70 truncate">{label}</span>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={cn(
          "relative h-5 w-9 rounded-full border transition-colors duration-200 shrink-0",
          value
            ? "bg-white/20 border-white/30"
            : "bg-white/[0.04] border-white/[0.08]",
        )}
        aria-checked={value}
        role="switch"
      >
        <motion.div
          className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white"
          animate={{ x: value ? 16 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  );
}

// ─── First-time enable prompt ─────────────────────────────────────────────────

function EnablePrompt({
  onEnable,
  onDismiss,
}: {
  onEnable: () => void;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="absolute bottom-full right-0 mb-3 w-[260px] rounded-2xl border border-white/[0.09] bg-[var(--surface-1)] shadow-[0_20px_60px_rgba(0,0,0,0.6)] p-4"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[13px] font-semibold text-foreground/90">Enable Jarvis</p>
        <button
          onClick={onDismiss}
          className="h-5 w-5 rounded-md flex items-center justify-center text-white/25 hover:text-white/50 transition-colors shrink-0 mt-0.5"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <p className="text-[12px] text-white/45 leading-relaxed mb-3">
        Jarvis listens for your wake word and responds to voice commands — including creating real
        Horizon tasks from natural speech. Microphone is only active while the app is open.
      </p>
      <div className="flex gap-2">
        <button
          onClick={onEnable}
          className="flex-1 h-8 rounded-xl bg-white text-background text-[12px] font-semibold hover:bg-white/90 transition-colors"
        >
          Enable & Allow Mic
        </button>
        <button
          onClick={onDismiss}
          className="h-8 px-3 rounded-xl border border-white/[0.08] text-[12px] text-white/40 hover:text-white/60 hover:border-white/[0.14] transition-colors"
        >
          Later
        </button>
      </div>
    </motion.div>
  );
}

// ─── Response card ────────────────────────────────────────────────────────────

function ResponseCard({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDismiss, 8000);
    return () => clearTimeout(id);
  }, [onDismiss, text]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.98 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="absolute bottom-full right-0 mb-3 w-[280px] rounded-2xl border border-white/[0.09] bg-[var(--surface-1)] shadow-[0_16px_50px_rgba(0,0,0,0.55)] p-4"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-white/50" />
          <span className="text-[11px] text-white/35 uppercase tracking-wider">Jarvis</span>
        </div>
        <button
          onClick={onDismiss}
          className="h-4 w-4 flex items-center justify-center text-white/20 hover:text-white/40 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <p className="text-[13px] text-white/80 leading-relaxed">{text}</p>
    </motion.div>
  );
}

// ─── Transcript strip ─────────────────────────────────────────────────────────

function TranscriptStrip({ transcript }: { transcript: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 2 }}
      transition={{ duration: 0.18 }}
      className="absolute bottom-full right-0 mb-2 max-w-[260px] px-3 py-2 rounded-xl bg-[var(--surface-2)] border border-white/[0.07] shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
    >
      <p className="text-[12px] text-white/70 leading-relaxed break-words">
        {transcript}
      </p>
    </motion.div>
  );
}

// ─── Main overlay ─────────────────────────────────────────────────────────────

export function VoiceOverlay() {
  const settings = useSyncExternalStore(
    subscribeVoiceSettings,
    getVoiceSettings,
    getVoiceSettings,
  );

  const { state, permission, transcript, lastResponse, enable, disable, dismiss } =
    useVoiceAssistant();

  const [showSettings, setShowSettings] = useState(false);
  const [showEnablePrompt, setShowEnablePrompt] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const prevResponseRef = useRef("");

  // Show response card when lastResponse changes
  useEffect(() => {
    if (lastResponse && lastResponse !== prevResponseRef.current) {
      prevResponseRef.current = lastResponse;
      setShowResponse(true);
    }
  }, [lastResponse]);

  // Sync enabled setting with assistant state
  useEffect(() => {
    if (settings.enabled && state === "idle" && permission === "granted") {
      enable();
    } else if (!settings.enabled && state !== "idle") {
      disable();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.enabled]);

  const handlePillClick = () => {
    if (state === "error") return;
    if (!settings.enabled) {
      setShowSettings(false);
      setShowEnablePrompt((p) => !p);
      return;
    }
    if (state === "active" || state === "speaking") {
      dismiss();
      return;
    }
    setShowEnablePrompt(false);
    setShowSettings((p) => !p);
  };

  const handleEnable = async () => {
    setVoiceSettings({ enabled: true });
    setShowEnablePrompt(false);
    await enable();
  };

  const isActive = state === "active" || state === "speaking";
  const isProcessing = state === "processing";
  const isPassive = state === "passive";

  if (!isVoiceAssistantSupported && !settings.enabled) return null;

  return (
    <div
      className="fixed bottom-[88px] right-4 z-[60] md:bottom-6 md:right-6 flex flex-col items-end"
      style={{ pointerEvents: "none" }}
    >
      <div style={{ pointerEvents: "auto" }} className="relative">
        {/* Settings / Enable panels */}
        <AnimatePresence mode="wait">
          {showEnablePrompt && (
            <EnablePrompt
              key="enable-prompt"
              onEnable={handleEnable}
              onDismiss={() => setShowEnablePrompt(false)}
            />
          )}
          {showSettings && settings.enabled && (
            <SettingsPanel key="settings" onClose={() => setShowSettings(false)} />
          )}
          {showResponse && !showSettings && settings.enabled && lastResponse && (
            <ResponseCard
              key={lastResponse}
              text={lastResponse}
              onDismiss={() => setShowResponse(false)}
            />
          )}
        </AnimatePresence>

        {/* Transcript strip — shown while active or processing */}
        <AnimatePresence>
          {(state === "active" || state === "processing") && transcript && (
            <TranscriptStrip key="transcript" transcript={transcript} />
          )}
        </AnimatePresence>

        {/* Ambient glow ring (active state) */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-[-8px] rounded-full"
              style={{ boxShadow: "0 0 28px rgba(255,255,255,0.12)" }}
            />
          )}
        </AnimatePresence>

        {/* Main pill */}
        <motion.button
          onClick={handlePillClick}
          whileHover={{ scale: state === "error" ? 1 : 1.05 }}
          whileTap={{ scale: state === "error" ? 1 : 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className={cn(
            "relative flex items-center gap-2 rounded-full border px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.4)] transition-colors duration-200",
            isActive
              ? "bg-white/[0.12] border-white/25"
              : isPassive
                ? "bg-white/[0.05] border-white/[0.1]"
                : state === "error"
                  ? "bg-white/[0.03] border-red-400/20 cursor-default"
                  : "bg-white/[0.04] border-white/[0.08]",
            !settings.enabled && "opacity-60",
          )}
          aria-label="Jarvis voice assistant"
        >
          {/* Passive glow pulse */}
          {isPassive && <PassivePulse />}

          {/* Icon / waveform */}
          <div className="relative h-5 w-5 flex items-center justify-center">
            <AnimatePresence mode="wait">
              {isProcessing ? (
                <motion.div
                  key="loader"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.15 }}
                >
                  <Loader2 className="h-4 w-4 text-white/60 animate-spin" />
                </motion.div>
              ) : isActive ? (
                <motion.div
                  key="wave"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Waveform active />
                </motion.div>
              ) : state === "error" ? (
                <motion.div key="off" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <MicOff className="h-4 w-4 text-red-400/60" />
                </motion.div>
              ) : (
                <motion.div
                  key="mic"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                >
                  <Mic
                    className={cn(
                      "h-4 w-4 transition-colors",
                      isPassive ? "text-white/60" : "text-white/30",
                    )}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* State dot */}
          <StateDot state={state} />

          {/* Label (only in non-idle states or when settings open) */}
          <AnimatePresence>
            {(state !== "idle" || showSettings) && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="text-[11px] text-white/50 font-medium whitespace-nowrap overflow-hidden"
              >
                {STATE_LABELS[state]}
              </motion.span>
            )}
          </AnimatePresence>

          {/* Settings chevron */}
          {settings.enabled && state !== "error" && (
            <motion.div
              animate={{ rotate: showSettings ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-3 w-3 text-white/20" />
            </motion.div>
          )}
        </motion.button>
      </div>
    </div>
  );
}
