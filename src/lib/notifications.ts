/**
 * Browser notification helper.
 *
 * IMPORTANT: Chrome silently suppresses new Notification() calls when an
 * active service worker exists and notifications are permission-granted.
 * All OS notification display MUST go through ServiceWorkerRegistration
 * .showNotification() to be visible reliably across desktop, PWA, and Android.
 *
 * In addition, this module fires the in-app banner (Instagram-style, top of
 * screen) via showInAppNotification() so users always see it even when the
 * browser tab is focused.  The banner also plays a subtle notification sound.
 */

import { showInAppNotification } from "@/components/in-app-notification";

export type NotificationPayload = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
};

/**
 * Show both an in-app banner AND a browser OS notification.
 * The in-app banner is shown immediately regardless of OS permission state.
 * The OS notification goes through the service worker.
 *
 * No-ops silently if SW is unavailable for the OS portion.
 */
export async function showBrowserNotification(
  payload: NotificationPayload,
): Promise<void> {
  // 1. Always show the in-app banner (plays sound automatically)
  showInAppNotification({
    title: payload.title,
    body:  payload.body,
    url:   payload.url ?? "/horizon",
  });

  // 2. Also send to OS notification tray if permission is granted
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
