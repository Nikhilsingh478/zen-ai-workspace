import { Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "sonner";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { initFCM } from "@/lib/fcm";
import { VoiceOverlay } from "@/components/voice-overlay";
import { InAppNotificationHost } from "@/components/in-app-notification";
import { JarvisFloatingOrb } from "@/components/jarvis/floating-orb";
import { jarvis } from "@/lib/jarvis";
import { initNativeLifecycle, initStatusBar, hideSplashScreen } from "@/lib/platform/native-lifecycle";

// ─── Route ────────────────────────────────────────────────────────────────────

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-5xl font-bold mb-4">404</h1>
        <a href="/" className="text-copy-secondary hover:text-foreground underline transition-colors">
          Go home
        </a>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

// ─── Splashscreen ─────────────────────────────────────────────────────────────

function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 1600);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background"
    >
      {/* Radial ambient glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 60% 45% at 50% 50%, rgba(255,255,255,0.028) 0%, transparent 70%)",
        }}
      />

      {/* Logo mark */}
      <motion.div
        initial={{ opacity: 0, scale: 0.78, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
        className="relative mb-5"
      >
        {/* Outer glow ring */}
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.18 }}
          className="absolute inset-[-10px] rounded-[28px] border border-white/[0.05]"
          style={{ boxShadow: "0 0 40px rgba(255,255,255,0.04)" }}
        />

        {/* Icon container */}
        <div className="h-[64px] w-[64px] rounded-[20px] bg-white/[0.07] border border-white/[0.1] grid place-items-center shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <AIMetricsIcon />
        </div>
      </motion.div>

      {/* Wordmark */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.28 }}
        className="text-center"
      >
        <p className="text-[17px] font-semibold tracking-tight text-white/90 leading-none">
          AI Metrics
        </p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="text-[12px] text-white/25 mt-1.5 tracking-wide"
        >
          Personal AI operating system
        </motion.p>
      </motion.div>

      {/* Loading bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.55 }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 w-[120px] h-px bg-white/[0.06] rounded-full overflow-hidden"
      >
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: "0%" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.6 }}
          className="h-full w-full bg-gradient-to-r from-transparent via-white/25 to-transparent rounded-full"
        />
      </motion.div>
    </motion.div>
  );
}

function AIMetricsIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="10" height="10" rx="2.5" fill="rgba(255,255,255,0.55)" />
      <rect x="15" y="3" width="10" height="10" rx="2.5" fill="rgba(255,255,255,0.22)" />
      <rect x="3" y="15" width="10" height="10" rx="2.5" fill="rgba(255,255,255,0.22)" />
      <rect x="15" y="15" width="10" height="10" rx="2.5" fill="rgba(255,255,255,0.38)" />
    </svg>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    initFCM().catch(() => {});
    jarvis.autoStartIfEnabled();
    initStatusBar().catch(() => {});
    initNativeLifecycle().catch(() => {});
  }, []);

  return (
    <>
      <AnimatePresence>
        {!splashDone && (
          <Splash
            key="splash"
            onDone={() => {
              setSplashDone(true);
              hideSplashScreen().catch(() => {});
            }}
          />
        )}
      </AnimatePresence>

      <AppShell>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="h-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </AppShell>

      {/* VoiceOverlay removed — Jarvis FloatingOrb handles this role
      <VoiceOverlay />
      */}
      <JarvisFloatingOrb />

      {/* In-app notification banners (Instagram-style, top of screen) */}
      <InAppNotificationHost />

      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--surface-2)",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "#EDEDED",
          },
        }}
      />
    </>
  );
}
