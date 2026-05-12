/**
 * Browser notification helper.
 *
 * SOUND FIX EXPLAINED:
 * Browsers suppress notification sound when a new notification has the SAME tag
 * as an existing one (it treats it as a silent "update"). Setting renotify:true
 * helps but is unreliable across browsers/OSes. The ONLY reliable way to always
 * play the system notification sound is to use a UNIQUE tag every time, so the
 * browser treats each notification as brand-new.
 *
 * We use `tag: \`horizon-${Date.now()}\`` to guarantee a unique notification
 * each time → OS always plays the system sound.
 *
 * Mobile display:
 * - requireInteraction:true keeps the notification on-screen (heads-up display)
 *   on Android until the user dismisses it, including on the lock screen.
 * - vibrate pattern gives haptic feedback on Android.
 */

import { showInAppNotification } from "@/components/in-app-notification";

export type NotificationPayload = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
};

/** Returns true if the user agent is a mobile device. */
function isMobile(): boolean {
  return /android|iphone|ipad|mobile/i.test(navigator.userAgent);
}

/**
 * Show an in-app banner AND an OS notification.
 *
 * KEY: We always generate a unique tag so the browser NEVER treats it as
 * a silent update. This ensures the OS notification sound plays every time.
 */
export async function showBrowserNotification(
  payload: NotificationPayload,
): Promise<void> {
  // 1. In-app banner — always visible, plays Web Audio chime
  showInAppNotification({
    title: payload.title,
    body:  payload.body,
    url:   payload.url ?? "/horizon",
  });

  // 2. OS notification tray
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (!("serviceWorker" in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.ready;

    // UNIQUE tag every time = OS always plays sound (never silent-update)
    const uniqueTag = payload.tag
      ? `${payload.tag}-${Date.now()}`
      : `horizon-${Date.now()}`;

    await reg.showNotification(payload.title, {
      body:               payload.body,
      icon:               "/favicon.png",
      badge:              "/favicon.png",
      tag:                uniqueTag,
      silent:             false,            // OS sound ON
      vibrate:            [200, 60, 200],   // Android haptics
      requireInteraction: isMobile(),       // stay on screen on mobile / lock screen
      renotify:           true,             // belt-and-suspenders: request re-notify too
      data:               { url: payload.url ?? "/horizon" },
      actions: [
        { action: "view",    title: "View"    },
        { action: "dismiss", title: "Dismiss" },
      ],
    } as NotificationOptions);
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
