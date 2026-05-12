/**
 * JARVIS Floating Orb — global persistent widget shown on all non-JARVIS pages.
 * Reacts to wake word and JARVIS state. Click to open the JARVIS tab.
 * 
 * FIXES APPLIED:
 * 1. Consistent color palette throughout - using CSS variables defined in globals.css
 * 2. Fixed orb UI - removed awkwardly placed circles, cleaned up structure
 * 3. Fixed auto-standby issue - mic is now persistent once permission granted
 * 4. Removed auto-mic-toggle on mount - mic only activates on wake word or explicit action
 * 5. Cleaned up cluttered orb design - minimal, elegant, responsive
 */

import { motion, AnimatePresence } from "framer-motion";
import { useRouterState, useNavigate } from "@tanstack/react-router";
import { useJarvis, jarvis } from "@/lib/jarvis";

// Consistent color palette using CSS variables (defined in globals.css)
// Primary: #0EA5E9 (sky-500)
// Accent: #38BDF8 (sky-400)
// Glow: rgba(14, 165, 233, 0.4)
// Dark overlay: rgba(2, 6, 23, 0.85)

const STYLE = `
@keyframes jarvis-orb-pulse {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.5); opacity: 0; }
}
@keyframes jarvis-orb-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes jarvis-soft-glow {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.8; }
}
`;

function OrbWaveform({ active }: { active: boolean }) {
  const bars = [0.3, 0.6, 1, 0.8, 0.4];
  return (
    <div className="flex items-center gap-[3px]" style={{ height: 16 }}>
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
            ? { scaleY: [base, base * 1.8, base * 0.6, base], opacity: [0.6, 1, 0.5, 0.6] }
            : { scaleY: 0.2, opacity: 0.3 }}
          transition={active
            ? { duration: 0.6 + i * 0.08, repeat: Infinity, repeatType: "mirror", delay: i * 0.06 }
            : { duration: 0.2 }}
        />
      ))}
    </div>
  );
}

function JarvisLogo({ active }: { active: boolean }) {
  const strokeColor = active ? "var(--jarvis-accent, #38BDF8)" : "var(--jarvis-primary, #0EA5E9)";
  const fillColor = active ? "var(--jarvis-accent, #38BDF8)" : "rgba(14, 165, 233, 0.4)";
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="7.5" stroke={strokeColor} strokeWidth="1.2" strokeOpacity={active ? 1 : 0.7} />
      <circle cx="10" cy="10" r="3.5" fill={fillColor} fillOpacity={active ? 0.9 : 0.5} />
      <path d="M10 3L10 6.5" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M10 13.5L10 17" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M3 10L6.5 10" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M13.5 10L17 10" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function JarvisFloatingOrb() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { voiceState, isAwake, enabled, isReady } = useJarvis();

  // Don't render when the user is already on the JARVIS page
  if (pathname === "/jarvis") return null;

  const isListening = voiceState === "listening";
  const isThinking = voiceState === "processing";
  const isSpeaking = voiceState === "speaking";
  const isActive = isAwake || isListening || isSpeaking;

  const handleClick = () => {
    // If JARVIS is active and enabled, just dismiss/stop listening
    if (isActive && enabled) {
      jarvis.dismiss();
    } else {
      // Otherwise navigate to JARVIS page
      void navigate({ to: "/jarvis" });
    }
  };

  // Don't show if not ready or disabled (but keep minimal indicator)
  if (!enabled && !isReady) return null;

  return (
    <>
      <style>{STYLE}</style>

      {/* Fixed bottom-right — above the mobile nav bar on small screens */}
      <div className="fixed z-[55] bottom-[5.5rem] right-4 md:bottom-6 md:right-6">
        <div className="relative">
          {/* Pulse rings - clean and minimal, only when active */}
          <AnimatePresence>
            {(isActive || isSpeaking) && (
              <>
                <motion.div
                  key="pulse1"
                  initial={{ scale: 1, opacity: 0.4 }}
                  animate={{ scale: 1.8, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut", delay: 0 }}
                  className="absolute inset-0 rounded-full border-2 border-[var(--jarvis-primary,#0EA5E9)]"
                />
                <motion.div
                  key="pulse2"
                  initial={{ scale: 1, opacity: 0.3 }}
                  animate={{ scale: 2.2, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
                  className="absolute inset-0 rounded-full border border-[var(--jarvis-accent,#38BDF8)]"
                />
              </>
            )}
          </AnimatePresence>

          {/* Ambient glow when active - soft and elegant */}
          <AnimatePresence>
            {isActive && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-[-10px] rounded-full pointer-events-none"
                style={{
                  background: "radial-gradient(circle, rgba(14,165,233,0.15) 0%, rgba(14,165,233,0) 70%)",
                }}
              />
            )}
          </AnimatePresence>

          {/* Main orb button - clean and modern */}
          <motion.button
            onClick={handleClick}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className="relative h-12 w-12 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm"
            aria-label="Open JARVIS"
            style={{
              background: isActive
                ? "radial-gradient(circle at 30% 30%, var(--jarvis-accent,#38BDF8), var(--jarvis-primary,#0EA5E9) 70%)"
                : "radial-gradient(circle at 30% 30%, rgba(14,165,233,0.7), rgba(2,6,23,0.9))",
              border: `1.5px solid ${
                isActive ? "rgba(56,189,248,0.9)" : "rgba(14,165,233,0.3)"
              }`,
              boxShadow: isActive
                ? "0 0 20px rgba(14,165,233,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"
                : "0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            {/* Spinner ring when thinking - clean spin effect */}
            {isThinking && (
              <div
                className="absolute inset-[-2px] rounded-full border-2 border-transparent"
                style={{
                  borderTopColor: "var(--jarvis-accent, #38BDF8)",
                  animation: "jarvis-orb-spin 0.8s linear infinite",
                }}
              />
            )}

            {/* Dynamic icon content based on state */}
            <AnimatePresence mode="wait">
              {isSpeaking ? (
                <motion.div
                  key="wave"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                >
                  <OrbWaveform active />
                </motion.div>
              ) : isThinking ? (
                <motion.div
                  key="think"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex gap-[3px]"
                >
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="h-[4px] w-[4px] rounded-full"
                      style={{ background: "white" }}
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.3, 0.8] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="logo"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                >
                  <JarvisLogo active={isActive} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Status indicator dot - when listening but not fully active */}
          {isListening && !isAwake && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-[#10B981] border border-[#064E3B]"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}

          {/* "Ready" badge when JARVIS is enabled but inactive */}
          {enabled && !isActive && !isReady && (
            <div
              className="absolute -top-1 -right-1 h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-bold"
              style={{
                background: "rgba(2,6,23,0.9)",
                border: "1px solid var(--jarvis-primary, #0EA5E9)",
                color: "var(--jarvis-primary, #0EA5E9)",
              }}
            >
              J
            </div>
          )}
        </div>
      </div>
    </>
  );
}