/**
 * JARVIS AI Core — award-level redesign.
 *
 * Design principles:
 *  - One primary visual element at a time. Restraint, not quantity.
 *  - All animation durations are long and intentional (4–20s ambient).
 *  - Easing is always organic — never linear except single slow orbits.
 *  - The orb does the heavy lifting. Everything else is atmosphere.
 *
 * Layer order (bottom → top):
 *  AmbientField → PulseRings → OrbitRing → OrbBloom → Orb → HUDBrackets → StatusLabel
 */

import { motion, AnimatePresence } from "framer-motion";
import type { JarvisVoiceState } from "@/lib/jarvis";

// ─── Shared constants ─────────────────────────────────────────────────────────

const CX = 100;
const CY = 100;

// Arctic-blue palette — used consistently across all layers
const SKY  = "rgba(125,211,252,";   // #7DD3FC
const BLUE = "rgba(147,197,253,";   // #93C5FD
const ICE  = "rgba(186,230,253,";   // #BAE6FD

// Premium easing curves
const EASE_OUT_QUART = [0.25, 0.46, 0.45, 0.94] as const;
const EASE_IN_OUT    = [0.45, 0.05, 0.55, 0.95] as const;

// ─── Waveform (speaking indicator) ───────────────────────────────────────────

// Heights are intentionally asymmetric — organic, not mechanical
const WAVE_HEIGHTS = [0.38, 0.72, 0.55, 0.92, 0.64, 0.84, 0.48, 0.76];

function Waveform() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 3,
        height: 26,
        padding: "0 2px",
      }}
    >
      {WAVE_HEIGHTS.map((base, i) => (
        <motion.span
          key={i}
          style={{
            display: "block",
            width: 2.5,
            borderRadius: 2,
            background: `linear-gradient(180deg, ${ICE}0.9) 0%, ${SKY}0.5) 55%, ${SKY}0.15) 100%)`,
            transformOrigin: "bottom",
          }}
          animate={{
            height: [
              `${base * 22}%`,
              `${base * 100}%`,
              `${base * 35}%`,
              `${base * 88}%`,
              `${base * 22}%`,
            ],
            opacity: [0.5, 0.95, 0.55, 0.9, 0.5],
          }}
          transition={{
            duration: 0.68 + i * 0.055,
            repeat: Infinity,
            ease: EASE_IN_OUT,
            delay: i * 0.06,
          }}
        />
      ))}
    </div>
  );
}

// ─── Processing indicator ─────────────────────────────────────────────────────

function ProcessingDots() {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          style={{
            display: "block",
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: `${BLUE}0.85)`,
          }}
          animate={{ y: [0, -5, 0], opacity: [0.3, 0.9, 0.3] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            ease: EASE_IN_OUT,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );
}

// ─── Ambient field — soft radial glow behind everything ──────────────────────

function AmbientField({
  isActive,
  isSpeaking,
}: {
  isActive: boolean;
  isSpeaking: boolean;
}) {
  return (
    <motion.circle
      cx={CX}
      cy={CY}
      r={88}
      fill="url(#jv-field)"
      style={{ originX: "50%", originY: "50%" }}
      animate={{
        opacity:  isSpeaking ? 0.9 : isActive ? 0.65 : 0.25,
        scale:    isSpeaking ? 1.08 : isActive ? 1.03 : 1,
      }}
      transition={{ duration: 1.4, ease: EASE_OUT_QUART }}
    />
  );
}

// ─── Pulse rings — slow, minimal, two maximum ─────────────────────────────────

function PulseRings({
  isActive,
  isSpeaking,
}: {
  isActive: boolean;
  isSpeaking: boolean;
}) {
  const duration = isSpeaking ? 1.9 : isActive ? 2.6 : 4.2;
  const maxR     = isSpeaking ? 82 : isActive ? 70 : 58;
  const startOp  = isSpeaking ? 0.55 : isActive ? 0.4 : 0.22;

  return (
    <>
      {[0, 1].map((i) => (
        <motion.circle
          key={i}
          cx={CX}
          cy={CY}
          fill="none"
          stroke={i === 0 ? `${SKY}1)` : `${BLUE}1)`}
          initial={{ r: 26, opacity: 0, strokeWidth: 0.8 }}
          animate={{
            r:           [26, maxR],
            opacity:     [startOp, 0],
            strokeWidth: [0.8, 0],
          }}
          transition={{
            duration,
            repeat: Infinity,
            ease: EASE_OUT_QUART,
            delay: i * (duration / 2),
          }}
        />
      ))}
    </>
  );
}

// ─── Orbit ring — single slow ring, state-reactive ───────────────────────────

function OrbitRing({
  isActive,
  isSpeaking,
  isProcessing,
}: {
  isActive: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
}) {
  // Idle: almost invisible 20s orbit. Active: brighter, 14s. Speaking: 10s.
  // Processing: faster (6s) with a different dash pattern.
  const duration  = isProcessing ? 6 : isSpeaking ? 10 : isActive ? 14 : 20;
  const opacity   = isProcessing ? 0.5 : isSpeaking ? 0.42 : isActive ? 0.3 : 0.12;
  const dasharray = isProcessing ? "28 12" : "188 44";
  const strokeW   = isSpeaking ? 1.4 : 1.0;

  return (
    <motion.g
      style={{ originX: "50%", originY: "50%" }}
      animate={{ rotate: 360 }}
      transition={{ duration, repeat: Infinity, ease: "linear" }}
    >
      <motion.circle
        cx={CX}
        cy={CY}
        r={74}
        fill="none"
        stroke={`${SKY}1)`}
        strokeWidth={strokeW}
        strokeDasharray={dasharray}
        strokeLinecap="round"
        animate={{ opacity }}
        transition={{ duration: 1.2, ease: EASE_OUT_QUART }}
      />
    </motion.g>
  );
}

// ─── Orb bloom — blurred glow layer behind the orb surface ───────────────────

function OrbBloom({
  isActive,
  isSpeaking,
  isProcessing,
}: {
  isActive: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
}) {
  return (
    <motion.circle
      cx={CX}
      cy={CY}
      r={22}
      fill={
        isSpeaking
          ? `${BLUE}0.85)`
          : `${SKY}${isActive ? "0.55" : "0.28"})`
      }
      filter="url(#jv-bloom)"
      initial={{ r: 22 }}
      animate={{
        r:       isSpeaking ? [23, 28, 21, 26, 23] : isProcessing ? [22, 25, 22] : 22,
        opacity: isSpeaking ? [0.75, 1, 0.65, 0.95, 0.75] : isActive ? 0.85 : 0.45,
      }}
      transition={
        isSpeaking
          ? { duration: 1.8, repeat: Infinity, ease: EASE_IN_OUT }
          : isProcessing
          ? { duration: 1.2, repeat: Infinity, repeatType: "mirror", ease: EASE_IN_OUT }
          : { duration: 0.9, ease: EASE_OUT_QUART }
      }
    />
  );
}

// ─── Orb surface — the hero element ──────────────────────────────────────────

function Orb({
  isActive,
  isSpeaking,
  isProcessing,
  isListening,
}: {
  isActive: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  isListening: boolean;
}) {
  // Drop-shadow is the only visual effect on the orb surface.
  // It varies with state — everything else (bloom, rings) provides context.
  const shadowIdle       = "drop-shadow(0 0 5px rgba(125,211,252,0.25))";
  const shadowActive     = "drop-shadow(0 0 9px rgba(125,211,252,0.55)) drop-shadow(0 0 22px rgba(125,211,252,0.22))";
  const shadowSpeaking   = [
    "drop-shadow(0 0 10px rgba(125,211,252,0.60)) drop-shadow(0 0 28px rgba(125,211,252,0.28))",
    "drop-shadow(0 0 18px rgba(147,197,253,0.85)) drop-shadow(0 0 44px rgba(125,211,252,0.40))",
    "drop-shadow(0 0 10px rgba(125,211,252,0.60)) drop-shadow(0 0 28px rgba(125,211,252,0.28))",
  ];
  const shadowProcessing = [
    "drop-shadow(0 0 6px rgba(125,211,252,0.22))",
    "drop-shadow(0 0 12px rgba(125,211,252,0.48)) drop-shadow(0 0 24px rgba(125,211,252,0.20))",
    "drop-shadow(0 0 6px rgba(125,211,252,0.22))",
  ];

  return (
    <motion.circle
      cx={CX}
      cy={CY}
      r={22}
      fill="url(#jv-orb)"
      style={{ originX: "50%", originY: "50%" }}
      initial={{ r: 22 }}
      animate={{
        r: isListening ? 27 : isProcessing ? [22, 24, 22] : 22,
        scale: isSpeaking
          ? [1, 1.055, 1.02, 1.07, 1.01, 1.055, 1]
          : 1,
        filter: isSpeaking
          ? shadowSpeaking
          : isProcessing
          ? shadowProcessing
          : isActive
          ? [shadowActive, shadowActive, shadowActive]   // steady glow — no flash
          : shadowIdle,
      }}
      transition={
        isSpeaking
          ? {
              scale:  { duration: 1.8, repeat: Infinity, ease: [0.4, 0, 0.2, 1], times: [0, 0.18, 0.38, 0.55, 0.72, 0.87, 1] },
              filter: { duration: 1.8, repeat: Infinity, ease: EASE_IN_OUT },
              r:      { type: "spring", stiffness: 200, damping: 24 },
            }
          : isProcessing
          ? {
              r:      { duration: 0.9, repeat: Infinity, repeatType: "mirror", ease: EASE_IN_OUT },
              filter: { duration: 1.0, repeat: Infinity, ease: EASE_IN_OUT },
              scale:  { duration: 0.3 },
            }
          : {
              r:      { type: "spring", stiffness: 180, damping: 22 },
              filter: { duration: 4, repeat: Infinity, ease: EASE_IN_OUT },
              scale:  { duration: 0.5 },
            }
      }
    />
  );
}

// ─── HUD corner brackets — clean, minimal ────────────────────────────────────

const BRACKET_PATHS = [
  "M24 34 L24 24 L34 24",
  "M176 34 L176 24 L166 24",
  "M24 166 L24 176 L34 176",
  "M176 166 L176 176 L166 176",
];

function HUDBrackets({
  isActive,
  isSpeaking,
}: {
  isActive: boolean;
  isSpeaking: boolean;
}) {
  const opacity   = isSpeaking ? 0.62 : isActive ? 0.44 : 0.18;
  const strokeW   = isSpeaking ? 1.6 : 1.2;
  const strokeCol = `${SKY}1)`;

  return (
    <>
      {BRACKET_PATHS.map((d, i) => (
        <motion.path
          key={i}
          d={d}
          fill="none"
          stroke={strokeCol}
          strokeLinecap="round"
          animate={{ opacity, strokeWidth: strokeW }}
          initial={{ opacity: 0, pathLength: 0 }}
          transition={{
            pathLength: { duration: 0.5, delay: i * 0.08, ease: EASE_OUT_QUART },
            opacity:    { duration: 0.6, delay: i * 0.08, ease: EASE_OUT_QUART },
            strokeWidth:{ duration: 0.4 },
          }}
        />
      ))}
    </>
  );
}

// ─── Status label ─────────────────────────────────────────────────────────────

function StatusLabel({
  voiceState,
  isAwake,
}: {
  voiceState: JarvisVoiceState;
  isAwake: boolean;
}) {
  const isListening  = voiceState === "listening";
  const isProcessing = voiceState === "processing";
  const isSpeaking   = voiceState === "speaking";

  const MONO: React.CSSProperties = {
    fontFamily:    "'Space Mono', 'DM Mono', monospace",
    fontSize:       9,
    letterSpacing:  "0.22em",
    textTransform:  "uppercase",
    color:          `${ICE}0.7)`,
  };

  const wrap = (key: string, node: React.ReactNode) => (
    <motion.div
      key={key}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.22, ease: EASE_OUT_QUART }}
    >
      {node}
    </motion.div>
  );

  return (
    <AnimatePresence mode="wait">
      {isSpeaking && wrap("speaking", <Waveform />)}

      {isProcessing && wrap("processing", <ProcessingDots />)}

      {isListening && !isSpeaking && wrap("listening", (
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <motion.span
            style={{
              display:      "block",
              width:         5,
              height:        5,
              borderRadius:  "50%",
              background:    "#34D399",
            }}
            animate={{ opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: EASE_IN_OUT }}
          />
          <span style={MONO}>Listening</span>
        </div>
      ))}

      {isAwake && !isListening && !isProcessing && !isSpeaking && wrap("awake", (
        <span style={MONO}>Online</span>
      ))}
    </AnimatePresence>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

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

  return (
    <div style={{ width: size, height: size, position: "relative", userSelect: "none" }}>
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        style={{ overflow: "visible", display: "block" }}
      >
        <defs>
          {/* Orb surface gradient — subtle specular shift between states */}
          <radialGradient id="jv-orb" cx="38%" cy="32%" r="66%">
            <stop offset="0%"   stopColor={isSpeaking ? "#E0F2FE" : "#BAE6FD"} />
            <stop offset="40%"  stopColor="#93C5FD" />
            <stop offset="100%" stopColor="#040D1C" />
          </radialGradient>

          {/* Ambient field — radial fade */}
          <radialGradient id="jv-field" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={`${SKY}0.20)`} />
            <stop offset="55%"  stopColor={`${SKY}0.05)`} />
            <stop offset="100%" stopColor={`${SKY}0)`}    stopOpacity="0" />
          </radialGradient>

          {/* Single bloom filter — soft, not overdone */}
          <filter id="jv-bloom" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={isSpeaking ? 8.5 : 6} result="blur" />
          </filter>
        </defs>

        {/* Layer 1 — Ambient field (always present, intensity varies) */}
        <AmbientField isActive={isActive} isSpeaking={isSpeaking} />

        {/* Layer 2 — Pulse rings (slow expanding ripples) */}
        <PulseRings isActive={isActive} isSpeaking={isSpeaking} />

        {/* Layer 3 — Single orbit ring (state-reactive speed & opacity) */}
        <OrbitRing
          isActive={isActive}
          isSpeaking={isSpeaking}
          isProcessing={isProcessing}
        />

        {/* Layer 4 — Orb bloom (blurred glow behind orb surface) */}
        <OrbBloom
          isActive={isActive}
          isSpeaking={isSpeaking}
          isProcessing={isProcessing}
        />

        {/* Layer 5 — Orb surface (hero element) */}
        <Orb
          isActive={isActive}
          isSpeaking={isSpeaking}
          isProcessing={isProcessing}
          isListening={isListening}
        />

        {/* Layer 6 — HUD corner brackets (always visible, opacity-only change) */}
        <HUDBrackets isActive={isActive} isSpeaking={isSpeaking} />
      </svg>

      {/* Status label — centred below orb, 28px below SVG midpoint */}
      <div
        style={{
          position:   "absolute",
          left:        0,
          right:       0,
          top:         "50%",
          marginTop:   size * 0.14,
          display:     "flex",
          justifyContent: "center",
          alignItems:  "center",
          pointerEvents: "none",
        }}
      >
        <StatusLabel voiceState={voiceState} isAwake={isAwake} />
      </div>
    </div>
  );
}
