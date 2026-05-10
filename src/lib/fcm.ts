import { getToken, onMessage } from "firebase/messaging";
import { useSyncExternalStore } from "react";
import { getMessagingInstance, isFirebaseConfigured } from "@/lib/firebase";
import { showBrowserNotification, isPushSupported } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationStatus =
  | "unsupported"   // browser can't do push at all
  | "unconfigured"  // Firebase env vars missing
  | "default"       // not yet asked
  | "granted"       // permission given, token active
  | "denied";       // user blocked

// ─── Module-level store ───────────────────────────────────────────────────────

const listeners = new Set<() => void>();
let _status: NotificationStatus = deriveInitialStatus();
let _foregroundListenerAttached = false;

function deriveInitialStatus(): NotificationStatus {
  if (typeof window === "undefined") return "unsupported";
  if (!isPushSupported()) return "unsupported";
  if (!isFirebaseConfigured) return "unconfigured";
  const perm = Notification.permission as NotificationPermission;
  if (perm === "granted") return "granted";
  if (perm === "denied") return "denied";
  return "default";
}

function setStatus(next: NotificationStatus) {
  _status = next;
  listeners.forEach((fn) => fn());
}

// ─── useFCMStatus hook ────────────────────────────────────────────────────────

/** Reactive hook — returns current notification permission status. */
export function useFCMStatus(): NotificationStatus {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => _status,
    () => "unsupported",
  );
}

// ─── Token persistence ────────────────────────────────────────────────────────

async function persistToken(token: string): Promise<void> {
  try {
    await supabase
      .from("notification_tokens")
      .upsert({ token, platform: "web" }, { onConflict: "token" });
  } catch (err) {
    console.error("[fcm] token persist error", err);
  }
}

// ─── Generate / retrieve FCM token ───────────────────────────────────────────

async function acquireToken(): Promise<string | null> {
  const messaging = getMessagingInstance();
  if (!messaging) return null;

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.warn("[fcm] VITE_FIREBASE_VAPID_KEY is not set");
    return null;
  }

  try {
    // Register the Firebase messaging service worker explicitly
    const swReg = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/firebase-messaging-sw-scope/" },
    );
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
    if (token) {
      await persistToken(token);
      console.debug("[fcm] token acquired");
    }
    return token ?? null;
  } catch (err) {
    console.error("[fcm] getToken error", err);
    return null;
  }
}

// ─── Foreground message listener ──────────────────────────────────────────────

function attachForegroundListener(): void {
  if (_foregroundListenerAttached) return;
  const messaging = getMessagingInstance();
  if (!messaging) return;
  _foregroundListenerAttached = true;

  onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? "Horizon Reminder";
    const body = payload.notification?.body ?? "";
    const url = (payload.data?.url as string | undefined) ?? "/horizon";
    showBrowserNotification({ title, body, url, tag: "horizon-reminder" });
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Called once on app startup (quietly — no permission prompt).
 * Attaches the foreground message handler if permission is already granted.
 */
export async function initFCM(): Promise<void> {
  if (_status === "unsupported" || _status === "unconfigured") return;
  if (_status === "granted") {
    attachForegroundListener();
    // Refresh token in background
    acquireToken().catch(() => {});
  }
}

/**
 * Contextually request notification permission — call this when the user
 * explicitly enables a reminder. Returns the resulting status.
 */
export async function requestNotificationPermission(): Promise<NotificationStatus> {
  if (_status === "unsupported" || _status === "unconfigured") return _status;
  if (_status === "granted") return "granted";

  try {
    const result = await Notification.requestPermission();
    if (result === "granted") {
      setStatus("granted");
      attachForegroundListener();
      await acquireToken();
      return "granted";
    } else if (result === "denied") {
      setStatus("denied");
      return "denied";
    }
    return "default";
  } catch (err) {
    console.error("[fcm] permission request error", err);
    return _status;
  }
}

/** Current notification status (non-reactive snapshot). */
export function getNotificationStatus(): NotificationStatus {
  return _status;
}
