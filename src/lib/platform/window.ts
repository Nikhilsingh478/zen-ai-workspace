/**
 * Window management abstraction.
 *
 * Current (web/PWA): document.title mutations only; all window ops are no-ops.
 * Future (Tauri):    @tauri-apps/api/window → WebviewWindow, getCurrentWindow()
 *
 * Keeping window management behind this interface means the UI code
 * doesn't need to change when the Tauri shell is added.
 */

import { Platform } from "./index";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WindowSize {
  width:  number;
  height: number;
}

export interface WindowPosition {
  x: number;
  y: number;
}

// ── Window service ────────────────────────────────────────────────────────────

export const WindowService = {
  /** Minimise the window. No-op on web. */
  minimize: async (): Promise<void> => {
    if (!Platform.isNative()) return;
    // Future: await getCurrentWindow().minimize();
    console.debug("[platform/window] minimize");
  },

  /** Maximise / restore the window. No-op on web. */
  toggleMaximize: async (): Promise<void> => {
    if (!Platform.isNative()) return;
    // Future: await getCurrentWindow().toggleMaximize();
    console.debug("[platform/window] toggleMaximize");
  },

  /** Close the window. No-op on web. */
  close: async (): Promise<void> => {
    if (!Platform.isNative()) return;
    // Future: await getCurrentWindow().close();
    console.debug("[platform/window] close");
  },

  /** Centre the window on screen. No-op on web. */
  center: async (): Promise<void> => {
    if (!Platform.isNative()) return;
    // Future: await getCurrentWindow().center();
    console.debug("[platform/window] center");
  },

  /** Pin the window above all others. No-op on web. */
  setAlwaysOnTop: async (enabled: boolean): Promise<void> => {
    if (!Platform.isNative()) return;
    // Future: await getCurrentWindow().setAlwaysOnTop(enabled);
    console.debug("[platform/window] setAlwaysOnTop", enabled);
  },

  /** Show/hide native window decorations (titlebar, borders). No-op on web. */
  setDecorations: async (enabled: boolean): Promise<void> => {
    if (!Platform.isNative()) return;
    // Future: await getCurrentWindow().setDecorations(enabled);
    console.debug("[platform/window] setDecorations", enabled);
  },

  /**
   * Set the window title.
   * Works on both web (document.title) and Tauri.
   */
  setTitle: async (title: string): Promise<void> => {
    document.title = title;
    if (!Platform.isNative()) return;
    // Future: await getCurrentWindow().setTitle(title);
  },

  /** Resize the window. No-op on web. */
  setSize: async (size: WindowSize): Promise<void> => {
    if (!Platform.isNative()) return;
    // Future:
    //   const { LogicalSize } = await import("@tauri-apps/api/dpi");
    //   await getCurrentWindow().setSize(new LogicalSize(size.width, size.height));
    console.debug("[platform/window] setSize", size);
  },

  /** Reposition the window. No-op on web. */
  setPosition: async (pos: WindowPosition): Promise<void> => {
    if (!Platform.isNative()) return;
    // Future:
    //   const { LogicalPosition } = await import("@tauri-apps/api/dpi");
    //   await getCurrentWindow().setPosition(new LogicalPosition(pos.x, pos.y));
    console.debug("[platform/window] setPosition", pos);
  },

  /** Returns the current inner window size, or a fallback for web. */
  getSize: async (): Promise<WindowSize> => {
    if (!Platform.isNative()) {
      return { width: window.innerWidth, height: window.innerHeight };
    }
    // Future:
    //   const size = await getCurrentWindow().innerSize();
    //   return { width: size.width, height: size.height };
    return { width: window.innerWidth, height: window.innerHeight };
  },
} as const;
