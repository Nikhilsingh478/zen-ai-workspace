import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ExternalLink, Sparkles, X } from "lucide-react";
import type { AppDataItem, Website } from "@/lib/store";
import { faviconFor } from "@/lib/store";

interface CommandPaletteProps {
  items: AppDataItem[];
}

export function CommandPalette({ items }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = items
    .filter((item) => {
      const q = query.toLowerCase();
      if (!q) return true;
      if (item.type === "website") {
        return (
          item.name.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.url.toLowerCase().includes(q) ||
          item.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      if (item.type === "prompt") {
        return item.title.toLowerCase().includes(q) || item.body?.toLowerCase().includes(q);
      }
      return false;
    })
    .slice(0, 8);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery("");
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      const item = filtered[selected];
      if (item?.type === "website") {
        window.open(item.url, "_blank", "noopener,noreferrer");
        setOpen(false);
      }
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <motion.div
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#141416] shadow-[0_32px_80px_rgba(0,0,0,0.8)]"
            initial={{ opacity: 0, scale: 0.94, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
              <Search className="h-4 w-4 shrink-0 text-white/40" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search tools, prompts…"
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="text-white/30 hover:text-white/60 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <kbd className="hidden sm:flex items-center rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/30">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="py-2 max-h-72 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-white/30">No results found.</p>
              ) : (
                filtered.map((item, i) => (
                  <button
                    key={item.id}
                    onMouseEnter={() => setSelected(i)}
                    onClick={() => {
                      if (item.type === "website") {
                        window.open(item.url, "_blank", "noopener,noreferrer");
                        setOpen(false);
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                      selected === i ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="h-8 w-8 shrink-0 rounded-lg overflow-hidden bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                      {item.type === "website" ? (
                        <img
                          src={faviconFor((item as Website).url, 32)}
                          alt=""
                          className="h-5 w-5 object-contain"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <Sparkles className="h-4 w-4 text-white/40" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {item.type === "website"
                          ? (item as { name: string }).name
                          : item.type === "prompt"
                            ? (item as { title: string }).title
                            : ""}
                      </div>
                      <div className="text-[11px] text-white/40 truncate">
                        {item.type === "website" ? (item as { url: string }).url : "Prompt"}
                      </div>
                    </div>
                    {item.type === "website" && (
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-white/20" />
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-white/[0.06] px-4 py-2 flex items-center gap-4 text-[10px] text-white/25">
              <span>
                <kbd className="font-mono">↑↓</kbd> navigate
              </span>
              <span>
                <kbd className="font-mono">↵</kbd> open
              </span>
              <span>
                <kbd className="font-mono">ESC</kbd> close
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
