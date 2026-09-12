/**
 * jarvis-native.ts — TypeScript bridge to the JarvisPlugin Capacitor plugin.
 *
 * Wraps the native Android foreground service (JarvisService.kt), offline
 * Kokoro-82M TTS, and OEM battery exemption helpers so the React layer can
 * interact seamlessly with hardware.
 *
 * All calls are platform-guarded — they are safe to call on web/PWA (they will
 * resolve immediately with a safe no-op result rather than throwing).
 */

import { Capacitor, registerPlugin } from "@capacitor/core";

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

export interface CommandEvent {
  transcript: string;
}

export interface ListenerHandle {
  remove: () => Promise<void>;
}

export interface OemBatteryStatus {
  manufacturer: string;
  oemCategory: string;
  hasSpecialAutostart: boolean;
  isIgnoringBatteryOptimizations: boolean;
}

// ── Internal: synchronous plugin access ───────────────────────────────────────

let _plugin: Record<string, (...args: unknown[]) => Promise<unknown>> | null = null;

function getPlugin() {
  if (_plugin) return _plugin;
  if (!Capacitor.isNativePlatform()) return null;

  try {
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
    const plugin = getPlugin();
    if (!plugin) {
      return { microphone: "granted", notifications: "granted" };
    }
    return (await plugin.requestJarvisPermissions()) as PermissionResult;
  },

  /**
   * Start the Jarvis foreground service.
   * On web, silently resolves (no-op).
   */
  async startService(): Promise<{ success: boolean }> {
    const plugin = getPlugin();
    if (!plugin) return { success: false };
    return (await plugin.startJarvisService()) as { success: boolean };
  },

  /**
   * Stop the Jarvis foreground service.
   * On web, silently resolves (no-op).
   */
  async stopService(): Promise<{ success: boolean }> {
    const plugin = getPlugin();
    if (!plugin) return { success: false };
    return (await plugin.stopJarvisService()) as { success: boolean };
  },

  /**
   * Query whether the foreground service is currently running.
   */
  async isRunning(): Promise<boolean> {
    const plugin = getPlugin();
    if (!plugin) return false;
    const result = (await plugin.isServiceRunning()) as ServiceStatus;
    return result.running;
  },

  /**
   * Register a callback that fires when the wake word ("jarvis", "hey jarvis", "ok jarvis") is detected.
   * Returns a handle with a .remove() method to unsubscribe.
   * On web, returns a no-op handle.
   */
  async onWakeWord(
    callback: (event: WakeWordEvent) => void
  ): Promise<ListenerHandle> {
    const plugin = getPlugin();
    if (!plugin) {
      return { remove: async () => {} };
    }

    const handle = await (plugin as unknown as {
      addListener: (
        event: string,
        cb: (data: WakeWordEvent) => void
      ) => Promise<ListenerHandle>;
    }).addListener("wakeWord", callback);

    return handle;
  },

  async onCommand(callback: (event: CommandEvent) => void): Promise<ListenerHandle> {
    const plugin = getPlugin();
    if (!plugin) return { remove: async () => {} };
    return (plugin as unknown as {
      addListener: (event: string, cb: (data: CommandEvent) => void) => Promise<ListenerHandle>;
    }).addListener("command", callback);
  },

  async startCommandListening(): Promise<{ success: boolean }> {
    const plugin = getPlugin();
    if (!plugin) return { success: false };
    return (await plugin.startCommandListening()) as { success: boolean };
  },

  async cancelCommandListening(): Promise<{ success: boolean }> {
    const plugin = getPlugin();
    if (!plugin) return { success: false };
    return (await plugin.cancelCommandListening()) as { success: boolean };
  },

  // ── Native TTS ─────────────────────────────────────────────────────────────

  /**
   * Synthesize and play speech natively via sherpa-onnx Kokoro-82M.
   */
  async speak(text: string, sid = 0, speed = 1.0): Promise<{ success: boolean }> {
    const plugin = getPlugin();
    if (!plugin) return { success: false };
    return (await plugin.speak({ text, sid, speed })) as { success: boolean };
  },

  /**
   * Stop any current native TTS playback.
   */
  async stopSpeaking(): Promise<{ success: boolean }> {
    const plugin = getPlugin();
    if (!plugin) return { success: false };
    return (await plugin.stopSpeaking()) as { success: boolean };
  },

  /**
   * Check if native TTS is currently synthesizing or speaking.
   */
  async isSpeaking(): Promise<boolean> {
    const plugin = getPlugin();
    if (!plugin) return false;
    const res = (await plugin.isSpeaking()) as { speaking: boolean };
    return res.speaking;
  },

  // ── Battery Exemption & OEM Helpers ────────────────────────────────────────

  /**
   * Check if the app is currently excluded from Android battery optimizations.
   */
  async checkBatteryOptimization(): Promise<boolean> {
    const plugin = getPlugin();
    if (!plugin) return true;
    const res = (await plugin.checkBatteryOptimization()) as {
      isIgnoringBatteryOptimizations: boolean;
    };
    return res.isIgnoringBatteryOptimizations;
  },

  /**
   * Request battery optimization exemption (shows system dialog).
   */
  async requestBatteryOptimization(): Promise<{ success: boolean }> {
    const plugin = getPlugin();
    if (!plugin) return { success: false };
    return (await plugin.requestBatteryOptimization()) as { success: boolean };
  },

  /**
   * Check OEM manufacturer info and battery restriction policies.
   */
  async checkOemBatteryRestrictions(): Promise<OemBatteryStatus> {
    const plugin = getPlugin();
    if (!plugin) {
      return {
        manufacturer: "generic",
        oemCategory: "generic",
        hasSpecialAutostart: false,
        isIgnoringBatteryOptimizations: true,
      };
    }
    return (await plugin.checkOemBatteryRestrictions()) as OemBatteryStatus;
  },

  /**
   * Open the OEM's custom autostart / background settings screen if supported.
   */
  async openOemAutostartSettings(): Promise<{ success: boolean; reason?: string }> {
    const plugin = getPlugin();
    if (!plugin) return { success: false };
    return (await plugin.openOemAutostartSettings()) as {
      success: boolean;
      reason?: string;
    };
  },
};
