/**
 * jarvis-native.ts — TypeScript bridge to the JarvisPlugin Capacitor plugin.
 *
 * Wraps the native Android foreground service (JarvisService.kt) so the React
 * layer can start/stop the always-on Jarvis assistant and receive wake-word events.
 *
 * All calls are platform-guarded — they are safe to call on web/PWA (they will
 * resolve immediately with a no-op result rather than throwing).
 *
 * Usage:
 *   import { JarvisNative } from '@/lib/platform/jarvis-native'
 *
 *   // Request permissions, then start the background service
 *   const perms = await JarvisNative.requestPermissions()
 *   if (perms.microphone === 'granted') {
 *     await JarvisNative.startService()
 *   }
 *
 *   // Listen for wake word
 *   const handle = await JarvisNative.onWakeWord(({ phrase }) => {
 *     console.log('Wake word:', phrase)  // e.g. "hey jarvis"
 *   })
 *
 *   // Later: stop and clean up
 *   await handle.remove()
 *   await JarvisNative.stopService()
 */

import { Platform } from "./index";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PermissionResult {
  microphone: "granted" | "denied" | "prompt";
  notifications: "granted" | "denied" | "prompt";
}

export interface ServiceStatus {
  running: boolean;
}

export interface WakeWordEvent {
  phrase: string;
  confidence: number;
}

export interface ListenerHandle {
  remove: () => Promise<void>;
}

// ── Internal: lazy-load the Capacitor plugin ──────────────────────────────────

let _plugin: Record<string, (...args: unknown[]) => Promise<unknown>> | null =
  null;

async function getPlugin() {
  if (_plugin) return _plugin;
  if (!Platform.isAndroid()) return null;

  try {
    const { registerPlugin } = await import("@capacitor/core");
    _plugin = registerPlugin<Record<string, (...args: unknown[]) => Promise<unknown>>>("Jarvis");
    return _plugin;
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export const JarvisNative = {
  /**
   * Request microphone + notification runtime permissions.
   * On web, returns "granted" for both (browser handles permissions separately).
   */
  async requestPermissions(): Promise<PermissionResult> {
    const plugin = await getPlugin();
    if (!plugin) {
      return { microphone: "granted", notifications: "granted" };
    }
    return plugin.requestJarvisPermissions() as Promise<PermissionResult>;
  },

  /**
   * Start the Jarvis foreground service.
   * On web, silently resolves (no-op).
   */
  async startService(): Promise<{ success: boolean }> {
    const plugin = await getPlugin();
    if (!plugin) return { success: false };
    return plugin.startJarvisService() as Promise<{ success: boolean }>;
  },

  /**
   * Stop the Jarvis foreground service.
   * On web, silently resolves (no-op).
   */
  async stopService(): Promise<{ success: boolean }> {
    const plugin = await getPlugin();
    if (!plugin) return { success: false };
    return plugin.stopJarvisService() as Promise<{ success: boolean }>;
  },

  /**
   * Query whether the foreground service is currently running.
   */
  async isRunning(): Promise<boolean> {
    const plugin = await getPlugin();
    if (!plugin) return false;
    const result = await plugin.isServiceRunning() as ServiceStatus;
    return result.running;
  },

  /**
   * Register a callback that fires when the wake word "Hey Jarvis" is detected.
   * Returns a handle with a .remove() method to unsubscribe.
   * On web, returns a no-op handle.
   */
  async onWakeWord(
    callback: (event: WakeWordEvent) => void
  ): Promise<ListenerHandle> {
    const plugin = await getPlugin();
    if (!plugin) {
      return { remove: async () => {} };
    }

    // Capacitor's addListener returns a PluginListenerHandle
    const handle = await (plugin as unknown as {
      addListener: (
        event: string,
        cb: (data: WakeWordEvent) => void
      ) => Promise<ListenerHandle>;
    }).addListener("wakeWord", callback);

    return handle;
  },
};
