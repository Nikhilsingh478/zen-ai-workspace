/**
 * Platform — central detection and capability utilities for AI Matrix.
 *
 * The app runs in four environments:
 *   - "android"  Capacitor-wrapped Android APK
 *   - "tauri"    native desktop wrapper (future — Windows / macOS / Linux)
 *   - "pwa"      installed PWA (standalone display mode)
 *   - "web"      regular browser tab (dev server or deployed)
 *
 * Always program against the abstraction interfaces in this directory,
 * never directly against browser or Tauri/Capacitor APIs.
 */

export type PlatformName = "android" | "tauri" | "pwa" | "web";

export const Platform = {
  /**
   * True when running inside a Capacitor Android WebView.
   * Capacitor injects window.Capacitor at startup.
   */
  isAndroid: (): boolean =>
    typeof window !== "undefined" &&
    "Capacitor" in window &&
    (window as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.() === "android",

  /**
   * True when running inside a Tauri native window.
   * Tauri injects `window.__TAURI__` at startup.
   */
  isNative: (): boolean =>
    typeof window !== "undefined" && "__TAURI__" in window,

  /** True when installed as a PWA (standalone display mode). */
  isPWA: (): boolean =>
    typeof window !== "undefined" &&
    window.matchMedia("(display-mode: standalone)").matches,

  /** True when running in a plain browser tab. */
  isBrowser: (): boolean => {
    if (typeof window === "undefined") return false;
    if ("Capacitor" in window) return false;
    if ("__TAURI__" in window) return false;
    if (window.matchMedia("(display-mode: standalone)").matches) return false;
    return true;
  },

  /** Resolved platform identifier. */
  name: (): PlatformName => {
    if (typeof window === "undefined") return "web";
    if (
      "Capacitor" in window &&
      (window as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.() === "android"
    ) return "android";
    if ("__TAURI__" in window) return "tauri";
    if (window.matchMedia("(display-mode: standalone)").matches) return "pwa";
    return "web";
  },

  /** Human-readable label for diagnostics or UI surfaces. */
  label: (): string => {
    const labels: Record<PlatformName, string> = {
      android: "Android",
      tauri:   "Desktop (Tauri)",
      pwa:     "PWA",
      web:     "Web Browser",
    };
    return labels[Platform.name()];
  },
} as const;

export * from "./notifications";
export * from "./storage";
export * from "./system";
export * from "./voice";
export * from "./window";
