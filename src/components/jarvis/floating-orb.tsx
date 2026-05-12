/**
 * JARVIS Floating Orb — global persistent widget shown on all non-JARVIS pages.
 * Reacts to wake word and JARVIS state. Click to open the JARVIS tab.
 */

import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useRef } from "react";
import { useRouterState, useNavigate } from "@tanstack/react-router";
import { useJarvis, jarvis } from "@/lib/jarvis";

// ─── Waveform (speaking state) ────────────────────────────────────────────────

function OrbWaveform() {
  const heights = [0.35, 0.65, 1, 0.7, 0.4];
  return (
    <div className="flex items-end justify-center gap-[2.5px]" style={{ height: 16, width: 22 }}>
      {heights.map((base, i) => (
        <motion.span
          key={i}
          style={{
            display: "block",
            width: 2.5,
            borderRadius: 2,
            background: "linear-gradient(180deg, #F28D9E 0%, #DC4C64 100%)",
            originY: 1,
          }}
          animate={{
            height: ["40%", `${base * 100}%`, "20%", `${base * 80}%`, "40%"],
            opacity: [0.6, 1, 0.5, 0.9, 0.6],
          }}
          transition={{
            duration: 0.9 + i * 0.08,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.09,
          }}
        />
      ))}
    </div>
  );
}

// ─── Thinking dots ────────────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <div className="flex items-center gap-[4px]">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          style={{
            display: "block",
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: "#DC4C64",
          }}
          animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 0.75,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.18,
          }}
        />
      ))}
    </div>
  );
}

// ─── JARVIS logo icon ─────────────────────────────────────────────────────────

function JarvisIcon({ active }: { active: boolean }) {
  return (
    <motion.svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      animate={{ rotate: active ? [0, 360] : 0 }}
      transition={active ? { duration: 12, repeat: Infinity, ease: "linear" } : { duration: 0.4 }}
    >
      {/* Outer ring */}
      <circle
        cx="10" cy="10" r="8.5"
        stroke={active ? "#E05A6F" : "rgba(220,76,100,0.5)"}
        strokeWidth="1"
        strokeDasharray="4 2.5"
      />
      {/* Inner ring */}
      <circle
        cx="10" cy="10" r="5"
        stroke={active ? "rgba(220,76,100,0.6)" : "rgba(220,76,100,0.25)"}
        strokeWidth="0.8"
      />
      {/* Core */}
      <circle
        cx="10" cy="10" r="2.5"
        fill={active ? "#DC4C64" : "rgba(220,76,100,0.4)"}
      />
      {/* Cardinal ticks */}
      {[[10, 1.5, 10, 4], [10, 16, 10, 18.5], [1.5, 10, 4, 10], [16, 10, 18.5, 10]].map(([x1, y1, x2, y2], i) => (
        <line
          key={i}
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={active ? "#E05A6F" : "rgba(220,76,100,0.4)"}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      ))}
    </motion.svg>
  );
}

// ─── Spinning arc (processing state) ─────────────────────────────────────────

function SpinnerArc() {
  return (
    <motion.div
      className="absolute inset-[-4px] rounded-full"
      style={{ border: "1.5px solid transparent", borderTopColor: "#DC4C64", borderRightColor: "rgba(220,76,100,0.3)" }}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    />
  );
}

// ─── Pulse rings ──────────────────────────────────────────────────────────────

function PulseRings() {
  return (
    <>
      {[0, 1].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full"
          style={{ border: "1px solid rgba(220,76,100,0.35)" }}
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{ scale: [1, 1.9, 1.9], opacity: [0.5, 0, 0] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeOut",
            delay: i * 1,
          }}
        />
      ))}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function JarvisFloatingOrb() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { voiceState, isAwake, enabled } = useJarvis();

  if (pathname === "/jarvis") return null;

  const isListening = voiceState === "listening";
  const isThinking  = voiceState === "processing";
  const isSpeaking  = voiceState === "speaking";
  const isActive    = isAwake || isListening;

  const handleClick = () => {
    if (isActive && enabled) {
      jarvis.dismiss();
    } else {
      void navigate({ to: "/jarvis" });
    }
  };

  return (
    <div className="fixed z-[55] bottom-[5.5rem] right-4 md:bottom-6 md:right-6">
      <div className="relative flex items-center justify-center">

        {/* Pulse rings — active / speaking only */}
        <AnimatePresence>
          {(isActive || isSpeaking) && <PulseRings key="pulses" />}
        </AnimatePresence>

        {/* Ambient glow */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              key="glow"
              className="absolute rounded-full pointer-events-none"
              style={{
                inset: -10,
                background: "radial-gradient(circle, rgba(220,76,100,0.18) 0%, transparent 70%)",
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          )}
        </AnimatePresence>

        {/* Main orb button */}
        <motion.button
          onClick={handleClick}
          aria-label="Open JARVIS"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: "spring", stiffness: 380, damping: 22 }}
          style={{
            position: "relative",
            width: 44,
            height: 44,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isActive
              ? "radial-gradient(circle at 38% 32%, #E05A6F 0%, #DC4C64 40%, #531A24 100%)"
              : "radial-gradient(circle at 38% 32%, rgba(220,76,100,0.45) 0%, rgba(83,26,36,0.97) 100%)",
            border: `1.5px solid ${isActive ? "rgba(220,76,100,0.75)" : "rgba(220,76,100,0.2)"}`,
            boxShadow: isActive
              ? "0 0 0 1px rgba(220,76,100,0.15), 0 4px 24px rgba(220,76,100,0.45), inset 0 1px 0 rgba(255,255,255,0.12)"
              : "0 0 0 1px rgba(220,76,100,0.08), 0 2px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
            outline: "none",
            cursor: "pointer",
          }}
          initial={{ opacity: 0, scale: 0.7, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.7, y: 12 }}
        >
          {/* Spinner arc when thinking */}
          {isThinking && <SpinnerArc />}

          {/* Icon content — cross-fade between states */}
          <AnimatePresence mode="wait">
            {isSpeaking ? (
              <motion.div
                key="wave"
                initial={{ opacity: 0, scale: 0.75 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.75 }}
                transition={{ duration: 0.2 }}
              >
                <OrbWaveform />
              </motion.div>
            ) : isThinking ? (
              <motion.div
                key="dots"
                initial={{ opacity: 0, scale: 0.75 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.75 }}
                transition={{ duration: 0.2 }}
              >
                <ThinkingDots />
              </motion.div>
            ) : (
              <motion.div
                key="logo"
                initial={{ opacity: 0, scale: 0.75, rotate: -15 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.75, rotate: 15 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <JarvisIcon active={isActive} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Disabled badge */}
        <AnimatePresence>
          {!enabled && (
            <motion.div
              key="badge"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "rgba(0,15,25,0.95)",
                border: "1px solid rgba(220,76,100,0.3)",
                color: "#DC4C64",
                fontSize: 8,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                letterSpacing: "0.03em",
                fontFamily: "monospace",
              }}
            >
              J
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}