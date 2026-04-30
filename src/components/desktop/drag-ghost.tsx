import { Folder, Sparkles } from "lucide-react";
import type { Website } from "@/lib/store";
import { faviconFor } from "@/lib/store";
import type { LauncherEntry } from "@/lib/desktop-layout";

interface DragGhostProps {
  entry: LauncherEntry;
}

/**
 * Lightweight drag ghost rendered inside DragOverlay.
 * Must NOT use any dnd-kit hooks (useDraggable / useDroppable).
 * Width is controlled by the parent DragOverlay style — do not add extra width here.
 */
export function DragGhost({ entry }: DragGhostProps) {
  if (entry.kind === "item") {
    const item = entry.item;
    const isWebsite = item.type === "website";
    const label = isWebsite ? (item as Website).name : "";
    const url = isWebsite ? (item as Website).url : undefined;

    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl p-3 bg-white/[0.08] ring-1 ring-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.7)] opacity-90">
        <div className="h-14 w-14 flex-shrink-0 rounded-2xl overflow-hidden bg-[#18181B] border border-white/20 flex items-center justify-center">
          {isWebsite && url ? (
            <img
              src={faviconFor(url, 64)}
              alt=""
              draggable={false}
              className="h-8 w-8 object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <Sparkles className="h-6 w-6 text-white/50" />
          )}
        </div>
        <span className="text-[11px] text-white/90 text-center leading-tight w-full truncate">
          {label}
        </span>
      </div>
    );
  }

  if (entry.kind === "folder") {
    const { folder, children } = entry;
    const preview = children.slice(0, 4) as Website[];

    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl p-3 bg-white/[0.08] ring-1 ring-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.7)] opacity-90">
        <div className="h-14 w-14 flex-shrink-0 rounded-2xl overflow-hidden bg-[#18181B] border border-white/20 flex items-center justify-center">
          {preview.length === 0 ? (
            <Folder className="h-7 w-7 text-white/40" />
          ) : (
            <div className="grid grid-cols-2 gap-px p-1.5 h-full w-full">
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
                        className="h-4 w-4 object-contain"
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
        <span className="text-[11px] text-white/90 text-center leading-tight w-full truncate">
          {folder.name}
        </span>
      </div>
    );
  }

  return null;
}
