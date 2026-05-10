// Firebase Cloud Messaging background service worker.
// This file must live at the root of the site.
// It handles push notifications when the app is closed or in the background.

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// ─── Firebase config ──────────────────────────────────────────────────────────
// Injected at build time by the SW registration code in fcm.ts.
// These are publishable keys — safe to include in the service worker.

const firebaseConfig = {
  apiKey: self.__FIREBASE_API_KEY__ ?? "",
  authDomain: self.__FIREBASE_AUTH_DOMAIN__ ?? "",
  projectId: self.__FIREBASE_PROJECT_ID__ ?? "",
  storageBucket: self.__FIREBASE_STORAGE_BUCKET__ ?? "",
  messagingSenderId: self.__FIREBASE_MESSAGING_SENDER_ID__ ?? "",
  appId: self.__FIREBASE_APP_ID__ ?? "",
};

// Only initialize if we have a valid config
if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // ─── Background message handler ─────────────────────────────────────────────

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title ?? "Horizon Reminder";
    const body = payload.notification?.body ?? "";
    const url = payload.data?.url ?? "/horizon";

    self.registration.showNotification(title, {
      body,
      icon: "/favicon.png",
      badge: "/favicon.png",
      tag: "horizon-reminder",
      requireInteraction: false,
      data: { url },
    });
  });
}

// ─── Notification click ───────────────────────────────────────────────────────

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/horizon";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus an existing tab if one is open
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
