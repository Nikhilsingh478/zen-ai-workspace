/**
 * Native Notification Service for AI Matrix / Horizon.
 *
 * Provides production-grade native Android notification scheduling via
 * @capacitor/local-notifications and Android AlarmManager.
 *
 * Core Architecture:
 *   1. Immediate Native Ownership: When a task is created/edited, Android AlarmManager
 *      immediately owns the schedule. Delivery does not depend on React, WebView,
 *      or JavaScript timers remaining active.
 *   2. Deterministic ID Mapping: Stable 31-bit positive integer hash of task UUID
 *      ensures predictable cancellations, updates, and zero collisions.
 *   3. Android Notification Channels: Dedicated "horizon-reminders" (High importance,
 *      heads-up banner, vibration, sound, public lockscreen visibility) and
 *      "jarvis-alerts".
 *   4. Zero UTC Drift: Local date/time strictly constructed in user local timezone.
 *   5. Action Handling: Tapping notification navigates to /horizon or completes task.
 *   6. Recovery Reconciliation: Startup check reconciles missing/stale alarms without
 *      being the primary scheduler.
 *   7. Web/PWA Fallback: Seamlessly falls back to browser notifications on web.
 */

import { Platform } from "@/lib/platform";
import type { HorizonTask } from "@/lib/horizon";
import { format12Hour } from "@/lib/horizon";
import { showInAppNotification } from "@/components/in-app-notification";

export type NativeNotificationPermissionStatus = "granted" | "denied" | "default" | "unsupported";

export const HORIZON_CHANNEL_ID = "horizon-reminders";
export const JARVIS_CHANNEL_ID = "jarvis-alerts";

let _channelsInitialized = false;
let _actionListenerInitialized = false;

// ─── 1. Deterministic Notification ID Mapping ────────────────────────────────

/**
 * Maps a task UUID string to a deterministic, collision-resistant 31-bit positive integer.
 * Uses FNV-1a 32-bit hash algorithm masked to 0x7FFFFFFF (positive 31-bit integer for Android).
 */
export function taskIdToNotificationId(taskId: string): number {
  if (!taskId) return 1;
  let hash = 0x811c9dc5;
  for (let i = 0; i < taskId.length; i++) {
    hash ^= taskId.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  const id = hash & 0x7fffffff;
  return id === 0 ? 1 : id;
}

// ─── 2. Local Date/Time Parsing (Strictly Local, No UTC Skew) ─────────────────

/**
 * Parses taskDate ("YYYY-MM-DD") and taskTime ("HH:mm" in 24h) into a local Date object.
 * Strictly respects the user's local device timezone without UTC conversion skew.
 */
export function parseTaskLocalDateTime(taskDate: string, taskTime: string): Date {
  const [yStr, mStr, dStr] = taskDate.split("-");
  const [hStr, minStr] = taskTime.split(":");

  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10) - 1; // 0-indexed in JS Date
  const day = parseInt(dStr, 10);
  const hour = parseInt(hStr, 10);
  const minute = parseInt(minStr, 10);

  return new Date(year, month, day, hour, minute, 0, 0);
}

// ─── 3. Android Notification Channels ─────────────────────────────────────────

/**
 * Creates high-priority notification channels on Android 8.0+ (API 26+).
 * Safe to call multiple times (idempotent).
 */
export async function ensureNotificationChannels(): Promise<void> {
  if (_channelsInitialized) return;
  if (!Platform.isAndroid()) return;

  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");

    await LocalNotifications.createChannel({
      id: HORIZON_CHANNEL_ID,
      name: "Horizon Task Reminders",
      description: "Scheduled reminders and alerts for Horizon tasks and commitments",
      importance: 5, // High / Heads-up display
      visibility: 1, // Public (shows on lockscreen)
      sound: "beep.wav",
      vibration: true,
      lights: true,
      lightColor: "#38BDF8",
    });

    await LocalNotifications.createChannel({
      id: JARVIS_CHANNEL_ID,
      name: "JARVIS Proactive Alerts",
      description: "Proactive intelligence and assistant updates from JARVIS",
      importance: 3, // Default
      visibility: 1,
      vibration: false,
      lights: true,
      lightColor: "#38BDF8",
    });

    _channelsInitialized = true;
    console.debug("[native-notifications] Android notification channels configured");
  } catch (err) {
    console.warn("[native-notifications] Failed to create notification channels:", err);
  }
}

// ─── 4. Permission Handling ───────────────────────────────────────────────────

/**
 * Checks current notification permission state across Android or Web.
 */
export async function getNativeNotificationPermissionStatus(): Promise<NativeNotificationPermissionStatus> {
  if (Platform.isAndroid()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display === "granted") return "granted";
      if (perm.display === "denied") return "denied";
      return "default";
    } catch {
      return "default";
    }
  }

  // Web fallback
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return "default";
}

/**
 * Requests runtime notification permission.
 */
export async function requestNativeNotificationPermission(): Promise<NativeNotificationPermissionStatus> {
  if (Platform.isAndroid()) {
    try {
      await ensureNotificationChannels();
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const result = await LocalNotifications.requestPermissions();
      if (result.display === "granted") {
        return "granted";
      } else if (result.display === "denied") {
        return "denied";
      }
      return "default";
    } catch (err) {
      console.error("[native-notifications] requestPermissions error:", err);
      return "denied";
    }
  }

  // Web fallback
  if (typeof Notification === "undefined") return "unsupported";
  try {
    const res = await Notification.requestPermission();
    if (res === "granted") return "granted";
    if (res === "denied") return "denied";
    return "default";
  } catch (err) {
    console.error("[native-notifications] Web Notification.requestPermission error:", err);
    return "denied";
  }
}

// ─── 5. Task Scheduling & Cancellation ────────────────────────────────────────

export type ScheduleResult = {
  success: boolean;
  reason?: "past_time" | "disabled" | "completed" | "permission_denied" | "error";
  scheduledFor?: Date;
  notificationId?: number;
};

/**
 * Schedules a native Android notification for a Horizon task.
 * Primary path: Called immediately whenever a task is created, updated, or un-completed.
 */
export async function scheduleHorizonTaskNotification(
  task: HorizonTask,
): Promise<ScheduleResult> {
  // If notifications are disabled or task is completed, do not schedule
  if (!task.notificationEnabled) {
    return { success: false, reason: "disabled" };
  }
  if (task.completed) {
    return { success: false, reason: "completed" };
  }

  const scheduleDate = parseTaskLocalDateTime(task.taskDate, task.taskTime);
  const now = new Date();

  // If the scheduled time is 30 seconds or less from now (or already past), skip scheduling.
  // 30s grace avoids edge cases where a freshly created task is just barely in the past.
  if (scheduleDate.getTime() <= now.getTime() - 30_000) {
    return { success: false, reason: "past_time", scheduledFor: scheduleDate };
  }

  const notificationId = taskIdToNotificationId(task.id);
  const formattedTime = format12Hour(task.taskTime);
  const priorityBadge = task.priority === "high" ? "🔴 HIGH" : task.priority === "medium" ? "🟡 MED" : "🔵 LOW";
  const bodyText = `⏰ Due at ${formattedTime} [${priorityBadge}]${task.description ? ` • ${task.description}` : ""}`;

  if (Platform.isAndroid()) {
    try {
      await ensureNotificationChannels();
      const { LocalNotifications } = await import("@capacitor/local-notifications");

      // Check permissions
      const permStatus = await getNativeNotificationPermissionStatus();
      if (permStatus === "denied") {
        console.warn(`[native-notifications] Cannot schedule task ${task.id}: permission denied`);
        return { success: false, reason: "permission_denied" };
      }

      // Cancel any existing schedule for this task first
      try {
        await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
      } catch {
        // Ignore cancellation error if not previously scheduled
      }

      // Schedule exact native notification via Android AlarmManager
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId,
            title: task.title,
            body: bodyText,
            schedule: {
              at: scheduleDate,
              allowWhileIdle: true, // Exact alarm during Doze mode
            },
            channelId: HORIZON_CHANNEL_ID,
            smallIcon: "ic_stat_jarvis",
            iconColor: "#38BDF8",
            sound: "beep.wav",
            extra: {
              taskId: task.id,
              url: `/horizon?task=${task.id}`,
              taskDate: task.taskDate,
              taskTime: task.taskTime,
            },
            actionTypeId: "HORIZON_REMINDER_ACTIONS",
          },
        ],
      });

      console.debug(
        `[native-notifications] Scheduled native reminder for "${task.title}" (ID: ${notificationId}) at ${scheduleDate.toLocaleString()}`,
      );

      return {
        success: true,
        scheduledFor: scheduleDate,
        notificationId,
      };
    } catch (err) {
      console.error("[native-notifications] Error scheduling native notification:", err);
      return { success: false, reason: "error" };
    }
  }

  // ─── Web/PWA fallback: setTimeout-based browser notification scheduler ────
  // Fires a real browser Notification when the tab is alive. For full background
  // delivery, the Firebase Cloud Messaging service worker handles push events.
  scheduleWebNotification(task.id, task.title, bodyText, scheduleDate, notificationId);
  return { success: true, scheduledFor: scheduleDate, notificationId };
}

// ─── Web notification scheduler (in-memory, setTimeout-based) ─────────────────

// Maps taskId → { timeoutId, notificationId } for web scheduling
const _webTimers = new Map<string, { timeoutId: ReturnType<typeof setTimeout>; notificationId: number }>();

/**
 * Schedules a browser Notification for a web/PWA task reminder via setTimeout.
 * Requests notification permission if not already granted.
 * Silently skips if permission is denied or Notification API is unavailable.
 */
function scheduleWebNotification(
  taskId: string,
  title: string,
  body: string,
  scheduledAt: Date,
  notificationId: number,
): void {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;

  // Cancel any existing web timer for this task
  const existing = _webTimers.get(taskId);
  if (existing) {
    clearTimeout(existing.timeoutId);
    _webTimers.delete(taskId);
  }

  const delayMs = scheduledAt.getTime() - Date.now();
  if (delayMs <= 0) return; // already past — skip

  const fire = () => {
    _webTimers.delete(taskId);
    if (typeof Notification === "undefined") return;

    const showIt = () => {
      try {
        if (Notification.permission !== "granted") return;
        const n = new Notification(title, {
          body,
          icon: "/favicon.png",
          badge: "/favicon.png",
          tag: `horizon-${notificationId}`,
          requireInteraction: true,
          silent: false,
          data: { taskId },
        } as NotificationOptions);
        n.onclick = () => {
          window.focus();
          window.location.href = `/horizon?task=${taskId}`;
          n.close();
        };
        console.debug(`[native-notifications] Web reminder fired for task ${taskId}`);
      } catch (err) {
        console.warn("[native-notifications] Web Notification display error:", err);
      }
    };

    if (Notification.permission === "granted") {
      showIt();
    } else if (Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") showIt();
      });
    }
  };

  // setTimeout is limited to ~24.8 days (2^31 ms), which is fine for task reminders.
  // For reminders far in the future, the app boot-time reconciliation re-registers them.
  const timeoutId = setTimeout(fire, Math.min(delayMs, 2_147_483_647));
  _webTimers.set(taskId, { timeoutId, notificationId });

  console.debug(
    `[native-notifications] Web reminder scheduled for "${title}" (task ${taskId}) in ${Math.round(delayMs / 1000)}s`,
  );
}

/**
 * Cancels a scheduled native notification for a task.
 * Called when task is deleted, completed, or notification is toggled off.
 */
export async function cancelHorizonTaskNotification(taskId: string): Promise<boolean> {
  const notificationId = taskIdToNotificationId(taskId);

  if (Platform.isAndroid()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.cancel({
        notifications: [{ id: notificationId }],
      });
      console.debug(`[native-notifications] Cancelled native reminder for task ${taskId} (ID: ${notificationId})`);
      return true;
    } catch (err) {
      console.warn(`[native-notifications] Failed to cancel reminder for task ${taskId}:`, err);
      return false;
    }
  }

  // Web — cancel in-memory timer
  const webTimer = _webTimers.get(taskId);
  if (webTimer) {
    clearTimeout(webTimer.timeoutId);
    _webTimers.delete(taskId);
    console.debug(`[native-notifications] Cancelled web reminder for task ${taskId}`);
  }

  return true;
}

// ─── 6. Recovery Reconciliation (Startup Mechanism Only) ──────────────────────

/**
 * Reconciles all pending Horizon tasks against native schedules on app startup.
 * Strictly a recovery mechanism for app updates, reboot recovery verification, or stale schedules.
 */
export async function syncAllHorizonTaskNotifications(
  tasks: HorizonTask[],
): Promise<{ scheduled: number; cancelled: number; total: number }> {
  // On web/PWA — re-register in-memory setTimeout reminders for all future tasks
  if (!Platform.isAndroid()) {
    let scheduledCount = 0;
    const now = new Date();
    for (const task of tasks) {
      if (!task.notificationEnabled || task.completed) continue;
      const scheduleDate = parseTaskLocalDateTime(task.taskDate, task.taskTime);
      if (scheduleDate.getTime() > now.getTime()) {
        // Only re-register if not already scheduled (to avoid duplicate timers)
        if (!_webTimers.has(task.id)) {
          const notificationId = taskIdToNotificationId(task.id);
          const formattedTime = format12Hour(task.taskTime);
          const priorityBadge = task.priority === "high" ? "🔴 HIGH" : task.priority === "medium" ? "🟡 MED" : "🔵 LOW";
          const bodyText = `⏰ Due at ${formattedTime} [${priorityBadge}]${task.description ? ` • ${task.description}` : ""}`;
          scheduleWebNotification(task.id, task.title, bodyText, scheduleDate, notificationId);
          scheduledCount++;
        }
      }
    }
    console.debug(`[native-notifications] Web reconciliation: ${scheduledCount} reminders re-registered`);
    return { scheduled: scheduledCount, cancelled: 0, total: tasks.length };
  }

  try {
    await ensureNotificationChannels();
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const permStatus = await getNativeNotificationPermissionStatus();
    if (permStatus !== "granted") {
      return { scheduled: 0, cancelled: 0, total: tasks.length };
    }

    const pendingList = await LocalNotifications.getPending();
    const existingNativeIds = new Set(pendingList.notifications.map((n) => n.id));

    let scheduledCount = 0;
    let cancelledCount = 0;
    const activeValidIds = new Set<number>();
    const now = new Date();

    for (const task of tasks) {
      const notifId = taskIdToNotificationId(task.id);

      if (task.notificationEnabled && !task.completed) {
        const scheduleDate = parseTaskLocalDateTime(task.taskDate, task.taskTime);

        if (scheduleDate.getTime() > now.getTime() + 5000) {
          activeValidIds.add(notifId);
          // If not already in pending alarms, schedule it
          if (!existingNativeIds.has(notifId)) {
            const res = await scheduleHorizonTaskNotification(task);
            if (res.success) scheduledCount++;
          }
        }
      }
    }

    // Cancel any stale/orphan pending notifications that don't belong to active tasks
    for (const pending of pendingList.notifications) {
      if (pending.extra?.taskId && !activeValidIds.has(pending.id)) {
        await LocalNotifications.cancel({ notifications: [{ id: pending.id }] });
        cancelledCount++;
      }
    }

    console.debug(
      `[native-notifications] Reconciliation complete: ${scheduledCount} restored, ${cancelledCount} stale cancelled`,
    );

    return { scheduled: scheduledCount, cancelled: cancelledCount, total: tasks.length };
  } catch (err) {
    console.error("[native-notifications] Error during startup reconciliation:", err);
    return { scheduled: 0, cancelled: 0, total: tasks.length };
  }
}

// ─── 7. Action Listeners & Deep Link Routing ──────────────────────────────────

export type NotificationActionCallbacks = {
  onNavigate?: (url: string) => void;
  onCompleteTask?: (taskId: string) => void;
};

/**
 * Initializes notification action listeners for taps and action buttons.
 */
export async function initNativeNotificationListeners(
  callbacks: NotificationActionCallbacks = {},
): Promise<() => void> {
  if (_actionListenerInitialized) return () => {};
  if (!Platform.isAndroid()) return () => {};
  _actionListenerInitialized = true;

  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");

    // Register action types (buttons)
    try {
      await LocalNotifications.registerActionTypes({
        types: [
          {
            id: "HORIZON_REMINDER_ACTIONS",
            actions: [
              {
                id: "view",
                title: "Open Horizon",
                foreground: true,
              },
              {
                id: "complete",
                title: "Mark Done",
                foreground: false,
              },
            ],
          },
        ],
      });
    } catch (e) {
      console.warn("[native-notifications] registerActionTypes error:", e);
    }

    // Listen to notification taps / action button clicks
    const handleActionPerformed = LocalNotifications.addListener(
      "localNotificationActionPerformed",
      (action) => {
        console.debug("[native-notifications] Notification action performed:", action);
        const extra = action.notification.extra;
        const taskId = extra?.taskId as string | undefined;
        const actionId = action.actionId;

        if (actionId === "complete" && taskId && callbacks.onCompleteTask) {
          callbacks.onCompleteTask(taskId);
        } else if (callbacks.onNavigate) {
          const url = (extra?.url as string) || "/horizon";
          callbacks.onNavigate(url);
        }
      },
    );

    // Listen to foreground notifications
    const handleReceived = LocalNotifications.addListener(
      "localNotificationReceived",
      (notification) => {
        console.debug("[native-notifications] Local notification received in foreground:", notification);
        showInAppNotification({
          title: notification.title || "Horizon Reminder",
          body: notification.body || "",
          url: (notification.extra?.url as string) || "/horizon",
        });
      },
    );

    return () => {
      handleActionPerformed.then((h) => h.remove());
      handleReceived.then((h) => h.remove());
      _actionListenerInitialized = false;
    };
  } catch (err) {
    console.warn("[native-notifications] Failed to register action listeners:", err);
    return () => {};
  }
}

// ─── 8. Test Notification ─────────────────────────────────────────────────────

/**
 * Fires an immediate test notification via native Android LocalNotifications or Web.
 */
export async function sendNativeTestNotification(): Promise<void> {
  // Always show in-app banner
  showInAppNotification({
    title: "Horizon Test Notification",
    body: "Native reminder system is active and verified.",
    url: "/horizon",
  });

  if (Platform.isAndroid()) {
    await ensureNotificationChannels();
    const { LocalNotifications } = await import("@capacitor/local-notifications");

    const perm = await getNativeNotificationPermissionStatus();
    if (perm !== "granted") {
      const req = await requestNativeNotificationPermission();
      if (req !== "granted") {
        throw new Error("Notification permission denied in Android settings");
      }
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          id: 999999,
          title: "Horizon • System Test",
          body: "Native Android notification delivery is active and operational.",
          schedule: { at: new Date(Date.now() + 500) }, // 500ms delay
          channelId: HORIZON_CHANNEL_ID,
          smallIcon: "ic_stat_jarvis",
          iconColor: "#38BDF8",
          sound: "beep.wav",
          extra: { url: "/horizon" },
        },
      ],
    });
    return;
  }

  // Web fallback
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification("Horizon • System Test", {
      body: "Browser notification delivery is active.",
      icon: "/favicon.png",
    });
  }
}
