/**
 * JARVIS AI Core — holographic centerpiece.
 * FIX: Clean UI with consistent color palette (Sky blue theme)
 * Removed awkwardly placed circles and cluttered elements
 * Smooth animations with proper centering
 */

import { motion, AnimatePresence } from "framer-motion";
import type { JarvisVoiceState } from "@/lib/jarvis";

// Consistent color palette using CSS variables (matches globals.css)
// Primary: #0EA5E9 (sky-500)
// Accent: #38BDF8 (sky-400)
// Dark: #0284C7 (sky-600)
// Glow: rgba(14, 165, 233, 0.4)

const KEYFRAMES = `
@keyframes jarvis-cw   { to { transform: translate(-50%,-50%) rotate(360deg);  } }
@keyframes jarvis-ccw  { to { transform: translate(-50%,-50%) rotate(-360deg); } }
@keyframes jarvis-sweep { from { transform: rotate(-90deg); } to { transform: rotate(270deg); } }
@keyframes jarvis-pulse-out {
  0%   { transform: translate(-50%,-50%) scale(1);   opacity: 0.5; }
  100% { transform: translate(-50%,-50%) scale(2.2); opacity: 0;   }
}
@keyframes jarvis-orb-breathe {
  0%, 100% { box-shadow: 0 0 24px 6px rgba(14,165,233,0.3), 0 0 60px 12px rgba(14,165,233,0.1); }
  50%       { box-shadow: 0 0 40px 12px rgba(56,189,248,0.45), 0 0 100px 24px rgba(56,189,248,0.15); }
}
@keyframes jarvis-glow-pulse {
  0%, 100% { opacity: 0.4; }
  50%       { opacity: 0.8; }
}
`;

function InjectKeyframes() { return <style>{KEYFRAMES}</style>; }

// Clean rings - fewer, more elegant
const RINGS = [
  { size: "88%", dur: 14, dir: "jarvis-cw",  opacity: 0.35, dashed: false, sw: 1.2 },
  { size: "68%", dur: 22, dir: "jarvis-ccw", opacity: 0.25, dashed: true,  sw: 0.8 },
  { size: "48%", dur: 30, dir: "jarvis-cw",  opacity: 0.2,  dashed: false, sw: 0.6 },
];

function Waveform({ active }: { active: boolean }) {
  const bars = [0.4, 0.65, 0.9, 0.7, 1, 0.75, 0.5, 0.8, 0.6];
  return (
    <div className="flex items-center gap-[3px]" style={{ height: 28 }}>
      {bars.map((base, i) => (
        <motion.div
          key={i}
          style={{
            width: 2.5,
            height: "100%",
            borderRadius: 2,
            background: "var(--jarvis-accent, #38BDF8)",
            originY: "center",
          }}
          animate={active
            ? { scaleY: [base, base * 1.6, base * 0.5, base * 1.3, base], opacity: [0.6, 1, 0.5, 1, 0.6] }
            : { scaleY: 0.15, opacity: 0.35 }}
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
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "var(--jarvis-accent, #38BDF8)",
          }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.3, 0.8] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
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
  const isListening = voiceState === "listening";
  const isProcessing = voiceState === "processing";
  const isSpeaking = voiceState === "speaking";
  const isActive = isAwake || isListening || isProcessing || isSpeaking;
  const speedMul = isActive ? 0.5 : 1;

  return (
    <div className="relative select-none" style={{ width: size, height: size }}>
      <InjectKeyframes />

      {/* Ambient glow - cleaner and smoother */}
      <motion.div
        className="absolute inset-[-15%] rounded-full pointer-events-none"
        animate={{
          opacity: isActive ? 0.6 : 0.2,
          background: isActive
            ? "radial-gradient(circle, rgba(14,165,233,0.12) 0%, rgba(14,165,233,0) 70%)"
            : "radial-gradient(circle, rgba(14,165,233,0.06) 0%, rgba(14,165,233,0) 70%)",
        }}
        transition={{ duration: 0.7 }}
      />

      {/* Rotating rings — clean and minimal */}
      {RINGS.map((ring, idx) => (
        <div
          key={idx}
          style={{
            position: "absolute",
            width: ring.size,
            height: ring.size,
            top: "50%",
            left: "50%",
            borderRadius: "50%",
            border: `${ring.sw}px ${ring.dashed ? "dashed" : "solid"} rgba(14,165,233,${ring.opacity})`,
            animation: `${ring.dir} ${ring.dur * speedMul}s linear infinite`,
            transition: "border-color 0.3s",
          }}
        />
      ))}

      {/* Radar sweep - subtle and elegant */}
      <div
        style={{
          position: "absolute",
          width: "72%",
          height: "72%",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          borderRadius: "50%",
          overflow: "hidden",
          opacity: isActive ? 0.7 : 0.3,
          transition: "opacity 0.3s",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "conic-gradient(from 0deg, transparent 0deg, rgba(56,189,248,0.1) 30deg, transparent 70deg)",
            animation: `jarvis-sweep ${isActive ? "2.8s" : "5s"} linear infinite`,
            transformOrigin: "center",
          }}
        />
      </div>

      {/* Pulse rings - only 2, cleaner */}
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: "28%",
            height: "28%",
            top: "50%",
            left: "50%",
            borderRadius: "50%",
            border: `0.8px solid rgba(56,189,248,${isActive ? 0.5 : 0.25})`,
            animation: `jarvis-pulse-out ${isActive ? 2.2 + i * 0.8 : 3.5 + i * 1.2}s ease-out ${i * (isActive ? 0.7 : 1.0)}s infinite`,
          }}
        />
      ))}

      {/* Center orb — wrapper handles centering */}
      <div
        style={{
          position: "absolute",
          width: "24%",
          height: "24%",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <motion.div
          className="w-full h-full rounded-full"
          style={{
            background: "radial-gradient(circle at 35% 35%, #7DD3FC, #0EA5E9 60%, #0369A1)",
            animation: "jarvis-orb-breathe 2.5s ease-in-out infinite",
            cursor: "pointer",
          }}
          animate={{
            scale: isListening ? 1.12 : isProcessing ? [1, 1.06, 1] : 1,
          }}
          transition={{
            scale: isProcessing
              ? { duration: 0.45, repeat: Infinity, repeatType: "mirror" }
              : { type: "spring", stiffness: 240, damping: 24 },
          }}
        >
          {/* Inner highlight - subtle and elegant */}
          <div
            style={{
              position: "absolute",
              width: "35%",
              height: "35%",
              top: "15%",
              left: "15%",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255,255,255,0.7), transparent)",
            }}
          />
          
          {/* Inner core glow */}
          <div
            style={{
              position: "absolute",
              width: "60%",
              height: "60%",
              top: "20%",
              left: "20%",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(56,189,248,0.4), transparent)",
            }}
          />
        </motion.div>
      </div>

      {/* Minimal HUD brackets - only 4 corners, cleaner positioning */}
      {[
        "top-[6%] left-[6%] border-t border-l",
        "top-[6%] right-[6%] border-t border-r",
        "bottom-[6%] left-[6%] border-b border-l",
        "bottom-[6%] right-[6%] border-b border-r",
      ].map((cls, i) => (
        <div
          key={i}
          className={`absolute ${cls} w-5 h-5`}
          style={{
            borderColor: `rgba(14,165,233,${isActive ? 0.4 : 0.2})`,
            transition: "border-color 0.3s",
          }}
        />
      ))}

      {/* State indicator overlay - centered and clean */}
      <div
        style={{
          position: "absolute",
          bottom: "12%",
          width: "100%",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <AnimatePresence mode="wait">
          {isSpeaking && (
            <motion.div
              key="wave"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18 }}
            >
              <Waveform active />
            </motion.div>
          )}
          {isProcessing && (
            <motion.div
              key="dots"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18 }}
            >
              <ProcessingDots />
            </motion.div>
          )}
          {isListening && !isSpeaking && (
            <motion.div
              key="listen"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18 }}
            >
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
                <span className="text-[11px] text-sky-400/70 font-mono tracking-wider">LISTENING</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Wake word indicator - subtle corner badge when awake */}
      <AnimatePresence>
        {isAwake && !isProcessing && !isSpeaking && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute top-[8%] right-[8%]"
          >
            <div className="text-[9px] font-mono text-sky-400/60 tracking-wider px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 backdrop-blur-sm">
              AWAKE
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}