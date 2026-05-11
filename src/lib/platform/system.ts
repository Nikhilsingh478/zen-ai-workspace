/**
 * System abstraction — tray, global shortcuts, startup, OS integration.
 *
 * Current (web/PWA): all stubs — browser has no access to these features.
 * Future (Tauri):    real implementations via Tauri plugins:
 *                    - tauri-plugin-autostart
 *                    - tauri-plugin-global-shortcut
 *                    - @tauri-apps/plugin-system-tray
 *
 * All functions return Promise<void> or Promise<boolean> so callers
 * work identically in both environments. On web, operations are no-ops.
 */

import { Platform } from "./index";

// ── Types ─────────────────────────────────────────────────────────────────────

export type GlobalShortcut =
  | "CmdOrCtrl+Space"  // open/focus assistant
  | "CmdOrCtrl+H"      // go to Horizon
  | "CmdOrCtrl+Shift+V"; // activate voice mode

export interface TrayConfig {
  tooltip?: string;
  iconPath?: string;
}

// ── Tray ──────────────────────────────────────────────────────────────────────

export const TrayService = {
  /**
   * Show the system tray icon.
   * No-op on web/PWA. Future: invoke("tray_show") in Tauri.
   */
  show: async (config?: TrayConfig): Promise<void> => {
    if (!Platform.isNative()) return;
    // Future: await invoke("tray_show", { tooltip: config?.tooltip, icon: config?.iconPath });
    console.debug("[platform/tray] show", config);
  },

  /** Hide the system tray icon. */
  hide: async (): Promise<void> => {
    if (!Platform.isNative()) return;
    // Future: await invoke("tray_hide");
    console.debug("[platform/tray] hide");
  },

  /** Update the tray tooltip text. */
  setTooltip: async (text: string): Promise<void> => {
    if (!Platform.isNative()) return;
    // Future: await invoke("tray_set_tooltip", { text });
    console.debug("[platform/tray] setTooltip", text);
  },
} as const;

// ── Global shortcuts ──────────────────────────────────────────────────────────

export const ShortcutService = {
  /**
   * Register a global OS-level shortcut.
   * No-op on web (browser shortcuts use addEventListener instead).
   * Future: tauri-plugin-global-shortcut.
   */
  register: async (shortcut: GlobalShortcut, callback: () => void): Promise<boolean> => {
    if (!Platform.isNative()) return false;
    // Future:
    //   await register(shortcut, callback);
    console.debug("[platform/shortcuts] register", shortcut);
    void callback; // suppress unused warning
    return true;
  },

  /** Unregister a previously registered global shortcut. */
  unregister: async (shortcut: GlobalShortcut): Promise<void> => {
    if (!Platform.isNative()) return;
    // Future: await unregister(shortcut);
    console.debug("[platform/shortcuts] unregister", shortcut);
  },

  /** Unregister all shortcuts registered by this app. */
  unregisterAll: async (): Promise<void> => {
    if (!Platform.isNative()) return;
    // Future: await unregisterAll();
    console.debug("[platform/shortcuts] unregisterAll");
  },
} as const;

// ── Startup ───────────────────────────────────────────────────────────────────

export const StartupService = {
  /**
   * Enable launch-at-OS-startup.
   * No-op on web/PWA.
   * Future: tauri-plugin-autostart → enable().
   */
  enable: async (): Promise<void> => {
    if (!Platform.isNative()) return;
    // Future: await enable(); (tauri-plugin-autostart)
    console.debug("[platform/startup] enable");
  },

  /** Disable launch-at-OS-startup. */
  disable: async (): Promise<void> => {
    if (!Platform.isNative()) return;
    // Future: await disable();
    console.debug("[platform/startup] disable");
  },

  /** Returns whether launch-at-startup is currently enabled. */
  isEnabled: async (): Promise<boolean> => {
    if (!Platform.isNative()) return false;
    // Future: return await isEnabled();
    return false;
  },
} as const;

// ── Window lifecycle ──────────────────────────────────────────────────────────

export const AppLifecycle = {
  /**
   * Minimise to system tray instead of hiding the window.
   * No-op on web/PWA.
   */
  minimizeToTray: async (): Promise<void> => {
    if (!Platform.isNative()) return;
    // Future: const win = getCurrentWindow(); await win.hide();
    console.debug("[platform/lifecycle] minimizeToTray");
  },

  /** Bring the app window to the foreground. */
  focus: async (): Promise<void> => {
    if (!Platform.isNative()) return;
    // Future: const win = getCurrentWindow(); await win.setFocus();
    console.debug("[platform/lifecycle] focus");
  },
} as const;
