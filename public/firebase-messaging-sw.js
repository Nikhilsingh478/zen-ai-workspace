/**
 * Unified PWA + Firebase Cloud Messaging Service Worker
 *
 * Registered at scope "/" so it controls all pages and receives FCM push events.
 * Firebase config is read from URL query params (publishable keys — safe to expose).
 *
 * Registration happens in src/lib/fcm.ts, which passes params like:
 *   /firebase-messaging-sw.js?apiKey=...&projectId=...&messagingSenderId=...
 */

// ─── PWA Cache ────────────────────────────────────────────────────────────────

const CACHE_NAME = "ai-metrics-v3";
const PRECACHE = ["/", "/manifest.json", "/favicon.png"];

self.addEventListener("install", (event) => {
  console.debug("[sw] install | cache:", CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  // Take over immediately — do NOT wait for old SW clients to close
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
  // Network-first for same-origin; fall back to cache on network failure
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

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

    /**
     * Background message handler — fires when:
     *   - No app tab is open (background)
     *   - App tab exists but is not focused
     *
     * Firebase SDK intercepts push events and routes here.
     * We must call showNotification() — the browser will not auto-display.
     */
    messaging.onBackgroundMessage((payload) => {
      console.debug("[sw] FCM background message received:", JSON.stringify(payload));

      const title = payload.notification?.title ?? "Horizon Reminder";
      const body  = payload.notification?.body  ?? "";
      const url   = payload.data?.url           ?? "/horizon";

      console.debug("[sw] Showing notification:", title, "|", body);

      self.registration.showNotification(title, {
        body,
        icon:               "/favicon.png",
        badge:              "/favicon.png",
        tag:                "horizon-reminder",
        requireInteraction: false,
        silent:             false,
        data:               { url },
      });
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
      self.registration.showNotification(payload.title ?? "AI Metrics", {
        body:  payload.body  ?? "",
        icon:  "/favicon.png",
        badge: "/favicon.png",
        tag:   "ai-metrics",
        data:  payload.data ?? {},
      })
    );
  });
}

// ─── Notification click ───────────────────────────────────────────────────────

self.addEventListener("notificationclick", (event) => {
  console.debug("[sw] notificationclick | tag:", event.notification.tag);
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? "/horizon";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus an existing tab pointing to this origin if possible
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
