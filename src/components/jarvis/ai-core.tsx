/**
 * JARVIS AI Core — production rewrite.
 *
 * Principles:
 *  - Zero raw CSS keyframe strings — everything via framer-motion
 *  - Correct SVG geometry for all arcs and elements
 *  - Smooth state transitions with AnimatePresence + mode="wait"
 *  - Layered depth: glow → arcs → radar → pulse → orb → HUD
 */

import { motion, AnimatePresence } from "framer-motion";
import type { JarvisVoiceState } from "@/lib/jarvis";

// ─── Shared constants ─────────────────────────────────────────────────────────

const C  = 100; // SVG centre x/y (viewBox 200×200)
const C0 = "#7DD3FC"; // sky-500
const C1 = "#93C5FD"; // sky-400
const C2 = "#BAE6FD"; // sky-200

// ─── Waveform ─────────────────────────────────────────────────────────────────

function Waveform() {
  const profile = [0.35, 0.6, 0.9, 0.65, 1, 0.7, 0.5, 0.8, 0.45];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 3,
        height: 22,
        padding: "0 2px",
      }}
    >
      {profile.map((base, i) => (
        <motion.span
          key={i}
          style={{
            display: "block",
            width: 2.5,
            borderRadius: 2,
            background: `linear-gradient(180deg, ${C2} 0%, ${C0} 100%)`,
            originY: 1,
          }}
          animate={{
            height: [
              `${base * 35}%`,
              `${base * 100}%`,
              `${base * 25}%`,
              `${base * 85}%`,
              `${base * 35}%`,
            ],
            opacity: [0.55, 1, 0.45, 0.9, 0.55],
          }}
          transition={{
            duration: 0.85 + i * 0.06,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.07,
          }}
        />
      ))}
    </div>
  );
}

// ─── Processing dots ──────────────────────────────────────────────────────────

function ProcessingDots() {
  return (
    <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          style={{
            display: "block",
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: C1,
          }}
          animate={{ y: [0, -6, 0], opacity: [0.35, 1, 0.35] }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.18,
          }}
        />
      ))}
    </div>
  );
}

// ─── Spinning arc helper ──────────────────────────────────────────────────────

interface ArcProps {
  r: number;
  dasharray: string;
  stroke: string;
  strokeWidth: number;
  duration: number;   // seconds for one full rotation
  reverse?: boolean;
  linecap?: "round" | "butt";
}

function SpinningArc({ r, dasharray, stroke, strokeWidth, duration, reverse, linecap = "round" }: ArcProps) {
  return (
    <motion.g
      style={{ originX: "50%", originY: "50%" }}
      animate={{ rotate: reverse ? -360 : 360 }}
      transition={{ duration, repeat: Infinity, ease: "linear" }}
    >
      <circle
        cx={C} cy={C} r={r}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dasharray}
        strokeLinecap={linecap}
      />
    </motion.g>
  );
}

// ─── Radar sweep (proper SVG conic wedge) ─────────────────────────────────────
// Draws a 30° filled arc sector at r=82, rotated by framer-motion.

function RadarSweep({ active }: { active: boolean }) {
  // Sector: centre (100,100), r=82, from -90° to -60° (i.e. pointing up, 30° wide)
  const r = 82;
  const startAngle = -90; // degrees (pointing up)
  const endAngle   = -60;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = C + r * Math.cos(toRad(startAngle));
  const y1 = C + r * Math.sin(toRad(startAngle));
  const x2 = C + r * Math.cos(toRad(endAngle));
  const y2 = C + r * Math.sin(toRad(endAngle));
  const d  = `M ${C} ${C} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;

  return (
    <motion.g
      style={{ originX: "50%", originY: "50%" }}
      animate={{ rotate: 360 }}
      transition={{
        duration: active ? 2.8 : 5.5,
        repeat: Infinity,
        ease: "linear",
      }}
    >
      {/* Invisible anchor ensures bounding box is exactly 200x200 centered at 100,100 */}
      <circle cx={C} cy={C} r={C} fill="none" />
      
      {/* Trailing gradient: 3 overlapping wedges at decreasing opacity */}
      {[1, 0.55, 0.25].map((opacity, i) => {
        const sweep = 30 + i * 10;
        const ex  = C + r * Math.cos(toRad(startAngle - sweep));
        const ey  = C + r * Math.sin(toRad(startAngle - sweep));
        const trail = `M ${C} ${C} L ${x1} ${y1} A ${r} ${r} 0 0 0 ${ex} ${ey} Z`;
        return (
          <path
            key={i}
            d={i === 0 ? d : trail}
            fill={`rgba(147,197,253,${(active ? 0.13 : 0.05) * opacity})`}
          />
        );
      })}
      {/* Leading edge line */}
      <line
        x1={C} y1={C} x2={x2} y2={y2}
        stroke={`rgba(147,197,253,${active ? 0.6 : 0.25})`}
        strokeWidth="0.8"
      />
    </motion.g>
  );
}

// ─── Pulse rings ──────────────────────────────────────────────────────────────

function PulseRings({ active }: { active: boolean }) {
  return (
    <>
      {[0, 1].map((i) => (
        <motion.circle
          key={i}
          cx={C} cy={C}
          r={28}
          fill="none"
          stroke={i === 0 ? `rgba(147,197,253,0.55)` : `rgba(125,211,252,0.4)`}
          strokeWidth="0.7"
          initial={{ r: 28 }}
          animate={{
            r:            [28, active ? 74 : 58],
            opacity:      [active ? 0.6 : 0.3, 0],
            strokeWidth:  [0.9, 0.2],
          }}
          transition={{
            duration: active ? 2.2 : 3.8,
            repeat: Infinity,
            ease: "easeOut",
            delay: i * (active ? 1.1 : 1.9),
          }}
        />
      ))}
    </>
  );
}

// ─── HUD corner brackets ──────────────────────────────────────────────────────

const BRACKETS = [
  { d: "M22 32 L22 22 L32 22" },
  { d: "M178 32 L178 22 L168 22" },
  { d: "M22 168 L22 178 L32 178" },
  { d: "M178 168 L178 178 L168 178" },
];

function HUDBrackets({ active }: { active: boolean }) {
  return (
    <>
      {BRACKETS.map(({ d }, i) => (
        <motion.path
          key={i}
          d={d}
          fill="none"
          stroke={`rgba(125,211,252,${active ? 0.55 : 0.22})`}
          strokeWidth="1.3"
          strokeLinecap="round"
          animate={{ opacity: active ? 1 : 0.6, pathLength: [0, 1] }}
          initial={{ pathLength: 0, opacity: 0 }}
          transition={{
            pathLength: { duration: 0.6, delay: i * 0.1, ease: "easeOut" },
            opacity:    { duration: 0.4, delay: i * 0.1 },
          }}
        />
      ))}
    </>
  );
}

// ─── Status label ─────────────────────────────────────────────────────────────

function StatusLabel({ voiceState, isAwake }: { voiceState: JarvisVoiceState; isAwake: boolean }) {
  const isListening  = voiceState === "listening";
  const isProcessing = voiceState === "processing";
  const isSpeaking   = voiceState === "speaking";

  const labelStyle: React.CSSProperties = {
    fontFamily: "'DM Mono', 'Fira Code', 'Courier New', monospace",
    fontSize: 9,
    letterSpacing: "0.22em",
    textTransform: "uppercase" as const,
    color: `rgba(186,230,253,0.75)`,
  };

  const wrap = (key: string, node: React.ReactNode) => (
    <motion.div
      key={key}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {node}
    </motion.div>
  );

  return (
    <AnimatePresence mode="wait">
      {isSpeaking   && wrap("speaking",   <Waveform />)}
      {isProcessing && wrap("processing", <ProcessingDots />)}
      {isListening  && !isSpeaking && wrap("listening", (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <motion.span
            style={{ display: "block", width: 5, height: 5, borderRadius: "50%", background: "#10B981" }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.1, repeat: Infinity }}
          />
          <span style={labelStyle}>Listening</span>
        </div>
      ))}
      {isAwake && !isListening && !isProcessing && !isSpeaking && wrap("awake", (
        <span style={labelStyle}>Online</span>
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

  // Arc stroke params: circumference = 2πr
  // r=80 → circ≈502  | 300° arc → dash 419, gap 84
  // r=62 → circ≈390  | 240° arc → dash 260, gap 130
  // r=44 → circ≈277  | dotted pattern

  return (
    <div style={{ width: size, height: size, position: "relative", userSelect: "none" }}>
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        style={{ overflow: "visible", display: "block" }}
      >
        <defs>
          {/* Orb fill — specular highlight offset to top-left */}
          <radialGradient id="jv-orb" cx="36%" cy="30%" r="68%">
            <stop offset="0%"   stopColor={C2} />
            <stop offset="40%"  stopColor={C1} />
            <stop offset="100%" stopColor="#0A0F1A" />
          </radialGradient>

          {/* Soft ambient field */}
          <radialGradient id="jv-field" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="rgba(125,211,252,0.22)" />
            <stop offset="55%"  stopColor="rgba(125,211,252,0.06)" />
            <stop offset="100%" stopColor="rgba(125,211,252,0)" stopOpacity="0" />
          </radialGradient>

          {/* Orb bloom — separate from main filter to avoid double-blur */}
          <filter id="jv-bloom" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          </filter>

          {/* Subtle inner shadow on orb */}
          <filter id="jv-inner" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1 · Ambient field */}
        <motion.circle
          cx={C} cy={C} r={96}
          fill="url(#jv-field)"
          initial={{ r: 96, opacity: 0.4 }}
          animate={{ opacity: isActive ? 1 : 0.4, scale: isActive ? 1.05 : 1 }}
          transition={{ duration: 1, ease: "easeInOut" }}
          style={{ originX: "50%", originY: "50%" }}
        />

        {/* 2 · Outer arc — r=80, 300° span, clockwise */}
        <SpinningArc
          r={80}
          dasharray="419 84"
          stroke={`rgba(125,211,252,${isActive ? 0.5 : 0.28})`}
          strokeWidth={1.2}
          duration={isActive ? 12 : 22}
        />

        {/* 3 · Middle arc — r=62, 240° span, counter-clockwise */}
        <SpinningArc
          r={62}
          dasharray="260 130"
          stroke={`rgba(147,197,253,${isActive ? 0.38 : 0.18})`}
          strokeWidth={0.9}
          duration={isActive ? 18 : 34}
          reverse
        />

        {/* 4 · Inner arc — r=44, dotted, clockwise */}
        <SpinningArc
          r={44}
          dasharray="5 7"
          stroke={`rgba(125,211,252,${isActive ? 0.32 : 0.14})`}
          strokeWidth={0.75}
          duration={isActive ? 26 : 50}
          linecap="butt"
        />

        {/* 5 · Radar sweep */}
        <RadarSweep active={isActive} />

        {/* 6 · Pulse rings */}
        <PulseRings active={isActive} />

        {/* 7 · Orb bloom (blurred underlay for glow) */}
        <motion.circle
          cx={C} cy={C} r={24}
          fill={`rgba(125,211,252,${isActive ? 0.55 : 0.3})`}
          filter="url(#jv-bloom)"
          initial={{ r: 24, opacity: 0.5 }}
          animate={{ r: isListening ? 28 : 24, opacity: isActive ? 1 : 0.5 }}
          transition={{ type: "spring", stiffness: 180, damping: 18 }}
        />

        {/* 8 · Orb body */}
        <motion.circle
          cx={C} cy={C} r={22}
          fill="url(#jv-orb)"
          filter="url(#jv-inner)"
          style={{ originX: "50%", originY: "50%" }}
          initial={{ r: 22 }}
          animate={{
            r: isListening ? 26 : isProcessing ? [22, 24, 22] : 22,
            scale: isSpeaking ? [1, 1.06, 1] : 1,
            filter: isSpeaking
              ? [
                  "drop-shadow(0 0 8px rgba(56,189,248,0.4)) drop-shadow(0 0 20px rgba(56,189,248,0.2))",
                  "drop-shadow(0 0 18px rgba(56,189,248,0.9)) drop-shadow(0 0 40px rgba(56,189,248,0.5))",
                  "drop-shadow(0 0 8px rgba(56,189,248,0.4)) drop-shadow(0 0 20px rgba(56,189,248,0.2))",
                ]
              : isProcessing
              ? [
                  "drop-shadow(0 0 6px rgba(56,189,248,0.2)) drop-shadow(0 0 14px rgba(56,189,248,0.1))",
                  "drop-shadow(0 0 12px rgba(56,189,248,0.5)) drop-shadow(0 0 28px rgba(56,189,248,0.3))",
                  "drop-shadow(0 0 6px rgba(56,189,248,0.2)) drop-shadow(0 0 14px rgba(56,189,248,0.1))",
                ]
              : isActive
              ? ["drop-shadow(0 0 8px rgba(125,211,252,0.6)) drop-shadow(0 0 20px rgba(125,211,252,0.3))",
                 "drop-shadow(0 0 14px rgba(147,197,253,0.8)) drop-shadow(0 0 36px rgba(147,197,253,0.4))",
                 "drop-shadow(0 0 8px rgba(125,211,252,0.6)) drop-shadow(0 0 20px rgba(125,211,252,0.3))"]
              : "drop-shadow(0 0 6px rgba(125,211,252,0.3))",
          }}
          transition={
            isSpeaking
              ? { scale: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
                  filter: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
                  r: { type: "spring", stiffness: 200, damping: 22 } }
              : isProcessing
              ? { r: { duration: 0.5, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
                  filter: { duration: 0.8, repeat: Infinity, ease: "easeInOut" },
                  scale: { duration: 0.4 } }
              : { r: { type: "spring", stiffness: 200, damping: 22 },
                  filter: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                  scale: { duration: 0.4 } }
          }
        />

        {/* 9 · Specular highlights */}
        <circle cx="92"  cy="90" r="7"  fill="rgba(255,255,255,0.45)" />
        <circle cx="89"  cy="87" r="3"  fill="rgba(255,255,255,0.72)" />

        {/* 10 · HUD brackets */}
        <HUDBrackets active={isActive} />
      </svg>

      {/* Rotating rings — active during processing + speaking.
          Margin-based centering (not transform) so Framer Motion's rotate
          can own the `transform` property without conflict. */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: "140%",
          height: "140%",
          left: "-20%",
          top: "-20%",
          border: "1px solid transparent",
          borderTopColor: "rgba(56,189,248,0.6)",
          borderRightColor: "rgba(56,189,248,0.2)",
        }}
        animate={
          isProcessing || isSpeaking ? { rotate: 360 } : { rotate: 0 }
        }
        transition={
          isProcessing || isSpeaking
            ? { duration: 1.8, repeat: Infinity, ease: "linear" }
            : { duration: 0.5 }
        }
      />
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: "120%",
          height: "120%",
          left: "-10%",
          top: "-10%",
          border: "1px solid transparent",
          borderBottomColor: "rgba(56,189,248,0.4)",
          borderLeftColor: "rgba(56,189,248,0.1)",
        }}
        animate={
          isProcessing || isSpeaking ? { rotate: -360 } : { rotate: 0 }
        }
        transition={
          isProcessing || isSpeaking
            ? { duration: 2.4, repeat: Infinity, ease: "linear" }
            : { duration: 0.5 }
        }
      />

      {/* Status overlay — positioned at lower third of orb */}
      <div
        style={{
          position: "absolute",
          bottom: "12%",
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: 28,
          pointerEvents: "none",
        }}
      >
        <StatusLabel voiceState={voiceState} isAwake={isAwake} />
      </div>
    </div>
  );
}