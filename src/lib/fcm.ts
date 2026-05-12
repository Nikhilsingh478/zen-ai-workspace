import { getToken, onMessage } from "firebase/messaging";
import { useSyncExternalStore } from "react";
import { getMessagingInstance, isFirebaseConfigured } from "@/lib/firebase";
import { isPushSupported } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { showInAppNotification } from "@/components/in-app-notification";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationStatus =
  | "unsupported"   // browser can't do push at all
  | "unconfigured"  // Firebase env vars missing
  | "default"       // permission not yet asked
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
    console.debug("[fcm] token persisted to Supabase");
  } catch (err) {
    console.error("[fcm] token persist error:", err);
  }
}

// ─── Service worker URL ───────────────────────────────────────────────────────
//
// Firebase web API keys are publishable (security is via Firebase rules, not keys).
// We embed them as URL params so the SW can init Firebase without a separate fetch.

function buildSwUrl(): string {
  const params = new URLSearchParams({
    apiKey:            import.meta.env.VITE_FIREBASE_API_KEY             ?? "",
    authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN         ?? "",
    projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID          ?? "",
    storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET      ?? "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId:             import.meta.env.VITE_FIREBASE_APP_ID              ?? "",
  });
  return `/firebase-messaging-sw.js?${params.toString()}`;
}

// ─── Service worker registration ──────────────────────────────────────────────
//
// We always register firebase-messaging-sw.js at scope "/" so it:
//   1. Controls every page (required for background push delivery)
//   2. Handles PWA asset caching (replaces the old sw.js)
//   3. Initialises Firebase messaging when config params are present
//
// Registering here (not in index.html) lets us embed Firebase config params
// in the URL at runtime.

async function registerUnifiedSW(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const swUrl = buildSwUrl();
    const reg = await navigator.serviceWorker.register(swUrl, { scope: "/" });
    console.debug(
      "[fcm] SW registered | scope:", reg.scope,
      "| active:", reg.active?.state ?? "installing",
    );

    // Unregister any stale sw.js registration that index.html used to create
    const allRegs = await navigator.serviceWorker.getRegistrations();
    for (const r of allRegs) {
      if (r === reg) continue;
      console.debug("[fcm] Unregistering stale SW:", r.active?.scriptURL ?? r.scope);
      await r.unregister();
    }

    return reg;
  } catch (err) {
    console.error("[fcm] SW registration failed:", err);
    return null;
  }
}

// ─── Acquire / refresh FCM token ─────────────────────────────────────────────

async function acquireToken(): Promise<string | null> {
  const messaging = getMessagingInstance();
  if (!messaging) return null;

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.warn("[fcm] VITE_FIREBASE_VAPID_KEY is not set — cannot acquire token");
    return null;
  }

  try {
    // navigator.serviceWorker.ready resolves once our unified SW is active+controlling
    const swReg = await navigator.serviceWorker.ready;
    console.debug("[fcm] Using SW registration for token:", swReg.active?.scriptURL);

    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
    if (token) {
      console.debug("[fcm] FCM token acquired:", token.slice(0, 20) + "…");
      await persistToken(token);
    } else {
      console.warn("[fcm] getToken returned empty — push subscription may be missing");
    }
    return token ?? null;
  } catch (err) {
    console.error("[fcm] getToken error:", err);
    return null;
  }
}

// ─── Foreground message handler ───────────────────────────────────────────────
//
// When the app tab is open and focused, Firebase routes incoming push messages
// here instead of to the service worker's onBackgroundMessage.
//
// CRITICAL: Chrome silently suppresses new Notification() calls when an active
// service worker exists. We MUST route through ServiceWorkerRegistration
// .showNotification() or the notification will never appear.

/** Detect mobile UA — determines requireInteraction setting. */
function isMobileUA(): boolean {
  return /android|iphone|ipad|mobile/i.test(navigator.userAgent);
}

function attachForegroundListener(): void {
  if (_foregroundListenerAttached) return;
  const messaging = getMessagingInstance();
  if (!messaging) return;
  _foregroundListenerAttached = true;

  onMessage(messaging, async (payload) => {
    console.debug("[fcm] Foreground message received:", JSON.stringify(payload));

    const title = payload.notification?.title ?? "Horizon Reminder";
    const body  = payload.notification?.body  ?? "";
    const url   = (payload.data?.url as string | undefined) ?? "/horizon";

    // Always show the in-app banner (visible immediately, plays sound)
    showInAppNotification({ title, body, url });

    if (Notification.permission !== "granted") {
      console.warn("[fcm] Foreground message received but permission is not granted");
      return;
    }

    try {
      // Also send the OS notification so it lands in the notification tray
      const reg = await navigator.serviceWorker.ready;
      // SOUND FIX: unique tag guarantees OS plays its sound every time
      const uniqueTag = `horizon-${Date.now()}`;
      await reg.showNotification(title, {
        body,
        icon:               "/favicon.png",
        badge:              "/favicon.png",
        tag:                uniqueTag,
        silent:             false,
        vibrate:            [200, 60, 200],
        requireInteraction: true,
        renotify:           true,
        data:               { url },
        actions: [
          { action: "view",    title: "View"    },
          { action: "dismiss", title: "Dismiss" },
        ],
      } as NotificationOptions);
      console.debug("[fcm] Foreground notification shown via SW registration");
    } catch (err) {
      console.error("[fcm] showNotification (foreground) error:", err);
    }
  });

  console.debug("[fcm] Foreground message listener attached");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Called once on app startup (quietly — no permission prompt).
 * Always registers the unified service worker for PWA caching.
 * If permission is already granted, also starts FCM token flow.
 */
export async function initFCM(): Promise<void> {
  if (_status === "unsupported") {
    console.debug("[fcm] Push not supported in this browser — skipping init");
    return;
  }

  // Always register the unified SW (PWA caching + optional FCM)
  await registerUnifiedSW();

  if (_status === "unconfigured") {
    console.debug("[fcm] Firebase not configured — SW registered for caching only");
    return;
  }

  if (_status === "granted") {
    console.debug("[fcm] Permission already granted — starting FCM");
    attachForegroundListener();
    acquireToken().catch(() => {});
  } else {
    console.debug("[fcm] Notification permission:", _status, "— waiting for user action");
  }
}

/**
 * Request notification permission when the user explicitly enables a reminder.
 * Returns the resulting status.
 */
export async function requestNotificationPermission(): Promise<NotificationStatus> {
  if (_status === "unsupported" || _status === "unconfigured") return _status;
  if (_status === "granted") return "granted";

  try {
    console.debug("[fcm] Requesting notification permission…");
    const result = await Notification.requestPermission();

    if (result === "granted") {
      console.debug("[fcm] Permission granted");
      setStatus("granted");
      attachForegroundListener();
      await acquireToken();
      return "granted";
    }

    if (result === "denied") {
      console.debug("[fcm] Permission denied by user");
      setStatus("denied");
      return "denied";
    }

    return "default";
  } catch (err) {
    console.error("[fcm] permission request error:", err);
    return _status;
  }
}

/** Non-reactive snapshot of current notification status (for event handlers). */
export function getNotificationStatus(): NotificationStatus {
  return _status;
}

/**
 * Show a test notification immediately via the active service worker.
 * Use this to verify the end-to-end notification display path independently
 * of FCM delivery. Throws if permission is not granted or SW is unavailable.
 */
export async function sendTestNotification(): Promise<void> {
  // Always show the in-app banner (works even without OS permission)
  showInAppNotification({
    title: "Test Notification",
    body: "If you see this, in-app notifications are working correctly.",
    url: "/horizon",
  });

  if (!("serviceWorker" in navigator) || Notification.permission !== "granted") {
    // In-app banner already shown — skip SW notification
    console.debug("[fcm] Test notification shown in-app only (no OS permission or SW)");
    return;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    console.debug("[fcm] Sending test notification via SW:", reg.active?.scriptURL);

    await reg.showNotification("Test Notification", {
      body: "If you see this, browser notifications are working correctly.",
      icon:               "/favicon.png",
      badge:              "/favicon.png",
      tag:                "horizon-test",
      silent:             false,
      vibrate:            [200, 50, 200],
      requireInteraction: true,
      renotify:           true,
      data:               { url: "/horizon" },
      actions: [
        { action: "view",    title: "View"    },
        { action: "dismiss", title: "Dismiss" },
      ],
    } as NotificationOptions);

    console.debug("[fcm] Test notification dispatched to OS tray");
  } catch (err) {
    console.error("[fcm] SW showNotification error:", err);
  }
}
