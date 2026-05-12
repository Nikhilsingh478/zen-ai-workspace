/**
 * JARVIS Floating Orb — global persistent widget shown on all non-JARVIS pages.
 * Reacts to wake word and JARVIS state. Click to open the JARVIS tab.
 */

import { motion, AnimatePresence } from "framer-motion";
import { useRouterState, useNavigate } from "@tanstack/react-router";
import { useJarvis, jarvis } from "@/lib/jarvis";

const STYLE = `
@keyframes jarvis-orb-pulse {
  0%, 100% { transform: scale(1);   opacity: 0.55; }
  50%       { transform: scale(1.7); opacity: 0;    }
}
@keyframes jarvis-orb-spin {
  from { transform: rotate(0deg);   }
  to   { transform: rotate(360deg); }
}
`;

function OrbWaveform({ active }: { active: boolean }) {
  const bars = [0.4, 0.7, 1, 0.8, 0.5];
  return (
    <div className="flex items-center gap-[2px]" style={{ height: 14 }}>
      {bars.map((base, i) => (
        <motion.div
          key={i}
          style={{ width: 2, height: "100%", borderRadius: 1, background: "#00BFFF", originY: "center" }}
          animate={active
            ? { scaleY: [base, base * 2, base * 0.5, base], opacity: [0.7, 1, 0.6, 0.7] }
            : { scaleY: 0.25, opacity: 0.4 }}
          transition={active
            ? { duration: 0.5 + i * 0.1, repeat: Infinity, repeatType: "mirror", delay: i * 0.07 }
            : { duration: 0.2 }}
        />
      ))}
    </div>
  );
}

function JarvisLogo({ active }: { active: boolean }) {
  const color = active ? "#4DEBFF" : "rgba(0,191,255,0.7)";
  const fill  = active ? "#00BFFF" : "rgba(0,191,255,0.5)";
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7"   stroke={color} strokeWidth="1.2" />
      <circle cx="9" cy="9" r="3.5" fill={fill} />
      <line x1="9" y1="2" x2="9" y2="6"   stroke={color} strokeWidth="1" />
      <line x1="9" y1="12" x2="9" y2="16" stroke={color} strokeWidth="1" />
      <line x1="2" y1="9" x2="6"  y2="9"  stroke={color} strokeWidth="1" />
      <line x1="12" y1="9" x2="16" y2="9" stroke={color} strokeWidth="1" />
    </svg>
  );
}

export function JarvisFloatingOrb() {
  const pathname  = useRouterState({ select: (s) => s.location.pathname });
  const navigate  = useNavigate();
  const { voiceState, isAwake, enabled } = useJarvis();

  // Don't render when the user is already on the JARVIS page
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
    <>
      <style>{STYLE}</style>

      {/* Fixed bottom-right — above the mobile nav bar on small screens */}
      <div className="fixed z-[55] bottom-[5.5rem] right-4 md:bottom-6 md:right-6">
        <div className="relative">
          {/* Pulse rings — shown only when active/speaking */}
          {(isActive || isSpeaking) && [0, 1].map((i) => (
            <div
              key={i}
              className="absolute inset-0 rounded-full border border-[rgba(0,191,255,0.4)]"
              style={{ animation: `jarvis-orb-pulse ${1.4 + i * 0.65}s ease-out ${i * 0.5}s infinite` }}
            />
          ))}

          {/* Ambient glow when active */}
          <AnimatePresence>
            {isActive && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-[-8px] rounded-full pointer-events-none"
                style={{ boxShadow: "0 0 24px 8px rgba(0,191,255,0.25)" }}
              />
            )}
          </AnimatePresence>

          {/* Main button */}
          <motion.button
            onClick={handleClick}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.93 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="relative h-11 w-11 rounded-full flex items-center justify-center"
            aria-label="Open JARVIS"
            style={{
              background: isActive
                ? "radial-gradient(circle at 35% 35%, #4DEBFF, #00BFFF 50%, #003060)"
                : "radial-gradient(circle at 35% 35%, rgba(0,191,255,0.55), rgba(0,30,60,0.95))",
              border: `1.5px solid ${isActive ? "rgba(0,191,255,0.8)" : "rgba(0,191,255,0.22)"}`,
              boxShadow: isActive
                ? "0 0 20px rgba(0,191,255,0.5), inset 0 1px 0 rgba(255,255,255,0.15)"
                : "0 0 10px rgba(0,191,255,0.12), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            {/* Spinner ring when thinking */}
            {isThinking && (
              <div
                className="absolute inset-[-3px] rounded-full border-2 border-transparent"
                style={{ borderTopColor: "#00BFFF", animation: "jarvis-orb-spin 0.9s linear infinite" }}
              />
            )}

            {/* Icon content — state-reactive */}
            <AnimatePresence mode="wait">
              {isSpeaking ? (
                <motion.div key="wave" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}>
                  <OrbWaveform active />
                </motion.div>
              ) : isThinking ? (
                <motion.div key="think" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-[3px]">
                  {[0, 1, 2].map((i) => (
                    <motion.div key={i} className="h-[3px] w-[3px] rounded-full" style={{ background: "#00BFFF" }}
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                      transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.2 }} />
                  ))}
                </motion.div>
              ) : (
                <motion.div key="logo" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                  <JarvisLogo active={isActive} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* "J" badge when JARVIS is not enabled */}
          {!enabled && (
            <div
              className="absolute -top-1 -right-1 h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-bold"
              style={{ background: "rgba(0,17,27,0.9)", border: "1px solid rgba(0,191,255,0.3)", color: "#00BFFF" }}
            >
              J
            </div>
          )}
        </div>
      </div>
    </>
  );
}
