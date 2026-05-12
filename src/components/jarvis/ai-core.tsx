/**
 * JARVIS AI Core — holographic centerpiece.
 * FIX: orb now uses a wrapper div for correct centering so Framer Motion
 * scale animations don't fight the translate(-50%,-50%) transform.
 */

import { motion, AnimatePresence } from "framer-motion";
import type { JarvisVoiceState } from "@/lib/jarvis";

const KEYFRAMES = `
@keyframes jarvis-cw   { to { transform: translate(-50%,-50%) rotate(360deg);  } }
@keyframes jarvis-ccw  { to { transform: translate(-50%,-50%) rotate(-360deg); } }
@keyframes jarvis-sweep { from { transform: rotate(-90deg); } to { transform: rotate(270deg); } }
@keyframes jarvis-pulse-out {
  0%   { transform: translate(-50%,-50%) scale(1);   opacity: 0.65; }
  100% { transform: translate(-50%,-50%) scale(2.6); opacity: 0;   }
}
@keyframes jarvis-orb-breathe {
  0%, 100% { box-shadow: 0 0 28px 6px rgba(0,191,255,0.38), 0 0 80px 18px rgba(0,191,255,0.12); }
  50%       { box-shadow: 0 0 52px 14px rgba(0,191,255,0.58), 0 0 130px 32px rgba(0,191,255,0.22); }
}
`;

function InjectKeyframes() { return <style>{KEYFRAMES}</style>; }

const RINGS = [
  { size: "94%", dur: 11,  dir: "jarvis-cw",  opacity: 0.55, dashed: false, sw: 1.5 },
  { size: "80%", dur: 17,  dir: "jarvis-ccw", opacity: 0.40, dashed: true,  sw: 1   },
  { size: "66%", dur: 25,  dir: "jarvis-cw",  opacity: 0.33, dashed: false, sw: 1   },
  { size: "52%", dur: 34,  dir: "jarvis-ccw", opacity: 0.26, dashed: true,  sw: 0.8 },
  { size: "38%", dur: 9,   dir: "jarvis-cw",  opacity: 0.45, dashed: false, sw: 1   },
];

function Waveform({ active }: { active: boolean }) {
  const bars = [0.35, 0.6, 0.9, 0.7, 1, 0.75, 0.5, 0.85, 0.65, 0.4, 0.55, 0.8, 0.45];
  return (
    <div className="flex items-center gap-[3px]" style={{ height: 30 }}>
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

interface AICoreProps {
  voiceState: JarvisVoiceState;
  isAwake: boolean;
  size?: number;
}

export function AICore({ voiceState, isAwake, size = 320 }: AICoreProps) {
  const isListening  = voiceState === "listening";
  const isProcessing = voiceState === "processing";
  const isSpeaking   = voiceState === "speaking";
  const isActive     = isAwake || isListening || isProcessing || isSpeaking;
  const speedMul     = isActive ? 0.55 : 1;

  return (
    <div className="relative select-none" style={{ width: size, height: size }}>
      <InjectKeyframes />

      {/* Ambient glow */}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        animate={{ opacity: isActive ? 1 : 0.35 }}
        transition={{ duration: 0.9 }}
        style={{ background: "radial-gradient(circle, rgba(0,191,255,0.09) 0%, transparent 70%)" }}
      />

      {/* Rotating rings — all correctly centered with translate(-50%,-50%) baked into keyframes */}
      {RINGS.map((ring, idx) => (
        <div
          key={idx}
          style={{
            position: "absolute",
            width: ring.size, height: ring.size,
            top: "50%", left: "50%",
            borderRadius: "50%",
            border: `${ring.sw}px ${ring.dashed ? "dashed" : "solid"} rgba(0,191,255,${ring.opacity})`,
            animation: `${ring.dir} ${ring.dur * speedMul}s linear infinite`,
            boxShadow: isActive ? "0 0 8px rgba(0,191,255,0.14)" : "none",
            transition: "box-shadow 0.6s",
          }}
        />
      ))}

      {/* Radar sweep */}
      <div
        style={{
          position: "absolute",
          width: "80%", height: "80%",
          top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
          borderRadius: "50%",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute", inset: 0,
            background: "conic-gradient(from 0deg, transparent 0deg, rgba(0,191,255,0.13) 30deg, transparent 60deg)",
            animation: `jarvis-sweep ${isActive ? "3s" : "5.5s"} linear infinite`,
            transformOrigin: "center",
          }}
        />
      </div>

      {/* Pulse rings */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: "34%", height: "34%",
            top: "50%", left: "50%",
            borderRadius: "50%",
            border: "1px solid rgba(0,191,255,0.42)",
            animation: `jarvis-pulse-out ${isActive ? 1.8 + i * 0.7 : 3.2 + i * 1.1}s ease-out ${i * (isActive ? 0.6 : 1.0)}s infinite`,
          }}
        />
      ))}

      {/* Center orb — wrapper handles centering, motion.div handles scale */}
      <div
        style={{
          position: "absolute",
          width: "22%", height: "22%",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <motion.div
          className="w-full h-full rounded-full"
          style={{
            background: "radial-gradient(circle at 35% 35%, #6ef6ff, #00BFFF 50%, #003060)",
            animation: "jarvis-orb-breathe 3s ease-in-out infinite",
          }}
          animate={{
            scale: isListening ? 1.14 : isProcessing ? [1, 1.07, 1] : 1,
          }}
          transition={{
            scale: isProcessing
              ? { duration: 0.5, repeat: Infinity, repeatType: "mirror" }
              : { type: "spring", stiffness: 220, damping: 22 },
          }}
        >
          {/* Inner highlight */}
          <div
            style={{
              position: "absolute",
              width: "40%", height: "40%",
              top: "18%", left: "20%",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255,255,255,0.65), transparent)",
            }}
          />
        </motion.div>
      </div>

      {/* Cross-hair lines */}
      <div style={{ position:"absolute", width:"60%", height:1, top:"50%", left:"50%", transform:"translate(-50%,-50%)", background:"rgba(0,191,255,0.07)" }} />
      <div style={{ position:"absolute", height:"60%", width:1, top:"50%", left:"50%", transform:"translate(-50%,-50%)", background:"rgba(0,191,255,0.07)" }} />

      {/* Corner HUD brackets */}
      {(["top-[8%] left-[8%] border-t border-l","top-[8%] right-[8%] border-t border-r","bottom-[8%] left-[8%] border-b border-l","bottom-[8%] right-[8%] border-b border-r"] as const).map((cls, i) => (
        <div key={i} className={`absolute ${cls} w-4 h-4`} style={{ borderColor: "rgba(0,191,255,0.32)" }} />
      ))}

      {/* State overlay */}
      <div style={{ position:"absolute", bottom:"13%", width:"100%", display:"flex", justifyContent:"center" }}>
        <AnimatePresence mode="wait">
          {isSpeaking && (
            <motion.div key="wave" initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:4 }} transition={{ duration:0.2 }}>
              <Waveform active />
            </motion.div>
          )}
          {isProcessing && (
            <motion.div key="dots" initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:4 }} transition={{ duration:0.2 }}>
              <ProcessingDots />
            </motion.div>
          )}
          {isListening && (
            <motion.div key="listen" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
              <Waveform active={false} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
