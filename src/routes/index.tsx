import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus, ExternalLink, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import {
  MatrixModal,
  fieldClass,
  labelClass,
  primaryButtonClass,
  ghostButtonClass,
} from "@/components/matrix-modal";
import { faviconFor, getDomain, useWebsites, type Website, type WebsiteInput } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Websites — AI Metrics" },
      { name: "description", content: "Your curated directory of AI tools and websites." },
    ],
  }),
  component: Index,
});

function Index() {
  const { websites, add, remove } = useWebsites();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return websites;
    return websites.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        w.url.toLowerCase().includes(q) ||
        w.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [websites, query]);

  return (
    <div className="px-6 md:px-12 py-10 md:py-14 max-w-7xl mx-auto">
      <PageHeader
        title="Websites"
        subtitle={`${websites.length} tools in your library`}
        action={
          <button onClick={() => setOpen(true)} className={primaryButtonClass}>
            <Plus className="h-4 w-4" /> Add Website
          </button>
        }
      />

      <div className="mb-8">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, tag, or URL…"
          className={fieldClass + " max-w-md"}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((w, i) => (
          <WebsiteCard key={w.id} website={w} index={i} onRemove={() => remove(w.id)} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-copy-secondary py-20 text-sm">
            Nothing matches "{query}".
          </div>
        )}
      </div>

      <AddWebsiteModal open={open} onClose={() => setOpen(false)} onAdd={add} />
    </div>
  );
}

function WebsiteCard({
  website,
  index,
  onRemove,
}: {
  website: Website;
  index: number;
  onRemove: () => void;
}) {
  return (
    <motion.a
      href={website.url}
      target="_blank"
      rel="noreferrer"
      initial={{ opacity: 0.9, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.25), ease: "easeOut" }}
      whileHover={{ y: -2 }}
      className="group relative rounded-2xl border border-border bg-[var(--surface-2)] p-5 transition-all duration-300 hover:bg-[var(--surface-3)] hover:border-white/[0.12] hover:shadow-[0_20px_50px_-25px_rgba(0,0,0,0.6)]"
    >
      <div className="flex items-start gap-3.5">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-[var(--surface-3)] grid place-items-center overflow-hidden border border-border">
          <img src={faviconFor(website.url, 64)} alt="" className="h-6 w-6" loading="lazy" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold tracking-tight truncate text-foreground">
              {website.name}
            </h3>
            <ExternalLink className="h-3.5 w-3.5 text-copy-secondary group-hover:text-foreground transition" />
          </div>
          <p className="text-xs text-copy-secondary mt-0.5 truncate">{getDomain(website.url)}</p>
        </div>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="h-7 w-7 grid place-items-center rounded-lg text-copy-secondary hover:text-foreground hover:bg-white/[0.06] transition"
          aria-label="Remove"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-copy-secondary line-clamp-3">
        {website.description}
      </p>

      {website.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {website.tags.map((t) => (
            <span
              key={t}
              className="text-[10px] uppercase tracking-wider text-copy-secondary px-2 py-1 rounded-md bg-[var(--surface-3)] border border-border"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </motion.a>
  );
}

function AddWebsiteModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (w: WebsiteInput) => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");

  const reset = () => {
    setName("");
    setUrl("");
    setDescription("");
    setTags("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    onAdd({
      name: name.trim(),
      url: normalized,
      description: description.trim(),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    reset();
    onClose();
  };

  return (
    <MatrixModal open={open} onClose={onClose} title="Add a website">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelClass}>Name</label>
          <input
            className={fieldClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ChatGPT"
            autoFocus
          />
        </div>
        <div>
          <label className={labelClass}>URL</label>
          <input
            className={fieldClass}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://chat.openai.com"
          />
        </div>
        <div>
          <label className={labelClass}>Description</label>
          <textarea
            className={fieldClass + " min-h-[88px] resize-none"}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What it's good for…"
          />
        </div>
        <div>
          <label className={labelClass}>Tags (comma-separated)</label>
          <input
            className={fieldClass}
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="chat, writing"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={ghostButtonClass}>
            Cancel
          </button>
          <button type="submit" className={primaryButtonClass}>
            Add website
          </button>
        </div>
      </form>
    </MatrixModal>
  );
}
