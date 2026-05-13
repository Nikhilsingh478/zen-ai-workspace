import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for AI Matrix native Android app.
 *
 * Phase 1 — foundation only.
 * Phase 2+ will add: foreground service, Porcupine wake word, native push.
 */
const config: CapacitorConfig = {
  appId: "com.aimatrix.app",
  appName: "AI Matrix",
  webDir: "dist",

  // ── Server ────────────────────────────────────────────────────────────────
  // androidScheme: "https" ensures cookies, localStorage, and IndexedDB behave
  // as on a real HTTPS origin inside the WebView (avoids mixed-content issues).
  server: {
    androidScheme: "https",
    cleartext: false,
  },

  // ── Android-specific ──────────────────────────────────────────────────────
  android: {
    // Allow WebView to be inspectable from Chrome DevTools during development.
    // Automatically disabled in release builds by Capacitor.
    webContentsDebuggingEnabled: true,

    // Capture text input correctly inside WebView
    captureInput: true,

    allowMixedContent: false,

    // minSdkVersion 26 (Android 8.0) — set in variables.gradle
  },

  // ── Plugin configuration ───────────────────────────────────────────────────
  plugins: {
    // SplashScreen: We manage our own React splash animation, so we hide the
    // native splash as quickly as possible to avoid a double-splash.
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#0a0a0a",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },

    // StatusBar: Overlays the WebView so the app goes truly edge-to-edge.
    StatusBar: {
      style: "Dark",
      backgroundColor: "#00000000",
      overlaysWebView: true,
    },

    // App: handle back-button and state-change events.
    App: {},

    // Haptics: available for Jarvis interaction feedback.
    Haptics: {},
  },
};

export default config;
