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
    // hostname is "localhost" by default — leaves pushState routing intact.
    cleartext: false,
  },

  // ── Android-specific ──────────────────────────────────────────────────────
  android: {
    // Allow WebView to be inspectable from Chrome DevTools during development.
    // This is automatically disabled in release builds by Capacitor.
    webContentsDebuggingEnabled: true,

    // Keep the keyboard from resizing the WebView — our layouts handle
    // keyboard avoidance in CSS (dvh units, pb-safe, etc.)
    allowMixedContent: false,

    // Capture text input correctly inside WebView
    captureInput: true,

    // Minimum SDK 26 (Android 8.0) for reliable WebRTC microphone access
    // minSdkVersion is set in build.gradle, not here — this is metadata only.
  },

  // ── Plugin configuration ───────────────────────────────────────────────────
  plugins: {
    // SplashScreen: We manage our own React splash animation, so we suppress
    // the native splash as quickly as possible.
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

    // StatusBar: Dark immersive mode — matches the app's dark design system.
    StatusBar: {
      style: "Dark",
      backgroundColor: "#0a0a0a",
      overlaysWebView: true,
    },

    // App: handle back-button and state-change events.
    // Actual listener code lives in src/lib/platform/native-lifecycle.ts.
    App: {},

    // Haptics: available for future Jarvis interaction feedback.
    Haptics: {},

    // PushNotifications placeholder — Phase 2 will migrate from Firebase web SDK
    // to native push via @capacitor/push-notifications for Android foreground service.
    // PushNotifications: {
    //   presentationOptions: ["badge", "sound", "alert"],
    // },
  },
};

export default config;
