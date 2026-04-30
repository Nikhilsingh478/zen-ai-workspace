import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useSyncStatus } from "@/lib/store";
import { cn } from "@/lib/utils";

export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { status } = useSyncStatus();
  const loading = status === "loading";

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-[11px]",
        loading ? "text-copy-secondary" : "text-copy-muted",
      )}
      aria-live="polite"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <CheckCircle2 className="h-3.5 w-3.5" />
      )}
      {!compact && <span>{loading ? "Loading…" : "Saved locally"}</span>}
    </div>
  );
}
