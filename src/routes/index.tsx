import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus, ExternalLink, Trash2, Pencil, Search, X, ChevronDown } from "lucide-react";
import { useMemo, useState, useRef, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import {
  MatrixModal,
  fieldClass,
  labelClass,
  primaryButtonClass,
  ghostButtonClass,
} from "@/components/matrix-modal";
import { faviconFor, getDomain, useWebsites, type Website, type WebsiteInput } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Websites — AI Metrics" },
      { name: "description", content: "Your curated directory of AI tools and websites." },
    ],
  }),
  component: Index,
});

type SortOption = "default" | "name-asc" | "name-desc" | "oldest";

const SORT_LABELS: Record<SortOption, string> = {
  default: "Newest",
  "name-asc": "Name A–Z",
  "name-desc": "Name Z–A",
  oldest: "Oldest",
};

function Index() {
  const { websites, loaded, add, update, remove } = useWebsites();
  const [open, setOpen] = useState(false);
  const [editingWebsite, setEditingWebsite] = useState<Website | null>(null);
  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortOption>("default");
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close sort dropdown when clicking outside
  useEffect(() => {
    if (!sortOpen) return;
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [sortOpen]);

  // Collect all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    websites.forEach((w) => w.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [websites]);

  const toggleTag = (tag: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = websites;

    // Text search
    if (q) {
      result = result.filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          w.description.toLowerCase().includes(q) ||
          w.url.toLowerCase().includes(q) ||
          w.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    // Tag filter (AND logic — item must have ALL active tags)
    if (activeTags.size > 0) {
      result = result.filter((w) => [...activeTags].every((t) => w.tags.includes(t)));
    }

    // Sort
    result = [...result];
    if (sort === "name-asc") result.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "name-desc") result.sort((a, b) => b.name.localeCompare(a.name));
    else if (sort === "oldest")
      result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    // "default" = newest first (server returns newest first already)

    return result;
  }, [websites, query, activeTags, sort]);

  const clearFilters = () => {
    setQuery("");
    setActiveTags(new Set());
    setSort("default");
  };

  const hasFilters = query || activeTags.size > 0 || sort !== "default";

  return (
    <div className="px-6 md:px-12 py-10 md:py-14 max-w-7xl mx-auto">
      <PageHeader
        title="Websites"
        subtitle={loaded ? `${websites.length} tools in your library` : "Loading…"}
        action={
          <button onClick={() => setOpen(true)} className={primaryButtonClass}>
            <Plus className="h-4 w-4" /> Add Website
          </button>
        }
      />

      {!loaded ? (
        <WebsitesSkeleton />
      ) : (
        <>
          {/* Search + Sort row */}
          <div className="mb-4 flex flex-col sm:flex-row gap-3">
            {/* Search input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-copy-secondary pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, tag, or URL…"
                className={cn(
                  fieldClass,
                  "pl-9 pr-8",
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

            {/* Sort dropdown */}
            <div ref={sortRef} className="relative shrink-0">
              <button
                onClick={() => setSortOpen((v) => !v)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition whitespace-nowrap",
                  sort !== "default"
                    ? "border-white/20 bg-white/[0.07] text-foreground"
                    : "border-border bg-[var(--surface-2)] text-copy-secondary hover:text-foreground hover:border-white/15",
                )}
              >
                {SORT_LABELS[sort]}
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-150",
                    sortOpen && "rotate-180",
                  )}
                />
              </button>
              {sortOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[140px] rounded-xl border border-white/10 bg-[#18181B] shadow-[0_8px_30px_rgba(0,0,0,0.6)] py-1 overflow-hidden">
                  {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => {
                        setSort(opt);
                        setSortOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm transition-colors",
                        sort === opt
                          ? "text-white bg-white/[0.08]"
                          : "text-white/60 hover:text-white hover:bg-white/[0.05]",
                      )}
                    >
                      {SORT_LABELS[opt]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Clear filters */}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 text-sm text-copy-secondary hover:text-foreground transition shrink-0 px-1"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>

          {/* Tag filter pills */}
          {allTags.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-1.5">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-lg border transition-colors",
                    activeTags.has(tag)
                      ? "bg-white text-black border-white font-semibold"
                      : "bg-transparent text-copy-secondary border-border hover:border-white/20 hover:text-foreground",
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Results count when filtering */}
          {hasFilters && (
            <p className="text-xs text-copy-secondary mb-4">
              {filtered.length} of {websites.length} results
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((w, i) => (
              <WebsiteCard
                key={w.id}
                website={w}
                index={i}
                onRemove={() => remove(w.id)}
                onEdit={() => setEditingWebsite(w)}
              />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center text-copy-secondary py-20 text-sm">
                Nothing matches your filters.{" "}
                <button onClick={clearFilters} className="underline hover:text-foreground">
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <AddWebsiteModal open={open} onClose={() => setOpen(false)} onAdd={add} />

      {editingWebsite && (
        <EditWebsiteModal
          website={editingWebsite}
          onClose={() => setEditingWebsite(null)}
          onSave={(input) => {
            update(editingWebsite.id, input);
            setEditingWebsite(null);
          }}
        />
      )}
    </div>
  );
}

function WebsitesSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="h-36 rounded-2xl bg-white/[0.04] animate-pulse"
          style={{ animationDelay: `${i * 0.05}s` }}
        />
      ))}
    </div>
  );
}

function WebsiteCard({
  website,
  index,
  onRemove,
  onEdit,
}: {
  website: Website;
  index: number;
  onRemove: () => void;
  onEdit: () => void;
}) {
  const [faviconError, setFaviconError] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0.9, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.25), ease: "easeOut" }}
      whileHover={{ y: -2 }}
      className="group relative rounded-2xl border border-border bg-[var(--surface-2)] p-5 transition-all duration-300 hover:bg-[var(--surface-3)] hover:border-white/[0.12] hover:shadow-[0_20px_50px_-25px_rgba(0,0,0,0.6)]"
    >
      <div className="flex items-start gap-3.5">
        <a
          href={website.url}
          target="_blank"
          rel="noreferrer"
          tabIndex={-1}
          className="h-10 w-10 shrink-0 rounded-xl bg-[var(--surface-3)] grid place-items-center overflow-hidden border border-border"
        >
          {faviconError ? (
            <span className="text-base font-bold text-white/60">
              {website.name.charAt(0).toUpperCase()}
            </span>
          ) : (
            <img
              src={faviconFor(website.url, 64)}
              alt=""
              className="h-6 w-6"
              loading="lazy"
              onError={() => setFaviconError(true)}
            />
          )}
        </a>

        <div className="min-w-0 flex-1">
          <a
            href={website.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 group/link"
          >
            <h3 className="text-[15px] font-semibold tracking-tight truncate text-foreground group-hover/link:text-white transition">
              {website.name}
            </h3>
            <ExternalLink className="h-3.5 w-3.5 text-copy-secondary group-hover/link:text-foreground transition shrink-0" />
          </a>
          <p className="text-xs text-copy-secondary mt-0.5 truncate">{getDomain(website.url)}</p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit();
            }}
            className="h-7 w-7 grid place-items-center rounded-lg text-copy-secondary hover:text-foreground hover:bg-white/[0.06] transition opacity-0 group-hover:opacity-100"
            aria-label="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }}
            className="h-7 w-7 grid place-items-center rounded-lg text-copy-secondary hover:text-red-400 hover:bg-red-400/10 transition opacity-0 group-hover:opacity-100"
            aria-label="Remove"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
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
    </motion.div>
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

function EditWebsiteModal({
  website,
  onClose,
  onSave,
}: {
  website: Website;
  onClose: () => void;
  onSave: (input: Partial<WebsiteInput>) => void;
}) {
  const [name, setName] = useState(website.name);
  const [url, setUrl] = useState(website.url);
  const [description, setDescription] = useState(website.description);
  const [tags, setTags] = useState(website.tags.join(", "));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    onSave({
      name: name.trim(),
      url: normalized,
      description: description.trim(),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
  };

  return (
    <MatrixModal open onClose={onClose} title="Edit website">
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
            Save changes
          </button>
        </div>
      </form>
    </MatrixModal>
  );
}
