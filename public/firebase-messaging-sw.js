// Firebase Cloud Messaging background service worker.
// Config is read from URL query params at registration time (publishable keys — safe).

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// ─── Firebase config from URL params ─────────────────────────────────────────

const params = new URL(self.location.href).searchParams;

const firebaseConfig = {
  apiKey:            params.get("apiKey")            || "",
  authDomain:        params.get("authDomain")        || "",
  projectId:         params.get("projectId")         || "",
  storageBucket:     params.get("storageBucket")     || "",
  messagingSenderId: params.get("messagingSenderId") || "",
  appId:             params.get("appId")             || "",
};

// ─── Initialize only if config is present ────────────────────────────────────

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title ?? "Horizon Reminder";
    const body  = payload.notification?.body  ?? "";
    const url   = payload.data?.url           ?? "/horizon";

    self.registration.showNotification(title, {
      body,
      icon:               "/favicon.png",
      badge:              "/favicon.png",
      tag:                payload.data?.tag ?? "horizon-reminder",
      requireInteraction: false,
      data:               { url },
    });
  });
}

// ─── Notification click → focus or open the app ──────────────────────────────

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/horizon";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url.includes(self.location.origin));
        if (existing) {
          existing.focus();
          existing.navigate(url);
        } else {
          self.clients.openWindow(url);
        }
      }),
  );
});
