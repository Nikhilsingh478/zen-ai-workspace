/**
 * Lightweight browser Notification helper.
 * Used for foreground notifications (app is open) when FCM delivers a message.
 */

export type NotificationPayload = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
};

/**
 * Show a browser Notification. No-ops silently if permission is not granted.
 * Clicking the notification navigates to `url` (default: /horizon).
 */
export function showBrowserNotification(payload: NotificationPayload): void {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const n = new Notification(payload.title, {
    body: payload.body,
    icon: "/favicon.png",
    badge: "/favicon.png",
    tag: payload.tag ?? "horizon-reminder",
  });

  n.onclick = () => {
    window.focus();
    window.location.hash = "";
    const target = payload.url ?? "/horizon";
    // TanStack Router uses history navigation
    window.history.pushState({}, "", target);
    window.dispatchEvent(new PopStateEvent("popstate"));
    n.close();
  };
}

/**
 * True when the browser can receive push notifications.
 * Does NOT imply permission has been granted.
 */
export const isPushSupported = (): boolean =>
  typeof window !== "undefined" &&
  "Notification" in window &&
  "serviceWorker" in navigator &&
  "PushManager" in window;
