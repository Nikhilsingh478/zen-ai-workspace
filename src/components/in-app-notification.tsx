/**
 * InAppNotification — Instagram-style in-app notification banner.
 *
 * Shows as a premium slide-down banner at the top of the screen
 * whenever a notification is dispatched (foreground or via the
 * showInAppNotification() helper).  Plays the system notification
 * sound via a brief AudioContext beep so the user always hears it.
 *
 * Usage:
 *   1. Mount <InAppNotificationHost /> once in the app root.
 *   2. Call showInAppNotification({ title, body, url? }) from anywhere.
 */

import { AnimatePresence, motion } from "framer-motion";
import { Bell, X } from "lucide-react";
import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InAppNotificationPayload {
  title: string;
  body: string;
  url?: string;
}

// ─── Module-level event bus ───────────────────────────────────────────────────

const listeners = new Set<(payload: InAppNotificationPayload) => void>();

/**
 * Show an in-app notification banner immediately.
 * Safe to call from any module — does not require React context.
 */
export function showInAppNotification(payload: InAppNotificationPayload): void {
  listeners.forEach((fn) => fn(payload));
}

// ─── Notification sound ───────────────────────────────────────────────────────

/**
 * Plays a subtle two-tone chime using the Web Audio API.
 * This mimics OS-level notification sounds without requiring any audio assets.
 */
function playNotificationSound(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioCtx = (window.AudioContext ?? (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();

    const playTone = (freq: number, startTime: number, duration: number, gain: number) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(freq, startTime);

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playTone(880, now, 0.18, 0.18);        // A5 — first note
    playTone(1318.5, now + 0.12, 0.22, 0.14); // E6 — second note (brighter)

    // Clean up the AudioContext after the sound completes
    setTimeout(() => ctx.close(), 500);
  } catch {
    // AudioContext may be suspended on mobile — silently ignore
  }
}

// ─── Single notification item ─────────────────────────────────────────────────

function NotificationBanner({
  payload,
  onClose,
}: {
  payload: InAppNotificationPayload;
  onClose: () => void;
}) {
  // Auto-dismiss after 6 seconds
  useEffect(() => {
    const id = setTimeout(onClose, 6000);
    return () => clearTimeout(id);
  }, [onClose]);

  const handleClick = () => {
    if (payload.url) {
      window.history.pushState({}, "", payload.url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -80, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -60, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="relative flex items-start gap-3 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/[0.1] bg-[var(--surface-1)] shadow-[0_16px_60px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden cursor-pointer"
      onClick={handleClick}
      role="alert"
    >
      {/* Top-edge shimmer */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.14] to-transparent pointer-events-none" />

      {/* Left accent */}
      <div className="absolute top-0 bottom-0 left-0 w-[2px] bg-gradient-to-b from-white/30 via-white/10 to-transparent" />

      {/* Icon */}
      <div className="shrink-0 mt-4 ml-4 h-9 w-9 rounded-xl bg-white/[0.06] border border-white/[0.08] grid place-items-center">
        <Bell className="h-4 w-4 text-white/60" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-4 pr-2">
        <p className="text-[13px] font-semibold text-white/90 leading-tight truncate">
          {payload.title}
        </p>
        {payload.body && (
          <p className="text-[12px] text-white/50 mt-0.5 leading-relaxed line-clamp-2">
            {payload.body}
          </p>
        )}
        <p className="text-[10px] text-white/25 mt-1.5 uppercase tracking-widest">
          now
        </p>
      </div>

      {/* Close */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="shrink-0 mt-3 mr-3 h-6 w-6 rounded-lg flex items-center justify-center text-white/25 hover:text-white/55 hover:bg-white/[0.06] transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Progress bar */}
      <motion.div
        className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-white/30 to-white/10"
        initial={{ width: "100%" }}
        animate={{ width: "0%" }}
        transition={{ duration: 6, ease: "linear" }}
      />
    </motion.div>
  );
}

// ─── Host component ───────────────────────────────────────────────────────────

/**
 * Mount this once in the app root (inside __root.tsx or AppShell).
 * It renders all active in-app notification banners.
 */
export function InAppNotificationHost() {
  const [items, setItems] = useState<Array<{ id: number; payload: InAppNotificationPayload }>>([]);
  const [idCounter, setIdCounter] = useState(0);

  useEffect(() => {
    const handler = (payload: InAppNotificationPayload) => {
      playNotificationSound();
      setIdCounter((c) => {
        const newId = c + 1;
        setItems((prev) => [...prev.slice(-3), { id: newId, payload }]); // max 4 stacked
        return newId;
      });
    };

    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  const dismiss = (id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center"
      style={{ pointerEvents: items.length > 0 ? "auto" : "none" }}
    >
      <AnimatePresence mode="sync">
        {items.map((item) => (
          <NotificationBanner
            key={item.id}
            payload={item.payload}
            onClose={() => dismiss(item.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
