import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, FolderPlus, X } from "lucide-react";
import { DesktopGrid } from "@/components/desktop/desktop-grid";
import { useDesktopStorage } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/desktop")({
  head: () => ({
    meta: [
      { title: "Desktop - AI Metrics" },
      { name: "description", content: "A focused launcher for your AI tools." },
    ],
  }),
  component: DesktopPage,
});

function DesktopPage() {
  const { loaded, createEmptyFolder } = useDesktopStorage();
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-[calc(100vh-2rem)] px-4 py-6 md:px-10 md:py-10">
      <div className="mx-auto max-w-7xl">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
              Desktop
            </h1>
            <p className="text-sm text-copy-secondary mt-0.5">
              Drag to rearrange · drag onto a folder to group · right-click to create folder
            </p>
          </div>

          {/* New Folder button — desktop only (mobile has it inside grid) */}
          <button
            onClick={() => createEmptyFolder(0, 0)}
            className="hidden sm:flex items-center gap-2 rounded-xl border border-white/10 bg-[#141416] px-4 py-2.5 text-sm text-white/60 hover:text-white hover:border-white/20 transition-colors shrink-0"
          >
            <FolderPlus className="h-4 w-4" />
            New Folder
          </button>
        </div>

        {/* Search bar */}
        <div className="relative mb-6 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-copy-secondary pointer-events-none" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter icons…"
            className={cn(
              "w-full pl-9 pr-8 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08]",
              "text-sm text-foreground placeholder:text-copy-muted",
              "outline-none focus:border-white/20 focus:bg-white/[0.07] transition",
            )}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {loaded ? (
          <DesktopGrid searchQuery={searchQuery} />
        ) : (
          <DesktopSkeleton />
        )}
      </div>
    </div>
  );
}

function DesktopSkeleton() {
  return (
    <div className="flex flex-wrap gap-4 mt-4">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div
          key={i}
          className="h-24 w-24 rounded-2xl bg-white/[0.04] animate-pulse"
          style={{ animationDelay: `${i * 0.05}s` }}
        />
      ))}
    </div>
  );
}
