/**
 * Notification abstraction.
 *
 * Current (web/PWA): Notification API + Firebase Cloud Messaging
 * Future (Tauri):    tauri-plugin-notification → OS native toasts
 *
 * Switch implementations by changing `createNotificationService()`.
 * Call sites never need updating.
 */

export interface NotificationService {
  /** Send an immediate local notification. */
  send(title: string, body: string, options?: NotificationOptions): Promise<void>;
  /** Request notification permission from the user. */
  requestPermission(): Promise<boolean>;
  /** Whether notifications are currently permitted. */
  isPermitted(): boolean;
}

export interface NotificationOptions {
  icon?: string;
  tag?:  string;
  data?: Record<string, string>;
  silent?: boolean;
}

// ── Browser implementation ────────────────────────────────────────────────────

class BrowserNotificationService implements NotificationService {
  isPermitted(): boolean {
    return typeof Notification !== "undefined" && Notification.permission === "granted";
  }

  async requestPermission(): Promise<boolean> {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") return true;
    const result = await Notification.requestPermission();
    return result === "granted";
  }

  async send(title: string, body: string, opts: NotificationOptions = {}): Promise<void> {
    if (!this.isPermitted()) return;
    // eslint-disable-next-line no-new
    new Notification(title, {
      body,
      icon:   opts.icon  ?? "/favicon.png",
      tag:    opts.tag,
      silent: opts.silent,
      data:   opts.data,
    });
  }
}

// ── Future: Tauri implementation stub ─────────────────────────────────────────
// When running in Tauri, replace with:
//
//   import { sendNotification, isPermissionGranted, requestPermission }
//     from "@tauri-apps/plugin-notification";
//
//   class TauriNotificationService implements NotificationService {
//     isPermitted() { return isPermissionGranted(); }
//     async requestPermission() {
//       const perm = await requestPermission();
//       return perm === "granted";
//     }
//     async send(title, body) { sendNotification({ title, body }); }
//   }

// ── Factory ───────────────────────────────────────────────────────────────────

function createNotificationService(): NotificationService {
  // Future: if (Platform.isNative()) return new TauriNotificationService();
  return new BrowserNotificationService();
}

export const notificationService: NotificationService = createNotificationService();
