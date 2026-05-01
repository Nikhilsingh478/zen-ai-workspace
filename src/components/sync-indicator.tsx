import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { useSyncStatus } from "@/lib/store";
import { cn } from "@/lib/utils";

export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { status } = useSyncStatus();

  if (!mounted) return null;

  const isLoading = status === "loading";
  const isError = status === "error";

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-[11px]",
        isLoading ? "text-copy-secondary" : isError ? "text-red-400/70" : "text-copy-muted",
      )}
      aria-live="polite"
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isError ? (
        <AlertCircle className="h-3.5 w-3.5" />
      ) : (
        <CheckCircle2 className="h-3.5 w-3.5" />
      )}
      {!compact && (
        <span>{isLoading ? "Loading…" : isError ? "Sync error" : "Synced"}</span>
      )}
    </div>
  );
}
