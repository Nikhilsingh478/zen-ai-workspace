/**
 * Minimal legacy service worker — kept only as a stub so existing sw.js
 * registrations stored in browser caches deactivate gracefully.
 *
 * The real unified PWA + FCM worker is firebase-messaging-sw.js.
 * It is registered at scope "/" by src/lib/fcm.ts and handles:
 *   • PWA asset caching
 *   • Firebase Cloud Messaging background messages
 *   • notificationclick routing
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
