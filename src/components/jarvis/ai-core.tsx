import { motion } from "framer-motion";
import { Mic } from "lucide-react";
import type { JarvisVoiceState } from "@/lib/jarvis";

interface AICoreProps {
  voiceState: JarvisVoiceState;
  isAwake: boolean;
  size?: number;
  onClick?: () => void;
}

export function AICore({ voiceState, isAwake: _isAwake, size = 120, onClick }: AICoreProps) {
  const isListening  = voiceState === "listening";
  const isProcessing = voiceState === "processing";
  const isSpeaking   = voiceState === "speaking";

  const borderColor = isListening
    ? "rgba(56,189,248,0.4)"
    : isProcessing
    ? "rgba(251,191,36,0.25)"
    : isSpeaking
    ? "rgba(52,211,153,0.25)"
    : "rgba(255,255,255,0.08)";

  const glowColor = isListening
    ? "rgba(56,189,248,0.15)"
    : isProcessing
    ? "rgba(251,191,36,0.08)"
    : isSpeaking
    ? "rgba(52,211,153,0.08)"
    : "rgba(56,189,248,0.06)";

  const micColor = isListening
    ? "#38bdf8"
    : isSpeaking
    ? "#34d399"
    : isProcessing
    ? "#fbbf24"
    : "#52525b";

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {isProcessing && (
        <motion.div
          style={{
            position: "absolute",
            inset: -3,
            borderRadius: "50%",
            border: "1px dashed rgba(251,191,36,0.3)",
            pointerEvents: "none",
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
        />
      )}

      <motion.div
        onClick={onClick}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: onClick ? "pointer" : "default",
          background: "radial-gradient(circle, rgba(56,189,248,0.04) 0%, transparent 70%)",
          position: "relative",
          border: `1px solid ${borderColor}`,
          boxShadow: `0 0 40px ${glowColor}, inset 0 0 20px rgba(56,189,248,0.02)`,
          transition: "border-color 0.3s ease, box-shadow 0.3s ease",
        }}
        animate={isSpeaking ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={
          isSpeaking
            ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.3 }
        }
      >
        <motion.div
          animate={{ color: micColor }}
          transition={{ duration: 0.2 }}
          style={{ color: micColor, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <Mic size={Math.round(size * 0.25)} />
        </motion.div>
      </motion.div>
    </div>
  );
}
