import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getMessaging, type Messaging } from "firebase/messaging";

// ─── Config ───────────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** True when all required VITE_FIREBASE_* env vars are present. */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.messagingSenderId &&
  firebaseConfig.appId,
);

// ─── Singleton getters ────────────────────────────────────────────────────────

let _app: FirebaseApp | null = null;
let _messaging: Messaging | null = null;

/**
 * Returns the shared Firebase App instance, or null if env vars are missing.
 * Safe to call multiple times — initializes at most once.
 */
export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null;
  if (typeof window === "undefined") return null;
  try {
    if (_app) return _app;
    const existing = getApps().find((a) => a.name === "[DEFAULT]");
    _app = existing ?? initializeApp(firebaseConfig);
    return _app;
  } catch (err) {
    console.error("[firebase] init error", err);
    return null;
  }
}

/**
 * Returns the shared Firebase Messaging instance, or null if unsupported.
 * Requires: Firebase configured + browser environment + ServiceWorker supported.
 */
export function getMessagingInstance(): Messaging | null {
  if (_messaging) return _messaging;
  const app = getFirebaseApp();
  if (!app) return null;
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;
  if (!("PushManager" in window)) return null;
  try {
    _messaging = getMessaging(app);
    return _messaging;
  } catch (err) {
    console.error("[firebase] messaging init error", err);
    return null;
  }
}
