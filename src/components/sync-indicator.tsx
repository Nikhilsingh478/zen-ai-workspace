import { useEffect, useState } from "react";
import { CheckCircle2, CloudOff, Loader2 } from "lucide-react";
import { useSyncStatus } from "@/lib/store";
import { cn } from "@/lib/utils";

export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { status, error } = useSyncStatus();
  const syncing = status === "loading" || status === "syncing";
  const offline = status === "offline";
  const Icon = syncing ? Loader2 : offline ? CloudOff : CheckCircle2;
  const label = syncing ? "Syncing" : offline ? "Saved locally" : "Synced";

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-[11px]",
        offline ? "text-amber-300" : syncing ? "text-copy-secondary" : "text-copy-muted",
      )}
      title={error ?? label}
      aria-live="polite"
    >
      <Icon className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
      {!compact && <span>{label}</span>}
    </div>
  );
}
