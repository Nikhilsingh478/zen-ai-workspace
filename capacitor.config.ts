import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for AI Matrix native Android app.
 *
 * Phase 1 — foundation only.
 * Phase 2+ will add: foreground service, Porcupine wake word, native push.
 *
 * IMPORTANT: No `server` block here. No androidScheme, no server.url, no
 * cleartext, no live-reload config. Capacitor will load assets from:
 *   android/app/src/main/assets/public
 * using the default capacitor://localhost scheme. This is production-only
 * bundled asset mode — the WebView never makes a network request to boot.
 */
const config: CapacitorConfig = {
  appId: "com.aimatrix.app",
  appName: "AI Matrix",
  webDir: "dist",

  // ── Android-specific ──────────────────────────────────────────────────────
  android: {
    // Allow WebView to be inspectable from Chrome DevTools during development.
    // Capacitor automatically disables this in release/production builds.
    webContentsDebuggingEnabled: true,

    // Correct text input capture inside WebView
    captureInput: true,
  },

  // ── Plugin configuration ───────────────────────────────────────────────────
  plugins: {
    // SplashScreen: React handles its own splash animation, so hide the
    // native splash immediately to avoid a double-splash flash.
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

    // StatusBar: overlay the WebView for true edge-to-edge.
    StatusBar: {
      style: "Dark",
      backgroundColor: "#00000000",
      overlaysWebView: true,
    },

    // App: back-button and app state-change events.
    App: {},

    // Haptics: available for Jarvis interaction feedback.
    Haptics: {},
  },
};

export default config;
