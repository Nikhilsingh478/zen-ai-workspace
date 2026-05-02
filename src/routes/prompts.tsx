import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Copy, Check, Trash2, FileText, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import {
  MatrixModal,
  fieldClass,
  labelClass,
  primaryButtonClass,
  ghostButtonClass,
} from "@/components/matrix-modal";
import { usePrompts, type Prompt, type PromptInput } from "@/lib/store";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/prompts")({
  head: () => ({
    meta: [
      { title: "Prompts — AI Metrics" },
      { name: "description", content: "Your personal prompt library." },
    ],
  }),
  component: PromptsPage,
});

type SortOption = "newest" | "oldest" | "alpha";

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest",
  oldest: "Oldest",
  alpha: "A–Z",
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045 } },
};

const cardVariant = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
  },
};

function PromptsPage() {
  const { prompts, loaded, add, remove } = usePrompts();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = prompts;

    if (q) {
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.body.toLowerCase().includes(q),
      );
    }

    result = [...result];
    if (sort === "oldest") {
      result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sort === "alpha") {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }
    // "newest" = default server order (descending created_at)

    return result;
  }, [prompts, query, sort]);

  const hasFilters = query || sort !== "newest";

  return (
    <div className="px-4 md:px-10 py-8 md:py-14 max-w-6xl mx-auto">
      <PageHeader
        title="Prompts"
        subtitle={loaded ? `${prompts.length} saved · tap any card to copy` : "Loading…"}
        action={
          <button onClick={() => setOpen(true)} className={primaryButtonClass}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Prompt</span>
            <span className="sm:hidden">New</span>
          </button>
        }
      />

      {!loaded ? (
        <PromptsSkeleton />
      ) : (
        <>
          {/* Search + Sort */}
          <div className="mb-5 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-copy-secondary pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search prompts…"
                className={cn(
                  "w-full pl-9 pr-8 py-2.5 rounded-xl bg-[var(--surface-2)] border border-border",
                  "text-sm text-foreground placeholder:text-copy-muted",
                  "outline-none focus:border-white/20 focus:bg-[var(--surface-3)] transition",
                )}
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Sort pills */}
            <div className="flex items-center gap-1 shrink-0">
              {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setSort(opt)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    sort === opt
                      ? "bg-white text-black"
                      : "bg-white/[0.05] text-copy-secondary hover:text-foreground hover:bg-white/[0.08]",
                  )}
                >
                  {SORT_LABELS[opt]}
                </button>
              ))}
            </div>

            {/* Result count when filtering */}
            {hasFilters && filtered.length !== prompts.length && (
              <span className="text-xs text-copy-secondary shrink-0">
                {filtered.length} of {prompts.length}
              </span>
            )}
          </div>

          {filtered.length === 0 && prompts.length > 0 ? (
            <div className="text-center py-20">
              <p className="text-copy-secondary text-sm">No prompts match "{query}".</p>
              <button
                onClick={() => setQuery("")}
                className="mt-2 text-xs text-copy-secondary underline hover:text-foreground transition"
              >
                Clear search
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState onAdd={() => setOpen(true)} />
          ) : (
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="columns-1 sm:columns-2 lg:columns-3 gap-4 [column-fill:_balance]"
            >
              {filtered.map((p) => (
                <PromptCard key={p.id} prompt={p} onRemove={() => remove(p.id)} />
              ))}
            </motion.div>
          )}
        </>
      )}

      <AddPromptModal open={open} onClose={() => setOpen(false)} onAdd={add} />
    </div>
  );
}

function PromptsSkeleton() {
  const heights = ["h-32", "h-44", "h-36", "h-28", "h-40", "h-32"];
  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 [column-fill:_balance]">
      {heights.map((h, i) => (
        <div
          key={i}
          className={cn("mb-4 break-inside-avoid rounded-2xl bg-white/[0.04] animate-pulse", h)}
          style={{ animationDelay: `${i * 0.06}s` }}
        />
      ))}
    </div>
  );
}

function PromptCard({ prompt, onRemove }: { prompt: Prompt; onRemove: () => void }) {
  const isMobile = useIsMobile();
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const copy = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await navigator.clipboard.writeText(prompt.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) {
      onRemove();
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 2000);
    }
  };

  return (
    <motion.div
      variants={cardVariant}
      whileHover={!isMobile ? { y: -3, transition: { duration: 0.2, ease: "easeOut" } } : undefined}
      onClick={() => { if (isMobile) copy(); }}
      className={cn(
        "group relative mb-4 break-inside-avoid rounded-2xl border border-border",
        "bg-[var(--surface-2)] select-none",
        "transition-all duration-300",
        "hover:border-white/[0.13] hover:bg-[var(--surface-3)]",
        "hover:shadow-[0_24px_48px_-20px_rgba(0,0,0,0.55)]",
        isMobile ? "cursor-default active:scale-[0.99]" : "cursor-pointer",
      )}
    >
      <div className="p-4 md:p-5 pb-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13.5px] font-semibold tracking-tight text-foreground leading-snug flex-1">
            {prompt.title}
          </p>
          {isMobile && (
            <div className="flex items-center gap-1 shrink-0 -mt-0.5">
              <motion.button
                onClick={handleDelete}
                whileTap={{ scale: 0.88 }}
                className={cn(
                  "h-8 w-8 grid place-items-center rounded-xl transition-all duration-200",
                  confirmDelete
                    ? "bg-red-500/20 text-red-400"
                    : "bg-white/[0.06] text-copy-muted active:bg-white/[0.1]",
                )}
                aria-label={confirmDelete ? "Confirm delete" : "Delete prompt"}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </motion.button>
              <motion.button
                onClick={(e) => copy(e)}
                whileTap={{ scale: 0.88 }}
                className="h-8 w-8 grid place-items-center rounded-xl bg-white/[0.06] text-copy-muted active:bg-white/[0.1] transition-all duration-200"
                aria-label="Copy prompt"
              >
                <AnimatePresence mode="wait">
                  {copied ? (
                    <motion.span key="check" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.15 }}>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    </motion.span>
                  ) : (
                    <motion.span key="copy" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.15 }}>
                      <Copy className="h-3.5 w-3.5" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          )}
        </div>
        <div className="my-3 h-px bg-border/60" />
        <p className="text-[12.5px] leading-[1.7] text-copy-secondary whitespace-pre-wrap line-clamp-6 font-mono">
          {prompt.body}
        </p>
      </div>

      <div className="flex items-center justify-between px-4 md:px-5 py-3 border-t border-border/40">
        <AnimatePresence mode="wait">
          {copied ? (
            <motion.span key="copied" initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -4 }} transition={{ duration: 0.15 }} className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
              <Check className="h-3 w-3" /> Copied
            </motion.span>
          ) : (
            <motion.span key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className={cn("text-[11px] text-copy-muted transition-opacity duration-200", isMobile ? "opacity-60" : "opacity-0 group-hover:opacity-100")}>
              {isMobile ? "Tap to copy" : "Click to copy"}
            </motion.span>
          )}
        </AnimatePresence>

        {!isMobile && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <motion.button
              onClick={handleDelete}
              whileTap={{ scale: 0.92 }}
              className={cn(
                "h-7 w-7 grid place-items-center rounded-lg transition-all duration-200",
                confirmDelete
                  ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                  : "text-copy-muted hover:text-foreground hover:bg-white/[0.06]",
              )}
              aria-label={confirmDelete ? "Confirm delete" : "Delete prompt"}
              title={confirmDelete ? "Click again to confirm" : "Delete"}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </motion.button>
            <motion.button
              onClick={(e) => copy(e)}
              whileTap={{ scale: 0.92 }}
              className="h-7 w-7 grid place-items-center rounded-lg text-copy-muted hover:text-foreground hover:bg-white/[0.06] transition-all duration-200"
              aria-label="Copy prompt"
            >
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.span key="check" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} transition={{ duration: 0.15 }}>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  </motion.span>
                ) : (
                  <motion.span key="copy" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} transition={{ duration: 0.15 }}>
                    <Copy className="h-3.5 w-3.5" />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 rounded-2xl ring-1 ring-emerald-400/30 bg-emerald-400/[0.03] pointer-events-none"
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center py-24 md:py-32 text-center"
    >
      <div className="h-14 w-14 rounded-2xl bg-[var(--surface-2)] border border-border grid place-items-center mb-5">
        <FileText className="h-6 w-6 text-copy-secondary" strokeWidth={1.5} />
      </div>
      <p className="text-[15px] font-medium text-foreground">No prompts yet</p>
      <p className="text-[13px] text-copy-secondary mt-1.5 mb-6">
        Save your go-to prompts and copy them instantly
      </p>
      <button onClick={onAdd} className={primaryButtonClass}>
        <Plus className="h-4 w-4" /> Add your first prompt
      </button>
    </motion.div>
  );
}

function AddPromptModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (p: PromptInput) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    onAdd({ title: title.trim(), body: body.trim() });
    setTitle("");
    setBody("");
    onClose();
  };

  const handleClose = () => {
    setTitle("");
    setBody("");
    onClose();
  };

  return (
    <MatrixModal open={open} onClose={handleClose} title="New prompt">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelClass}>Title</label>
          <input
            className={fieldClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What does this prompt do?"
            autoFocus
          />
        </div>
        <div>
          <label className={labelClass}>Prompt</label>
          <textarea
            className={cn(
              fieldClass,
              "min-h-[160px] md:min-h-[200px] resize-none font-mono text-[13px] leading-relaxed",
            )}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your prompt…"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={handleClose} className={ghostButtonClass}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || !body.trim()}
            className={cn(primaryButtonClass, "disabled:opacity-40 disabled:cursor-not-allowed")}
          >
            Save prompt
          </button>
        </div>
      </form>
    </MatrixModal>
  );
}
