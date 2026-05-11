/**
 * Browser notification helper.
 *
 * IMPORTANT: Chrome silently suppresses new Notification() calls when an
 * active service worker exists and notifications are permission-granted.
 * All notification display MUST go through ServiceWorkerRegistration
 * .showNotification() to be visible reliably across desktop, PWA, and Android.
 */

export type NotificationPayload = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
};

/**
 * Show a notification via the active service worker registration.
 * Works in foreground, background, installed PWA, and Android Chrome.
 *
 * No-ops silently if permission is not granted or SW is unavailable.
 */
export async function showBrowserNotification(
  payload: NotificationPayload,
): Promise<void> {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (!("serviceWorker" in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(payload.title, {
      body:               payload.body,
      icon:               "/favicon.png",
      badge:              "/favicon.png",
      tag:                payload.tag ?? "horizon-reminder",
      requireInteraction: false,
      silent:             false,
      data:               { url: payload.url ?? "/horizon" },
    });
  } catch (err) {
    console.error("[notifications] showNotification error:", err);
  }
}

/**
 * True when the browser supports push notifications.
 * Does NOT imply permission has been granted.
 */
export const isPushSupported = (): boolean =>
  typeof window !== "undefined" &&
  "Notification" in window &&
  "serviceWorker" in navigator &&
  "PushManager" in window;
