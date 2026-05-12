/**
 * Unified PWA + Firebase Cloud Messaging Service Worker
 *
 * Registered at scope "/" so it controls all pages and receives FCM push events.
 * Firebase config is read from URL query params (publishable keys — safe to expose).
 *
 * Registration happens in src/lib/fcm.ts, which passes params like:
 *   /firebase-messaging-sw.js?apiKey=...&projectId=...&messagingSenderId=...
 *
 * Notification improvements (v4):
 *  - `silent: false` keeps OS sound ON for all notifications
 *  - `vibrate` pattern added for mobile haptic feedback
 *  - `requireInteraction: true` on mobile so it stays on screen until dismissed
 *  - `renotify: true` so repeated notifications with same tag still play sound
 *  - Notification actions added (View, Dismiss) for Android lock screen
 */

// ─── PWA Cache ────────────────────────────────────────────────────────────────

const CACHE_NAME = "ai-metrics-v4";
const PRECACHE = ["/", "/manifest.json", "/favicon.png"];

self.addEventListener("install", (event) => {
  console.debug("[sw] install | cache:", CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.debug("[sw] activate | claiming all clients");
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// ─── Notification helper ──────────────────────────────────────────────────────
//
// Detects if we're on a mobile device (Android/iOS) by checking the client
// type — service workers running as PWA are classified as "window" clients.
// We use more aggressive settings (requireInteraction, vibrate) on mobile.

async function isMobileClient() {
  try {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // UA-based heuristic available in SW scope
    const ua = (self.navigator?.userAgent ?? "").toLowerCase();
    return /android|iphone|ipad|mobile/.test(ua);
  } catch {
    return false;
  }
}

/**
 * Build a notification options object with OS-sound and mobile-optimised settings.
 *
 * Key properties:
 * - `silent: false`          — explicitly request OS sound (default on most browsers,
 *                              but setting it explicitly prevents any accidental silent flag)
 * - `vibrate`                — haptic pattern for Android: 200ms buzz, 50ms gap, 200ms buzz
 * - `requireInteraction`     — keeps notification on screen (mobile heads-up display)
 * - `renotify`               — play sound again even if same tag is reused
 * - `actions`                — action buttons shown on Android lock screen / wearables
 */
async function buildNotificationOptions(body, url, tag) {
  const mobile = await isMobileClient();

  return {
    body,
    icon:               "/favicon.png",
    badge:              "/favicon.png",
    tag:                tag ?? "horizon-reminder",
    silent:             false,          // OS sound ON
    vibrate:            [200, 50, 200], // Android haptics
    requireInteraction: mobile,         // stay on screen on mobile
    renotify:           true,           // re-play sound even for same tag
    data:               { url: url ?? "/horizon" },
    actions: [
      { action: "view",    title: "View"    },
      { action: "dismiss", title: "Dismiss" },
    ],
  };
}

// ─── Firebase Cloud Messaging ─────────────────────────────────────────────────

const _params = new URL(self.location.href).searchParams;
const _fbConfig = {
  apiKey:            _params.get("apiKey")            || "",
  authDomain:        _params.get("authDomain")        || "",
  projectId:         _params.get("projectId")         || "",
  storageBucket:     _params.get("storageBucket")     || "",
  messagingSenderId: _params.get("messagingSenderId") || "",
  appId:             _params.get("appId")             || "",
};

const _fcmReady = Boolean(
  _fbConfig.apiKey && _fbConfig.projectId && _fbConfig.messagingSenderId
);

console.debug("[sw] FCM configured:", _fcmReady, "| projectId:", _fbConfig.projectId || "(none)");

if (_fcmReady) {
  try {
    importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
    importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

    firebase.initializeApp(_fbConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage(async (payload) => {
      console.debug("[sw] FCM background message received:", JSON.stringify(payload));

      const title = payload.notification?.title ?? "Horizon Reminder";
      const body  = payload.notification?.body  ?? "";
      const url   = payload.data?.url           ?? "/horizon";

      const options = await buildNotificationOptions(body, url, "horizon-reminder");

      console.debug("[sw] Showing notification:", title, "|", body);
      event.waitUntil(self.registration.showNotification(title, options));
    });

    console.debug("[sw] Firebase messaging initialized successfully");
  } catch (err) {
    console.error("[sw] Firebase init error:", err);
  }
} else {
  /**
   * Fallback push handler — used when Firebase is not configured.
   * Handles raw Web Push API payloads.
   */
  self.addEventListener("push", (event) => {
    console.debug("[sw] Raw push event received (Firebase not configured)");
    if (!event.data) return;

    let payload;
    try {
      payload = event.data.json();
    } catch {
      payload = { title: "AI Metrics", body: event.data.text() };
    }

    event.waitUntil(
      buildNotificationOptions(
        payload.body  ?? "",
        payload.data?.url ?? "/horizon",
        "ai-metrics"
      ).then((options) =>
        self.registration.showNotification(payload.title ?? "AI Metrics", options)
      )
    );
  });
}

// ─── Notification click ───────────────────────────────────────────────────────

self.addEventListener("notificationclick", (event) => {
  console.debug("[sw] notificationclick | action:", event.action, "| tag:", event.notification.tag);
  event.notification.close();

  // "dismiss" action — just close, no navigation
  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url ?? "/horizon";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) =>
          c.url.startsWith(self.location.origin)
        );
        if (existing) {
          existing.focus();
          return existing.navigate(targetUrl);
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});
