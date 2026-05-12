import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Brain, Save, UserCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/context")({
  component: ContextPage,
});

function ContextPage() {
  const [contextText, setContextText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("jarvis:user-context");
      if (saved) setContextText(saved);
    } catch {
      // ignore
    }
  }, []);

  const handleSave = () => {
    setIsSaving(true);
    try {
      localStorage.setItem("jarvis:user-context", contextText);
      toast.success("Personal context updated for J.A.R.V.I.S.");
    } catch {
      toast.error("Failed to save context");
    } finally {
      setTimeout(() => setIsSaving(false), 400);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col px-4 md:px-8 pt-5 md:pt-8 pb-8 relative">
      {/* Background radial */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(125,211,252,0.04),transparent)]" />
      
      <div className="relative z-10 max-w-4xl mx-auto w-full flex-1 flex flex-col">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-3 mb-6 shrink-0"
        >
          <div className="h-10 w-10 rounded-xl bg-white/[0.04] border border-white/[0.07] grid place-items-center">
            <Brain className="h-5 w-5 text-white/40" />
          </div>
          <div>
            <h1 className="text-[18px] font-semibold tracking-tight text-white/90">Context Window</h1>
            <p className="text-[11px] text-white/40 mt-0.5 tracking-wide">Teach JARVIS about your life, preferences, and emotional state.</p>
          </div>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 flex flex-col bg-[var(--surface-1)] border border-white/[0.06] rounded-2xl overflow-hidden shadow-sm"
        >
          <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]">
            <UserCircle className="h-4 w-4 text-white/40" />
            <h2 className="text-[13px] font-medium text-white/70">Personal Database</h2>
          </div>
          
          <div className="flex-1 p-5 flex flex-col">
            <textarea
              value={contextText}
              onChange={(e) => setContextText(e.target.value)}
              placeholder="E.g., I am currently focusing on building my startup. I prefer concise answers but appreciate a supportive tone when I'm stressed. I live in New York and my main hobbies are coding and reading sci-fi."
              className="flex-1 w-full resize-none bg-transparent outline-none text-[14px] leading-relaxed text-white/80 placeholder:text-white/20"
              spellCheck="false"
            />
          </div>

          <div className="px-5 py-4 border-t border-white/[0.06] bg-white/[0.01] flex items-center justify-between">
            <p className="text-[10px] text-white/30 hidden sm:block">
              This context is injected into J.A.R.V.I.S.'s memory on every interaction.
            </p>
            <motion.button
              onClick={handleSave}
              disabled={isSaving}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground text-background text-[12px] font-semibold transition-all disabled:opacity-50 sm:ml-auto"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? "Saving..." : "Save Context"}
            </motion.button>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
