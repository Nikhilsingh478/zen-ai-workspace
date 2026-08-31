import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.aimatrix.app",
  appName: "AI Matrix",
  webDir: "dist",
  server: {
    androidScheme: 'https',
    allowNavigation: ['*.supabase.co', '*.googleapis.com', '*.google.com']
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false, // true only during dev
  },
  ios: {
    contentInset: 'always',
    allowsLinkPreview: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0A0A0A',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_jarvis',
      iconColor: '#38bdf8',
      sound: 'beep.wav',
    },
  },
};

export default config;
