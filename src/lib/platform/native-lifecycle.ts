/**
 * Native Android lifecycle handler.
 *
 * Handles Capacitor-specific events:
 *   - Hardware back button: navigate back or exit if at root
 *   - App state changes: foreground / background
 *
 * Called once on app startup from __root.tsx.
 * Safe to call in web/PWA — all Capacitor imports are guarded.
 */

import { Platform } from "./index";

let _backHandler: (() => void) | null = null;
let _initialized = false;

/**
 * Register a custom back button handler.
 * When set, pressing Android back calls this instead of the default behaviour.
 */
export function setBackHandler(handler: (() => void) | null) {
  _backHandler = handler;
}

/**
 * Initialize Android native lifecycle listeners.
 * No-op on web/PWA.
 */
export async function initNativeLifecycle(): Promise<void> {
  if (_initialized) return;
  if (!Platform.isAndroid()) return;
  _initialized = true;

  try {
    const { App } = await import("@capacitor/app");

    // ── Hardware back button ─────────────────────────────────────────────────
    App.addListener("backButton", ({ canGoBack }) => {
      if (_backHandler) {
        _backHandler();
        return;
      }

      if (canGoBack) {
        window.history.back();
      } else {
        // At root — minimize the app instead of exiting (feels more native)
        App.minimizeApp();
      }
    });

    // ── App state changes ────────────────────────────────────────────────────
    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        console.debug("[native-lifecycle] App foregrounded");
      } else {
        console.debug("[native-lifecycle] App backgrounded");
      }
    });

    // ── App URL open (deep links) ────────────────────────────────────────────
    App.addListener("appUrlOpen", (data) => {
      console.debug("[native-lifecycle] appUrlOpen", data.url);
      // Future: parse deep link and navigate to the correct route
    });

    console.debug("[native-lifecycle] Android lifecycle listeners registered");
  } catch (err) {
    console.warn("[native-lifecycle] Failed to initialize Capacitor App plugin:", err);
  }
}

/**
 * Initialize Android status bar for edge-to-edge immersive feel.
 * No-op on web/PWA.
 */
export async function initStatusBar(): Promise<void> {
  if (!Platform.isAndroid()) return;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");

    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setBackgroundColor({ color: "#00000000" });

    console.debug("[native-lifecycle] StatusBar configured: dark, overlay, transparent");
  } catch (err) {
    console.warn("[native-lifecycle] StatusBar init failed:", err);
  }
}

/**
 * Hide the native splash screen.
 * Called after the React app has mounted and the splash animation begins.
 */
export async function hideSplashScreen(): Promise<void> {
  if (!Platform.isAndroid()) return;

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide({ fadeOutDuration: 200 });
    console.debug("[native-lifecycle] SplashScreen hidden");
  } catch (err) {
    console.warn("[native-lifecycle] SplashScreen hide failed:", err);
  }
}
