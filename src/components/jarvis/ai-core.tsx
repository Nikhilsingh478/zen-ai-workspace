/**
 * JARVIS AI Core — the animated holographic centerpiece.
 * Concentric rings, radar sweep, pulse system, reactive glow.
 */

import { motion, AnimatePresence } from "framer-motion";
import type { JarvisVoiceState } from "@/lib/jarvis";

// ─── Keyframe injection ───────────────────────────────────────────────────────

const KEYFRAMES = `
@keyframes jarvis-cw   { from { transform: rotate(0deg);    } to { transform: rotate(360deg);  } }
@keyframes jarvis-ccw  { from { transform: rotate(0deg);    } to { transform: rotate(-360deg); } }
@keyframes jarvis-sweep { from { transform: rotate(-90deg); } to { transform: rotate(270deg);  } }
@keyframes jarvis-pulse-out {
  0%   { transform: scale(1);   opacity: 0.7; }
  100% { transform: scale(2.4); opacity: 0;   }
}
@keyframes jarvis-orb-breathe {
  0%, 100% { box-shadow: 0 0 30px 6px rgba(0,191,255,0.35), 0 0 80px 16px rgba(0,191,255,0.12); }
  50%       { box-shadow: 0 0 50px 12px rgba(0,191,255,0.55), 0 0 120px 28px rgba(0,191,255,0.2); }
}
@keyframes jarvis-waveform {
  0%, 100% { transform: scaleY(0.3); }
  50%       { transform: scaleY(1);   }
}
`;

function InjectKeyframes() {
  return <style>{KEYFRAMES}</style>;
}

// ─── Ring config ──────────────────────────────────────────────────────────────

const RINGS = [
  { size: "94%", duration: "11s",  dir: "jarvis-cw",  opacity: 0.60, dashed: false, strokeW: 1.5 },
  { size: "82%", duration: "17s",  dir: "jarvis-ccw", opacity: 0.45, dashed: true,  strokeW: 1   },
  { size: "68%", duration: "24s",  dir: "jarvis-cw",  opacity: 0.38, dashed: false, strokeW: 1   },
  { size: "54%", duration: "32s",  dir: "jarvis-ccw", opacity: 0.30, dashed: true,  strokeW: 0.8 },
  { size: "40%", duration: "9s",   dir: "jarvis-cw",  opacity: 0.50, dashed: false, strokeW: 1   },
];

// ─── Waveform bars ────────────────────────────────────────────────────────────

function Waveform({ active }: { active: boolean }) {
  const bars = [0.35, 0.6, 0.9, 0.7, 1, 0.75, 0.5, 0.85, 0.65, 0.4, 0.55, 0.8, 0.45];
  return (
    <div className="flex items-center gap-[3px]" style={{ height: 32 }}>
      {bars.map((base, i) => (
        <motion.div
          key={i}
          style={{ width: 3, height: "100%", borderRadius: 2, background: "#00BFFF", originY: "center" }}
          animate={active
            ? { scaleY: [base, base * 1.8 + 0.1, base * 0.4, base * 1.5, base], opacity: [0.7, 1, 0.6, 1, 0.7] }
            : { scaleY: 0.15, opacity: 0.3 }}
          transition={active
            ? { duration: 0.6 + i * 0.07, repeat: Infinity, repeatType: "mirror", ease: "easeInOut", delay: i * 0.05 }
            : { duration: 0.3 }}
        />
      ))}
    </div>
  );
}

// ─── Processing dots ──────────────────────────────────────────────────────────

function ProcessingDots() {
  return (
    <div className="flex gap-2 items-center">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          style={{ width: 6, height: 6, borderRadius: "50%", background: "#00BFFF" }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.25, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// ─── Main AI Core ─────────────────────────────────────────────────────────────

interface AICoreProps {
  voiceState: JarvisVoiceState;
  isAwake: boolean;
  size?: number;
}

export function AICore({ voiceState, isAwake, size = 360 }: AICoreProps) {
  const isListening  = voiceState === "listening";
  const isProcessing = voiceState === "processing";
  const isSpeaking   = voiceState === "speaking";
  const isActive     = isAwake || isListening || isProcessing || isSpeaking;

  const ringSpeedMultiplier = isActive ? 0.55 : 1;

  return (
    <div className="relative flex items-center justify-center select-none" style={{ width: size, height: size }}>
      <InjectKeyframes />

      {/* ── Outer ambient glow ── */}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        animate={{ opacity: isActive ? 1 : 0.4 }}
        transition={{ duration: 0.8 }}
        style={{ background: "radial-gradient(circle, rgba(0,191,255,0.08) 0%, transparent 70%)" }}
      />

      {/* ── Rotating rings ── */}
      {RINGS.map((ring, idx) => (
        <div
          key={idx}
          className="absolute rounded-full"
          style={{
            width: ring.size, height: ring.size,
            border: `${ring.strokeW}px ${ring.dashed ? "dashed" : "solid"} rgba(0,191,255,${ring.opacity})`,
            animation: `${ring.dir} ${parseFloat(ring.duration) * ringSpeedMultiplier}s linear infinite`,
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            boxShadow: isActive ? `0 0 8px rgba(0,191,255,0.15)` : "none",
          }}
        />
      ))}

      {/* ── Radar sweep ── */}
      <div
        className="absolute rounded-full overflow-hidden"
        style={{ width: "82%", height: "82%", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
      >
        <div
          style={{
            position: "absolute", inset: 0,
            background: "conic-gradient(from 0deg, transparent 0deg, rgba(0,191,255,0.12) 30deg, transparent 60deg)",
            animation: `jarvis-sweep ${isActive ? "3s" : "5s"} linear infinite`,
            transformOrigin: "center",
          }}
        />
      </div>

      {/* ── Pulse rings ── */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute rounded-full border"
          style={{
            width: "36%", height: "36%",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            borderColor: "rgba(0,191,255,0.4)",
            animation: `jarvis-pulse-out ${isActive ? 1.8 + i * 0.7 : 3.2 + i * 1.1}s ease-out ${i * (isActive ? 0.6 : 1.0)}s infinite`,
          }}
        />
      ))}

      {/* ── Center orb ── */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: "22%", height: "22%",
          top: "50%", left: "50%",
          background: "radial-gradient(circle at 35% 35%, #4DEBFF, #00BFFF 50%, #003060)",
          animation: "jarvis-orb-breathe 3s ease-in-out infinite",
        }}
        animate={{ scale: isListening ? 1.12 : isProcessing ? [1, 1.06, 1] : 1 }}
        transition={{
          scale: isProcessing
            ? { duration: 0.5, repeat: Infinity, repeatType: "mirror" }
            : { type: "spring", stiffness: 200, damping: 20 },
        }}
        initial={false}
      >
        {/* Inner highlight */}
        <div
          className="absolute rounded-full"
          style={{
            width: "40%", height: "40%",
            top: "18%", left: "20%",
            background: "radial-gradient(circle, rgba(255,255,255,0.6), transparent)",
          }}
        />
      </motion.div>

      {/* ── Cross-hair lines ── */}
      <div className="absolute" style={{ width: "60%", height: 1, top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(0,191,255,0.08)" }} />
      <div className="absolute" style={{ height: "60%", width: 1, top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(0,191,255,0.08)" }} />

      {/* ── Corner HUD brackets ── */}
      {[["top-[8%] left-[8%]", "border-t border-l"], ["top-[8%] right-[8%]", "border-t border-r"], ["bottom-[8%] left-[8%]", "border-b border-l"], ["bottom-[8%] right-[8%]", "border-b border-r"]].map(([pos, border], i) => (
        <div
          key={i}
          className={`absolute ${pos} ${border} w-4 h-4`}
          style={{ borderColor: "rgba(0,191,255,0.35)" }}
        />
      ))}

      {/* ── State overlay ── */}
      <div className="absolute" style={{ bottom: "14%", width: "100%", display: "flex", justifyContent: "center" }}>
        <AnimatePresence mode="wait">
          {isSpeaking && (
            <motion.div key="wave" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.2 }}>
              <Waveform active />
            </motion.div>
          )}
          {isProcessing && (
            <motion.div key="dots" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.2 }}>
              <ProcessingDots />
            </motion.div>
          )}
          {isListening && (
            <motion.div key="listening" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Waveform active={false} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
