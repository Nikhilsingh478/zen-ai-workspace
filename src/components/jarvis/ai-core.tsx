/**
 * JARVIS AI Core — Complete SVG rewrite.
 *
 * Using SVG guarantees perfect centering — no more misaligned circles.
 * Design: elegant arc-based holographic interface with reactive animations.
 */

import { motion, AnimatePresence } from "framer-motion";
import type { JarvisVoiceState } from "@/lib/jarvis";

const STYLES = `
@keyframes jv-orb-breathe {
  0%,100% { filter: drop-shadow(0 0 8px rgba(14,165,233,0.55)) drop-shadow(0 0 20px rgba(14,165,233,0.25)); }
  50%      { filter: drop-shadow(0 0 16px rgba(56,189,248,0.75)) drop-shadow(0 0 40px rgba(56,189,248,0.35)); }
}
.jv-orb { animation: jv-orb-breathe 3s ease-in-out infinite; }
`;

function Waveform({ active }: { active: boolean }) {
  const bars = [0.4, 0.65, 0.9, 0.7, 1, 0.75, 0.5, 0.8, 0.6];
  return (
    <div className="flex items-center gap-[3px]" style={{ height: 26 }}>
      {bars.map((base, i) => (
        <motion.div
          key={i}
          style={{ width: 2.5, height: "100%", borderRadius: 2, background: "#38BDF8", originY: "center" }}
          animate={active
            ? { scaleY: [base, base * 1.7, base * 0.4, base * 1.4, base], opacity: [0.6, 1, 0.5, 1, 0.6] }
            : { scaleY: 0.15, opacity: 0.3 }}
          transition={active
            ? { duration: 0.55 + i * 0.06, repeat: Infinity, repeatType: "mirror", ease: "easeInOut", delay: i * 0.04 }
            : { duration: 0.3 }}
        />
      ))}
    </div>
  );
}

function ProcessingDots() {
  return (
    <div className="flex gap-2 items-center">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          style={{ width: 5, height: 5, borderRadius: "50%", background: "#38BDF8" }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.3, 0.8] }}
          transition={{ duration: 0.85, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

interface AICoreProps {
  voiceState: JarvisVoiceState;
  isAwake: boolean;
  size?: number;
}

export function AICore({ voiceState, isAwake, size = 300 }: AICoreProps) {
  const isListening  = voiceState === "listening";
  const isProcessing = voiceState === "processing";
  const isSpeaking   = voiceState === "speaking";
  const isActive     = isAwake || isListening || isProcessing || isSpeaking;
  const speed        = isActive ? 0.5 : 1;

  // Arc stroke-dasharray calculations (circumference = 2πr)
  // Arc 1: r=80, 300° arc  → dasharray = "419 84"  (502*300/360=419, gap=84)
  // Arc 2: r=62, 240° arc  → dasharray = "259 130"  (389*240/360=259)
  // Arc 3: r=44, 200° arc  → dasharray = "153 124"  (277*200/360=153)
  const bracket = `rgba(14,165,233,${isActive ? 0.45 : 0.2})`;

  return (
    <div className="select-none" style={{ width: size, height: size, position: "relative" }}>
      <style>{STYLES}</style>

      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        style={{ overflow: "visible" }}
      >
        <defs>
          {/* Orb gradient */}
          <radialGradient id="jv-orb-grad" cx="38%" cy="32%" r="65%">
            <stop offset="0%"   stopColor="#BAE6FD" />
            <stop offset="45%"  stopColor="#0EA5E9" />
            <stop offset="100%" stopColor="#0369A1" />
          </radialGradient>

          {/* Ambient glow fill */}
          <radialGradient id="jv-glow-fill" cx="50%" cy="50%">
            <stop offset="0%"   stopColor="rgba(14,165,233,0.18)" />
            <stop offset="60%"  stopColor="rgba(14,165,233,0.04)" />
            <stop offset="100%" stopColor="rgba(14,165,233,0)"    stopOpacity="0" />
          </radialGradient>

          {/* Blurred glow behind orb */}
          <filter id="jv-orb-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── Ambient glow ── */}
        <motion.circle
          cx="100" cy="100" r="96"
          fill="url(#jv-glow-fill)"
          animate={{ opacity: isActive ? 1 : 0.45 }}
          transition={{ duration: 0.8 }}
        />

        {/* ── Arc 1 — outer, clockwise, 300° ── */}
        <motion.g
          style={{ originX: "100px", originY: "100px" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 14 * speed, repeat: Infinity, ease: "linear" }}
        >
          <circle
            cx="100" cy="100" r="80"
            fill="none"
            stroke={`rgba(14,165,233,${isActive ? 0.45 : 0.28})`}
            strokeWidth="1.3"
            strokeDasharray="419 84"
            strokeLinecap="round"
            style={{ transition: "stroke 0.6s" }}
          />
        </motion.g>

        {/* ── Arc 2 — middle, counter-clockwise, 240° ── */}
        <motion.g
          style={{ originX: "100px", originY: "100px" }}
          animate={{ rotate: -360 }}
          transition={{ duration: 20 * speed, repeat: Infinity, ease: "linear" }}
        >
          <circle
            cx="100" cy="100" r="62"
            fill="none"
            stroke={`rgba(56,189,248,${isActive ? 0.32 : 0.18})`}
            strokeWidth="0.9"
            strokeDasharray="259 130"
            strokeLinecap="round"
            style={{ transition: "stroke 0.6s" }}
          />
        </motion.g>

        {/* ── Arc 3 — inner, clockwise, dotted, 200° ── */}
        <motion.g
          style={{ originX: "100px", originY: "100px" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 28 * speed, repeat: Infinity, ease: "linear" }}
        >
          <circle
            cx="100" cy="100" r="44"
            fill="none"
            stroke={`rgba(14,165,233,${isActive ? 0.28 : 0.14})`}
            strokeWidth="0.7"
            strokeDasharray="8 8"
            strokeLinecap="round"
            style={{ transition: "stroke 0.6s" }}
          />
        </motion.g>

        {/* ── Radar sweep ── */}
        <motion.g
          style={{ originX: "100px", originY: "100px" }}
          animate={{ rotate: 360 }}
          transition={{ duration: (isActive ? 3 : 5.5), repeat: Infinity, ease: "linear" }}
        >
          {/* Wedge: 30° sweep */}
          <path
            d="M 100 100 L 100 18 A 82 82 0 0 1 141 29 Z"
            fill={`rgba(56,189,248,${isActive ? 0.09 : 0.04})`}
            style={{ transition: "fill 0.6s" }}
          />
        </motion.g>

        {/* ── Pulse ring ── */}
        <motion.circle
          cx="100" cy="100" r="30"
          fill="none"
          stroke="rgba(56,189,248,0.5)"
          strokeWidth="0.8"
          animate={isActive
            ? { r: [30, 70], opacity: [0.5, 0], strokeWidth: [1, 0.3] }
            : { r: [30, 55], opacity: [0.25, 0], strokeWidth: [0.8, 0.2] }}
          transition={{ duration: isActive ? 2 : 3.5, repeat: Infinity, ease: "easeOut", delay: 0 }}
        />
        <motion.circle
          cx="100" cy="100" r="30"
          fill="none"
          stroke="rgba(14,165,233,0.4)"
          strokeWidth="0.6"
          animate={isActive
            ? { r: [30, 70], opacity: [0.4, 0], strokeWidth: [0.8, 0.2] }
            : { r: [30, 55], opacity: [0.2, 0], strokeWidth: [0.6, 0.1] }}
          transition={{ duration: isActive ? 2 : 3.5, repeat: Infinity, ease: "easeOut", delay: isActive ? 1 : 1.75 }}
        />

        {/* ── Orb glow (blurred copy) ── */}
        <circle cx="100" cy="100" r="22" fill="rgba(14,165,233,0.5)" filter="url(#jv-orb-glow)" />

        {/* ── Centre orb ── */}
        <motion.circle
          cx="100" cy="100"
          fill="url(#jv-orb-grad)"
          filter="url(#jv-orb-glow)"
          className="jv-orb"
          animate={{
            r: isListening ? 24 : isProcessing ? [22, 23.5, 22] : 22,
          }}
          transition={isProcessing
            ? { duration: 0.45, repeat: Infinity, repeatType: "mirror" }
            : { type: "spring", stiffness: 200, damping: 20 }}
        />

        {/* Highlight */}
        <circle cx="93" cy="91" r="7"  fill="rgba(255,255,255,0.5)"  />
        <circle cx="91" cy="89" r="3"  fill="rgba(255,255,255,0.75)" />

        {/* ── HUD corner brackets ── */}
        <path d="M22 32 L22 22 L32 22" fill="none" stroke={bracket} strokeWidth="1.2" strokeLinecap="round" />
        <path d="M178 32 L178 22 L168 22" fill="none" stroke={bracket} strokeWidth="1.2" strokeLinecap="round" />
        <path d="M22 168 L22 178 L32 178" fill="none" stroke={bracket} strokeWidth="1.2" strokeLinecap="round" />
        <path d="M178 168 L178 178 L168 178" fill="none" stroke={bracket} strokeWidth="1.2" strokeLinecap="round" />
      </svg>

      {/* ── State overlay (HTML, below orb) ── */}
      <div style={{ position: "absolute", bottom: "11%", width: "100%", display: "flex", justifyContent: "center" }}>
        <AnimatePresence mode="wait">
          {isSpeaking && (
            <motion.div key="wave"
              initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }} transition={{ duration: 0.18 }}>
              <Waveform active />
            </motion.div>
          )}
          {isProcessing && (
            <motion.div key="dots"
              initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }} transition={{ duration: 0.18 }}>
              <ProcessingDots />
            </motion.div>
          )}
          {isListening && !isSpeaking && (
            <motion.div key="listen"
              initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }} transition={{ duration: 0.18 }}>
              <div className="flex items-center gap-1.5">
                <motion.div
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: "#10B981" }}
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                <span style={{ fontSize: 10, color: "rgba(56,189,248,0.65)", letterSpacing: "0.15em", fontFamily: "monospace" }}>
                  LISTENING
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}