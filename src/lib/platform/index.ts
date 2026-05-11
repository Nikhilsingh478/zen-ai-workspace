/**
 * Platform — central detection and capability utilities for AI Metrics.
 *
 * The app runs in three environments:
 *   - "web"    regular browser tab (dev server or deployed)
 *   - "pwa"    installed PWA (standalone display mode)
 *   - "tauri"  native desktop wrapper (future — Windows / macOS / Linux)
 *
 * Always program against the abstraction interfaces in this directory,
 * never directly against browser or Tauri APIs. That keeps the migration
 * path clean when we add the Tauri shell later.
 */

export type PlatformName = "tauri" | "pwa" | "web";

export const Platform = {
  /**
   * True when running inside a Tauri native window.
   * Tauri injects `window.__TAURI__` at startup — reliable detection signal.
   */
  isNative: (): boolean =>
    typeof window !== "undefined" && "__TAURI__" in window,

  /** True when installed as a PWA (standalone display mode). */
  isPWA: (): boolean =>
    typeof window !== "undefined" &&
    window.matchMedia("(display-mode: standalone)").matches,

  /** True when running in a plain browser tab. */
  isBrowser: (): boolean =>
    typeof window !== "undefined" &&
    !("__TAURI__" in window) &&
    !window.matchMedia("(display-mode: standalone)").matches,

  /** Resolved platform identifier. */
  name: (): PlatformName => {
    if (typeof window === "undefined") return "web";
    if ("__TAURI__" in window) return "tauri";
    if (window.matchMedia("(display-mode: standalone)").matches) return "pwa";
    return "web";
  },

  /** Human-readable label for diagnostics or UI surfaces. */
  label: (): string => {
    const labels: Record<PlatformName, string> = {
      tauri: "Desktop (Tauri)",
      pwa:   "PWA",
      web:   "Web Browser",
    };
    return labels[Platform.name()];
  },
} as const;

export * from "./notifications";
export * from "./storage";
export * from "./system";
export * from "./voice";
export * from "./window";
