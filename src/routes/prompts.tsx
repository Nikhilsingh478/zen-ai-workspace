import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus, Copy, Check, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import {
  MatrixModal,
  fieldClass,
  labelClass,
  primaryButtonClass,
  ghostButtonClass,
} from "@/components/matrix-modal";
import { usePrompts, type Prompt } from "@/lib/store";

export const Route = createFileRoute("/prompts")({
  head: () => ({
    meta: [
      { title: "Prompts — AI Matrix" },
      { name: "description", content: "Your personal prompt library." },
    ],
  }),
  component: PromptsPage,
});

function PromptsPage() {
  const { prompts, add, remove } = usePrompts();
  const [open, setOpen] = useState(false);

  return (
    <div className="px-6 md:px-12 py-10 md:py-14 max-w-7xl mx-auto">
      <PageHeader
        title="Prompts"
        subtitle={`${prompts.length} saved · click any card to copy`}
        action={
          <button onClick={() => setOpen(true)} className={primaryButtonClass}>
            <Plus className="h-4 w-4" /> New Prompt
          </button>
        }
      />

      <div
        className="columns-1 sm:columns-2 lg:columns-3 gap-4 [column-fill:_balance]"
      >
        {prompts.map((p, i) => (
          <PromptCard key={p.id} prompt={p} index={i} onRemove={() => remove(p.id)} />
        ))}
      </div>

      <AddPromptModal open={open} onClose={() => setOpen(false)} onAdd={add} />
    </div>
  );
}

function PromptCard({
  prompt,
  index,
  onRemove,
}: {
  prompt: Prompt;
  index: number;
  onRemove: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* noop */
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.3), ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      className="group relative mb-4 break-inside-avoid rounded-2xl border border-border bg-[var(--surface-2)] p-5 transition-all duration-300 hover:bg-[var(--surface-3)] hover:border-white/[0.12] hover:shadow-[0_20px_50px_-25px_rgba(0,0,0,0.6)]"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[14.5px] font-semibold tracking-tight pr-8 text-foreground">{prompt.title}</h3>
        <div className="absolute top-3.5 right-3.5 flex items-center gap-1">
          <button
            onClick={onRemove}
            className="h-7 w-7 grid place-items-center rounded-lg text-copy-secondary hover:text-foreground hover:bg-white/[0.06] transition"
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={copy}
            className="h-7 w-7 grid place-items-center rounded-lg text-copy-secondary hover:text-foreground hover:bg-white/[0.06] transition"
            aria-label="Copy prompt"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-copy-secondary whitespace-pre-wrap line-clamp-6">
        {prompt.body}
      </p>
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
  onAdd: (p: Omit<Prompt, "id">) => void;
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

  return (
    <MatrixModal open={open} onClose={onClose} title="New prompt">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelClass}>Title</label>
          <input className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What this prompt does" autoFocus />
        </div>
        <div>
          <label className={labelClass}>Prompt</label>
          <textarea className={fieldClass + " min-h-[180px] resize-none"} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your prompt…" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={ghostButtonClass}>Cancel</button>
          <button type="submit" className={primaryButtonClass}>Save prompt</button>
        </div>
      </form>
    </MatrixModal>
  );
}