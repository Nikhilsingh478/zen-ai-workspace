import { Folder, Sparkles } from "lucide-react";
import type { Website } from "@/lib/store";
import { faviconFor } from "@/lib/store";
import type { LauncherEntry } from "@/lib/desktop-layout";

interface DragGhostProps {
  entry: LauncherEntry;
  cellPx?: number;
}

export function DragGhost({ entry, cellPx = 100 }: DragGhostProps) {
  const compact = cellPx < 90;
  const wellSize = compact ? "h-10 w-10 rounded-xl" : "h-14 w-14 rounded-2xl";
  const imgSize = compact ? "h-6 w-6" : "h-8 w-8";
  const iconSize = compact ? "h-5 w-5" : "h-6 w-6";
  const folderIconSize = compact ? "h-5 w-5" : "h-7 w-7";
  const childImg = compact ? "h-3 w-3" : "h-4 w-4";
  const containerSize = { width: cellPx, height: cellPx };

  if (entry.kind === "item") {
    const item = entry.item;
    const isWebsite = item.type === "website";
    const label = isWebsite ? (item as Website).name : "";
    const url = isWebsite ? (item as Website).url : undefined;

    return (
      <div style={containerSize} className="flex flex-col items-center justify-center gap-2 rounded-2xl p-2 bg-white/[0.10] ring-1 ring-white/25 shadow-[0_8px_32px_rgba(0,0,0,0.8)]">
        <div className={cn("flex-shrink-0 overflow-hidden bg-[#18181B] border border-white/20 flex items-center justify-center", wellSize)}>
          {isWebsite && url ? (
            <img
              src={faviconFor(url, 64)}
              alt=""
              draggable={false}
              className={cn("object-contain", imgSize)}
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                el.style.display = "none";
                const fallback = el.nextSibling as HTMLElement;
                if (fallback) fallback.style.display = "flex";
              }}
            />
          ) : (
            <Sparkles className={cn("text-white/50", iconSize)} />
          )}
        </div>
        <span className={cn("text-white/90 text-center leading-tight w-full truncate px-1", compact ? "text-[10px]" : "text-[11px]")}>
          {label}
        </span>
      </div>
    );
  }

  if (entry.kind === "folder") {
    const { folder, children } = entry;
    const preview = children.slice(0, 4) as Website[];

    return (
      <div style={containerSize} className="flex flex-col items-center justify-center gap-2 rounded-2xl p-2 bg-white/[0.10] ring-1 ring-white/25 shadow-[0_8px_32px_rgba(0,0,0,0.8)]">
        <div className={cn("flex-shrink-0 overflow-hidden bg-[#18181B] border border-white/20 flex items-center justify-center", wellSize)}>
          {preview.length === 0 ? (
            <Folder className={cn("text-white/40", folderIconSize)} />
          ) : (
            <div className={cn("grid grid-cols-2 gap-px h-full w-full", compact ? "p-1" : "p-1.5")}>
              {[0, 1, 2, 3].map((i) => {
                const child = preview[i];
                return (
                  <div
                    key={i}
                    className="rounded overflow-hidden bg-white/[0.06] flex items-center justify-center"
                  >
                    {child ? (
                      <img
                        src={faviconFor(child.url, 32)}
                        alt=""
                        draggable={false}
                        className={cn("object-contain", childImg)}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <span className={cn("text-white/90 text-center leading-tight w-full truncate px-1", compact ? "text-[10px]" : "text-[11px]")}>
          {folder.name}
        </span>
      </div>
    );
  }

  return null;
}