/**
 * JARVIS AI Core — cinematic rewrite.
 *
 * Speaking state layers (bottom → top):
 *  SpeakingCorona → ambient field → arcs (x3) → PlasmaRing → RadarSweep
 *  → RadialEqualizer → SpeakingRipples → OrbBloom → InnerHalo → Orb
 *  → EnergyParticles → Specular → HUDBrackets → StatusLabel
 */

import { motion, AnimatePresence } from "framer-motion";
import type { JarvisVoiceState } from "@/lib/jarvis";

// ─── Shared palette ───────────────────────────────────────────────────────────

const C  = 100;
const C0 = "#7DD3FC";  // sky-300
const C1 = "#93C5FD";  // blue-300
const C2 = "#BAE6FD";  // sky-200
const C3 = "#E0F2FE";  // sky-100

// ─── Waveform (12 bars, more dramatic) ───────────────────────────────────────

const WAVE_PROFILE = [0.3, 0.62, 0.88, 0.55, 1.0, 0.72, 0.45, 0.95, 0.68, 0.82, 0.5, 0.78];

function Waveform() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2.5, height: 28, padding: "0 1px" }}>
      {WAVE_PROFILE.map((base, i) => (
        <motion.span
          key={i}
          style={{
            display: "block",
            width: 2.5,
            borderRadius: 2,
            background: `linear-gradient(180deg, ${C3} 0%, ${C0} 55%, rgba(56,189,248,0.35) 100%)`,
            originY: 1,
            boxShadow: `0 0 4px rgba(125,211,252,0.6)`,
          }}
          animate={{
            height: [
              `${base * 18}%`,
              `${base * 100}%`,
              `${base * 28}%`,
              `${base * 82}%`,
              `${base * 22}%`,
              `${base * 95}%`,
              `${base * 18}%`,
            ],
            opacity: [0.45, 1, 0.5, 0.92, 0.4, 1, 0.45],
          }}
          transition={{
            duration: 0.55 + i * 0.042,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.048,
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
          style={{ display: "block", width: 5, height: 5, borderRadius: "50%", background: C1 }}
          animate={{ y: [0, -6, 0], opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: i * 0.18 }}
        />
      ))}
    </div>
  );
}

// ─── Spinning arc ─────────────────────────────────────────────────────────────

interface ArcProps {
  r: number;
  dasharray: string;
  stroke: string;
  strokeWidth: number;
  duration: number;
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
      <circle cx={C} cy={C} r={r} fill="none" stroke={stroke}
        strokeWidth={strokeWidth} strokeDasharray={dasharray} strokeLinecap={linecap} />
    </motion.g>
  );
}

// ─── Radar sweep ──────────────────────────────────────────────────────────────

function RadarSweep({ active, isSpeaking }: { active: boolean; isSpeaking: boolean }) {
  const r = 82;
  const startAngle = -90;
  const endAngle   = -60;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = C + r * Math.cos(toRad(startAngle));
  const y1 = C + r * Math.sin(toRad(startAngle));
  const x2 = C + r * Math.cos(toRad(endAngle));
  const y2 = C + r * Math.sin(toRad(endAngle));
  const d  = `M ${C} ${C} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;

  const speed = isSpeaking ? 2.0 : active ? 2.8 : 5.5;

  return (
    <motion.g
      style={{ originX: "50%", originY: "50%" }}
      animate={{ rotate: 360 }}
      transition={{ duration: speed, repeat: Infinity, ease: "linear" }}
    >
      <circle cx={C} cy={C} r={C} fill="none" />
      {[1, 0.55, 0.25].map((opacity, i) => {
        const sweep = 30 + i * 10;
        const ex  = C + r * Math.cos(toRad(startAngle - sweep));
        const ey  = C + r * Math.sin(toRad(startAngle - sweep));
        const trail = `M ${C} ${C} L ${x1} ${y1} A ${r} ${r} 0 0 0 ${ex} ${ey} Z`;
        const alphaBase = isSpeaking ? 0.22 : active ? 0.13 : 0.05;
        return (
          <path key={i} d={i === 0 ? d : trail}
            fill={`rgba(147,197,253,${alphaBase * opacity})`} />
        );
      })}
      <line x1={C} y1={C} x2={x2} y2={y2}
        stroke={`rgba(147,197,253,${isSpeaking ? 0.85 : active ? 0.6 : 0.25})`}
        strokeWidth={isSpeaking ? 1.2 : 0.8} />
    </motion.g>
  );
}

// ─── Pulse rings (idle/listening/processing) ─────────────────────────────────

function PulseRings({ active }: { active: boolean }) {
  return (
    <>
      {[0, 1].map((i) => (
        <motion.circle key={i} cx={C} cy={C} fill="none"
          stroke={i === 0 ? "rgba(147,197,253,0.55)" : "rgba(125,211,252,0.4)"}
          initial={{ r: 28, opacity: active ? 0.6 : 0.3, strokeWidth: 0.9 }}
          animate={{
            r: [28, active ? 74 : 58],
            opacity: [active ? 0.6 : 0.3, 0],
            strokeWidth: [0.9, 0.2],
          }}
          transition={{
            duration: active ? 2.2 : 3.8, repeat: Infinity,
            ease: "easeOut", delay: i * (active ? 1.1 : 1.9),
          }}
        />
      ))}
    </>
  );
}

// ─── Speaking ripples (5 fast rings) ─────────────────────────────────────────

function SpeakingRipples() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.circle key={i} cx={C} cy={C} fill="none"
          stroke={i % 2 === 0 ? "rgba(147,197,253,0.8)" : "rgba(186,230,253,0.65)"}
          initial={{ r: 26, opacity: i === 0 ? 0.85 : 0.6, strokeWidth: i === 0 ? 1.8 : 1.1 }}
          animate={{
            r:           [26, 88],
            opacity:     [i === 0 ? 0.85 : 0.6, 0],
            strokeWidth: [i === 0 ? 1.8 : 1.1, 0],
          }}
          transition={{
            duration: 1.35,
            repeat: Infinity,
            delay: i * 0.27,
            ease: [0.1, 0.5, 0.3, 1.0],
          }}
        />
      ))}
    </>
  );
}

// ─── Radial equalizer (24 frequency bars around orb) ─────────────────────────

const EQ_PROFILE = [
  0.55, 0.9,  0.7,  1.0,  0.8,  0.5,  0.85, 0.65,
  0.95, 0.75, 0.55, 0.8,  0.7,  0.9,  0.6,  0.85,
  1.0,  0.7,  0.5,  0.88, 0.65, 0.82, 0.72, 0.6,
];

function RadialEqualizer() {
  const N = 24;
  const innerR = 29;
  const maxExtend = 16;

  return (
    <>
      {EQ_PROFILE.map((strength, i) => {
        const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
        const cos   = Math.cos(angle);
        const sin   = Math.sin(angle);
        const x1    = C + innerR * cos;
        const y1    = C + innerR * sin;
        const peak  = maxExtend * strength;
        const low   = maxExtend * 0.12;
        const mid   = maxExtend * strength * 0.55;

        return (
          <motion.line
            key={i}
            x1={x1} y1={y1}
            stroke={`rgba(186,230,253,0.8)`}
            strokeWidth={i % 4 === 0 ? 2 : 1.4}
            strokeLinecap="round"
            initial={{ x2: x1 + cos * low, y2: y1 + sin * low, opacity: 0 }}
            animate={{
              x2: [
                x1 + cos * low,
                x1 + cos * peak,
                x1 + cos * mid,
                x1 + cos * (peak * 0.85),
                x1 + cos * low,
              ],
              y2: [
                y1 + sin * low,
                y1 + sin * peak,
                y1 + sin * mid,
                y1 + sin * (peak * 0.85),
                y1 + sin * low,
              ],
              opacity: [0.35, 1, 0.6, 0.95, 0.35],
            }}
            transition={{
              duration: 0.42 + (i % 7) * 0.055,
              repeat: Infinity,
              delay: (i / N) * 0.38,
              ease: "easeInOut",
            }}
          />
        );
      })}
    </>
  );
}

// ─── Plasma ring (fast irregular dashed ring) ─────────────────────────────────

function PlasmaRing() {
  return (
    <motion.g
      style={{ originX: "50%", originY: "50%" }}
      animate={{ rotate: 360 }}
      transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }}
    >
      <circle cx={C} cy={C} r={50}
        fill="none"
        stroke="rgba(147,197,253,0.55)"
        strokeWidth="1.8"
        strokeDasharray="3 4 9 2 5 7 1 6"
        strokeLinecap="round"
      />
    </motion.g>
  );
}

// ─── Plasma ring 2 (counter, outer) ───────────────────────────────────────────

function PlasmaRingOuter() {
  return (
    <motion.g
      style={{ originX: "50%", originY: "50%" }}
      animate={{ rotate: -360 }}
      transition={{ duration: 4.3, repeat: Infinity, ease: "linear" }}
    >
      <circle cx={C} cy={C} r={68}
        fill="none"
        stroke="rgba(125,211,252,0.3)"
        strokeWidth="1.1"
        strokeDasharray="12 5 2 8 4 11"
        strokeLinecap="round"
      />
    </motion.g>
  );
}

// ─── Energy particles (orbiting dots) ─────────────────────────────────────────

interface ParticleProps {
  r: number;
  speed: number;
  size: number;
  opacity: number;
  reverse?: boolean;
  startFraction?: number; // 0–1, where on the circle to start
}

function EnergyParticle({ r, speed, size, opacity, reverse, startFraction = 0 }: ParticleProps) {
  const startAngle = startFraction * 360;
  return (
    <motion.g
      style={{ originX: "50%", originY: "50%" }}
      initial={{ rotate: startAngle }}
      animate={{ rotate: reverse ? startAngle - 360 : startAngle + 360 }}
      transition={{ duration: speed, repeat: Infinity, ease: "linear" }}
    >
      {/* Glow halo */}
      <circle cx={C + r} cy={C} r={size + 1.5}
        fill={`rgba(186,230,253,${opacity * 0.35})`} />
      {/* Core */}
      <circle cx={C + r} cy={C} r={size}
        fill={`rgba(224,242,254,${opacity})`} />
    </motion.g>
  );
}

// ─── Inner halo (tight pulsing ring around orb) ───────────────────────────────

function InnerHalo() {
  return (
    <motion.circle cx={C} cy={C} fill="none"
      stroke="rgba(186,230,253,0.75)"
      initial={{ r: 25.5, opacity: 0.25, strokeWidth: 1.2 }}
      animate={{
        opacity:      [0.25, 0.9, 0.35, 0.8, 0.25],
        r:            [25.5, 27, 25, 27.5, 25.5],
        strokeWidth:  [1.2, 2.2, 1.0, 2.0, 1.2],
      }}
      transition={{ duration: 0.85, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// ─── Speaking corona (wide soft glow field) ───────────────────────────────────

function SpeakingCorona() {
  return (
    <>
      {/* Deep outer corona */}
      <motion.circle cx={C} cy={C} fill="none"
        stroke="rgba(56,189,248,0.12)"
        strokeWidth="18"
        initial={{ r: 86, opacity: 0.4 }}
        animate={{ opacity: [0.4, 1, 0.5, 0.9, 0.4], r: [86, 94, 86] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Mid corona */}
      <motion.circle cx={C} cy={C} fill="none"
        stroke="rgba(125,211,252,0.09)"
        strokeWidth="14"
        initial={{ r: 68, opacity: 0.6 }}
        animate={{ opacity: [0.6, 1, 0.4, 0.85, 0.6], r: [68, 74, 68] }}
        transition={{ duration: 0.95, repeat: Infinity, ease: "easeInOut", delay: 0.18 }}
      />
    </>
  );
}

// ─── Chromatic arc (slight color split for sci-fi look) ───────────────────────

function ChromaticArcs() {
  return (
    <>
      <motion.g style={{ originX: "50%", originY: "50%" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 3.1, repeat: Infinity, ease: "linear" }}
      >
        <circle cx={C} cy={C} r={37}
          fill="none" stroke="rgba(96,165,250,0.5)"
          strokeWidth="2.5" strokeDasharray="22 8" strokeLinecap="round" />
      </motion.g>
      <motion.g style={{ originX: "50%", originY: "50%" }}
        animate={{ rotate: -360 }}
        transition={{ duration: 3.1, repeat: Infinity, ease: "linear" }}
      >
        <circle cx={C} cy={C} r={36}
          fill="none" stroke="rgba(56,189,248,0.4)"
          strokeWidth="1.2" strokeDasharray="22 8" strokeLinecap="round" />
      </motion.g>
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

function HUDBrackets({ active, isSpeaking }: { active: boolean; isSpeaking: boolean }) {
  return (
    <>
      {BRACKETS.map(({ d }, i) => (
        <motion.path key={i} d={d} fill="none"
          stroke={`rgba(125,211,252,${isSpeaking ? 0.75 : active ? 0.55 : 0.22})`}
          strokeWidth={isSpeaking ? 1.8 : 1.3}
          strokeLinecap="round"
          animate={{
            opacity: isSpeaking
              ? [0.7, 1, 0.6, 1, 0.7]
              : active ? 1 : 0.6,
            pathLength: [0, 1],
          }}
          initial={{ pathLength: 0, opacity: 0 }}
          transition={{
            pathLength: { duration: 0.6, delay: i * 0.1, ease: "easeOut" },
            opacity: isSpeaking
              ? { duration: 0.9 + i * 0.11, repeat: Infinity, ease: "easeInOut", delay: i * 0.22 }
              : { duration: 0.4, delay: i * 0.1 },
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
    color: "rgba(186,230,253,0.75)",
  };

  const wrap = (key: string, node: React.ReactNode) => (
    <motion.div key={key}
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

  return (
    <div style={{ width: size, height: size, position: "relative", userSelect: "none" }}>
      <svg viewBox="0 0 200 200" width={size} height={size}
        style={{ overflow: "visible", display: "block" }}
      >
        <defs>
          <radialGradient id="jv-orb" cx="36%" cy="30%" r="68%">
            <stop offset="0%"   stopColor={isSpeaking ? "#E0F2FE" : C2} />
            <stop offset="35%"  stopColor={isSpeaking ? C1 : C1} />
            <stop offset="100%" stopColor="#050D1A" />
          </radialGradient>

          <radialGradient id="jv-field" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="rgba(125,211,252,0.22)" />
            <stop offset="55%"  stopColor="rgba(125,211,252,0.06)" />
            <stop offset="100%" stopColor="rgba(125,211,252,0)" stopOpacity="0" />
          </radialGradient>

          <filter id="jv-bloom" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={isSpeaking ? 9 : 6} result="blur" />
          </filter>

          <filter id="jv-bloom-wide" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="14" result="blur" />
          </filter>

          <filter id="jv-inner" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ── Speaking corona (only when speaking) ── */}
        <AnimatePresence>
          {isSpeaking && (
            <motion.g
              key="corona"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <SpeakingCorona />
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Ambient field ── */}
        <motion.circle cx={C} cy={C} r={96} fill="url(#jv-field)"
          animate={{ opacity: isSpeaking ? 1.0 : isActive ? 1 : 0.4, scale: isSpeaking ? 1.12 : isActive ? 1.05 : 1 }}
          transition={{ duration: 0.9, ease: "easeInOut" }}
          style={{ originX: "50%", originY: "50%" }}
        />

        {/* ── Outer arc — r=80, 300° span ── */}
        <SpinningArc r={80} dasharray="419 84"
          stroke={`rgba(125,211,252,${isSpeaking ? 0.72 : isActive ? 0.5 : 0.28})`}
          strokeWidth={isSpeaking ? 1.8 : 1.2}
          duration={isSpeaking ? 4.2 : isActive ? 12 : 22}
        />

        {/* ── Middle arc — r=62, 240° span, CCW ── */}
        <SpinningArc r={62} dasharray="260 130"
          stroke={`rgba(147,197,253,${isSpeaking ? 0.58 : isActive ? 0.38 : 0.18})`}
          strokeWidth={isSpeaking ? 1.3 : 0.9}
          duration={isSpeaking ? 6.5 : isActive ? 18 : 34}
          reverse
        />

        {/* ── Inner dotted arc — r=44 ── */}
        <SpinningArc r={44} dasharray="5 7"
          stroke={`rgba(125,211,252,${isSpeaking ? 0.5 : isActive ? 0.32 : 0.14})`}
          strokeWidth={isSpeaking ? 1.1 : 0.75}
          duration={isSpeaking ? 8.5 : isActive ? 26 : 50}
          linecap="butt"
        />

        {/* ── Plasma rings (only when speaking) ── */}
        <AnimatePresence>
          {isSpeaking && (
            <motion.g key="plasma"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <PlasmaRing />
              <PlasmaRingOuter />
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Chromatic arcs (speaking) ── */}
        <AnimatePresence>
          {isSpeaking && (
            <motion.g key="chroma"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              <ChromaticArcs />
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Radar sweep ── */}
        <RadarSweep active={isActive} isSpeaking={isSpeaking} />

        {/* ── Radial equalizer (only when speaking) ── */}
        <AnimatePresence>
          {isSpeaking && (
            <motion.g key="eq"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <RadialEqualizer />
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Ripples: speaking ripples or regular pulse ── */}
        <AnimatePresence mode="wait">
          {isSpeaking ? (
            <motion.g key="speaking-ripples"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <SpeakingRipples />
            </motion.g>
          ) : (
            <motion.g key="pulse-rings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <PulseRings active={isActive} />
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Orb bloom (blurred glow underlay) ── */}
        <motion.circle cx={C} cy={C}
          fill={isSpeaking
            ? "rgba(147,197,253,0.8)"
            : `rgba(125,211,252,${isActive ? 0.55 : 0.3})`}
          filter={isSpeaking ? "url(#jv-bloom-wide)" : "url(#jv-bloom)"}
          initial={{ r: 24, opacity: 0.5 }}
          animate={{
            r: isSpeaking ? [24, 30, 22, 28, 24] : isListening ? 28 : 24,
            opacity: isSpeaking ? [0.8, 1, 0.7, 1, 0.8] : isActive ? 1 : 0.5,
          }}
          transition={isSpeaking
            ? { duration: 0.95, repeat: Infinity, ease: "easeInOut" }
            : { type: "spring", stiffness: 180, damping: 18 }
          }
        />

        {/* ── Inner halo (only when speaking) ── */}
        <AnimatePresence>
          {isSpeaking && (
            <motion.g key="inner-halo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <InnerHalo />
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Orb body ── */}
        <motion.circle cx={C} cy={C}
          fill="url(#jv-orb)"
          filter="url(#jv-inner)"
          style={{ originX: "50%", originY: "50%" }}
          initial={{ r: 22 }}
          animate={{
            r: isListening ? 26 : isProcessing ? [22, 24, 22] : 22,
            scale: isSpeaking
              ? [1, 1.1, 1.04, 1.12, 1.02, 1.08, 1]
              : 1,
            filter: isSpeaking
              ? [
                  "drop-shadow(0 0 10px rgba(56,189,248,0.55)) drop-shadow(0 0 28px rgba(56,189,248,0.28)) drop-shadow(0 0 50px rgba(56,189,248,0.12))",
                  "drop-shadow(0 0 22px rgba(96,165,250,1)) drop-shadow(0 0 50px rgba(56,189,248,0.7)) drop-shadow(0 0 90px rgba(56,189,248,0.3))",
                  "drop-shadow(0 0 12px rgba(56,189,248,0.6)) drop-shadow(0 0 32px rgba(56,189,248,0.35)) drop-shadow(0 0 60px rgba(56,189,248,0.15))",
                  "drop-shadow(0 0 26px rgba(147,197,253,1)) drop-shadow(0 0 60px rgba(125,211,252,0.75)) drop-shadow(0 0 100px rgba(56,189,248,0.35))",
                  "drop-shadow(0 0 10px rgba(56,189,248,0.55)) drop-shadow(0 0 28px rgba(56,189,248,0.28)) drop-shadow(0 0 50px rgba(56,189,248,0.12))",
                ]
              : isProcessing
              ? [
                  "drop-shadow(0 0 6px rgba(56,189,248,0.2)) drop-shadow(0 0 14px rgba(56,189,248,0.1))",
                  "drop-shadow(0 0 12px rgba(56,189,248,0.5)) drop-shadow(0 0 28px rgba(56,189,248,0.3))",
                  "drop-shadow(0 0 6px rgba(56,189,248,0.2)) drop-shadow(0 0 14px rgba(56,189,248,0.1))",
                ]
              : isActive
              ? [
                  "drop-shadow(0 0 8px rgba(125,211,252,0.6)) drop-shadow(0 0 20px rgba(125,211,252,0.3))",
                  "drop-shadow(0 0 14px rgba(147,197,253,0.8)) drop-shadow(0 0 36px rgba(147,197,253,0.4))",
                  "drop-shadow(0 0 8px rgba(125,211,252,0.6)) drop-shadow(0 0 20px rgba(125,211,252,0.3))",
                ]
              : "drop-shadow(0 0 6px rgba(125,211,252,0.3))",
          }}
          transition={isSpeaking
            ? {
                scale:  { duration: 0.92, repeat: Infinity, ease: [0.4, 0, 0.2, 1], times: [0, 0.2, 0.4, 0.65, 0.8, 0.9, 1] },
                filter: { duration: 0.92, repeat: Infinity, ease: "easeInOut" },
                r:      { type: "spring", stiffness: 200, damping: 22 },
              }
            : isProcessing
            ? {
                r:      { duration: 0.5, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
                filter: { duration: 0.8, repeat: Infinity, ease: "easeInOut" },
                scale:  { duration: 0.4 },
              }
            : {
                r:      { type: "spring", stiffness: 200, damping: 22 },
                filter: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                scale:  { duration: 0.4 },
              }
          }
        />

        {/* ── Energy particles orbiting (only when speaking) ── */}
        <AnimatePresence>
          {isSpeaking && (
            <motion.g key="particles"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <EnergyParticle r={37} speed={2.1}  size={2.2} opacity={0.9} startFraction={0.0} />
              <EnergyParticle r={46} speed={3.3}  size={1.6} opacity={0.75} startFraction={0.25} reverse />
              <EnergyParticle r={54} speed={4.7}  size={1.8} opacity={0.65} startFraction={0.6} />
              <EnergyParticle r={34} speed={1.85} size={2.0} opacity={0.85} startFraction={0.5} reverse />
              <EnergyParticle r={60} speed={5.3}  size={1.2} opacity={0.5}  startFraction={0.8} />
              <EnergyParticle r={42} speed={2.9}  size={1.5} opacity={0.7}  startFraction={0.15} />
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Specular highlights ── */}
        <circle cx="92" cy="90" r="7"  fill="rgba(255,255,255,0.45)" />
        <circle cx="89" cy="87" r="3"  fill="rgba(255,255,255,0.72)" />

        {/* ── HUD brackets ── */}
        <HUDBrackets active={isActive} isSpeaking={isSpeaking} />
      </svg>

      {/* ── Outer rotating rings (margin-based, no transform conflict) ── */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: "140%", height: "140%", left: "-20%", top: "-20%",
          border: "1px solid transparent",
          borderTopColor: isSpeaking ? "rgba(56,189,248,0.85)" : "rgba(56,189,248,0.6)",
          borderRightColor: isSpeaking ? "rgba(147,197,253,0.45)" : "rgba(56,189,248,0.2)",
          boxShadow: isSpeaking ? "0 0 18px rgba(56,189,248,0.25)" : "none",
        }}
        animate={isProcessing || isSpeaking ? { rotate: 360 } : { rotate: 0 }}
        transition={isProcessing || isSpeaking
          ? { duration: isSpeaking ? 1.2 : 1.8, repeat: Infinity, ease: "linear" }
          : { duration: 0.5 }
        }
      />
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: "120%", height: "120%", left: "-10%", top: "-10%",
          border: "1px solid transparent",
          borderBottomColor: isSpeaking ? "rgba(56,189,248,0.7)" : "rgba(56,189,248,0.4)",
          borderLeftColor: isSpeaking ? "rgba(147,197,253,0.3)" : "rgba(56,189,248,0.1)",
          boxShadow: isSpeaking ? "0 0 12px rgba(56,189,248,0.2)" : "none",
        }}
        animate={isProcessing || isSpeaking ? { rotate: -360 } : { rotate: 0 }}
        transition={isProcessing || isSpeaking
          ? { duration: isSpeaking ? 1.85 : 2.4, repeat: Infinity, ease: "linear" }
          : { duration: 0.5 }
        }
      />

      {/* ── Third ring (only speaking) ── */}
      <AnimatePresence>
        {isSpeaking && (
          <motion.div
            key="ring3"
            className="absolute rounded-full pointer-events-none"
            style={{
              width: "160%", height: "160%", left: "-30%", top: "-30%",
              border: "1px solid transparent",
              borderTopColor: "rgba(125,211,252,0.4)",
              borderBottomColor: "rgba(56,189,248,0.2)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, rotate: 360 }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: 0.4 },
              rotate: { duration: 2.6, repeat: Infinity, ease: "linear" },
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Status overlay ── */}
      <div style={{
        position: "absolute", bottom: "12%", width: "100%",
        display: "flex", justifyContent: "center", alignItems: "center",
        minHeight: 28, pointerEvents: "none",
      }}>
        <StatusLabel voiceState={voiceState} isAwake={isAwake} />
      </div>
    </div>
  );
}
