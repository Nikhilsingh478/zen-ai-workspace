import { Outlet, createRootRoute, useRouterState, useRouter } from "@tanstack/react-router";
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
import { ensureNotificationChannels, initNativeNotificationListeners } from "@/lib/native-notifications";
import { useHorizon } from "@/lib/horizon";

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

// ─── Cinematic Loader ─────────────────────────────────────────────────────────

const LOADER_DURATION = 2200; // ms total before onDone fires

function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, LOADER_DURATION);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "oklch(0.10 0.02 250)" }}
    >
      {/* ─── Deep space ambient noise texture ─── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 70% 55% at 50% 40%, rgba(56,189,248,0.055) 0%, transparent 65%),
            radial-gradient(ellipse 40% 30% at 30% 70%, rgba(99,102,241,0.04) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 70% 20%, rgba(56,189,248,0.03) 0%, transparent 60%)
          `,
        }}
      />

      {/* ─── Breathing aurora pulse ─── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ animation: "aurora-breathe 3.5s ease-in-out infinite" }}
      >
        <div
          style={{
            position: "absolute",
            top: "30%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 380,
            height: 180,
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(56,189,248,0.07) 0%, transparent 70%)",
            filter: "blur(32px)",
          }}
        />
      </div>

      {/* ─── Orbital ring system ─── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
        className="relative mb-8"
        style={{ width: 108, height: 108 }}
      >
        {/* Outer glow disc */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(56,189,248,0.08) 0%, transparent 70%)",
            animation: "glow-pulse 2.4s ease-in-out infinite",
          }}
        />

        {/* SVG orbital rings */}
        <svg
          width="108"
          height="108"
          viewBox="0 0 108 108"
          fill="none"
          className="absolute inset-0"
          style={{ transform: "rotate(-90deg)" }}
        >
          {/* Outer static ring */}
          <circle
            cx="54" cy="54" r="50"
            stroke="rgba(56,189,248,0.07)"
            strokeWidth="1"
          />
          {/* Animated arc — draws itself in */}
          <circle
            cx="54" cy="54" r="50"
            stroke="url(#arcGrad)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="314"
            strokeDashoffset="314"
            style={{ animation: "arc-draw 1.4s cubic-bezier(0.22,1,0.36,1) 0.15s forwards" }}
          />
          {/* Inner ring */}
          <circle
            cx="54" cy="54" r="40"
            stroke="rgba(56,189,248,0.05)"
            strokeWidth="0.75"
          />
          <circle
            cx="54" cy="54" r="40"
            stroke="rgba(56,189,248,0.18)"
            strokeWidth="0.75"
            strokeLinecap="round"
            strokeDasharray="251"
            strokeDashoffset="251"
            style={{ animation: "arc-draw 1.2s cubic-bezier(0.22,1,0.36,1) 0.3s forwards" }}
          />
          <defs>
            <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(56,189,248,0)" />
              <stop offset="60%" stopColor="rgba(56,189,248,0.85)" />
              <stop offset="100%" stopColor="rgba(147,197,253,1)" />
            </linearGradient>
          </defs>
        </svg>

        {/* ─── Orbital nodes (4 pulsing dots) ─── */}
        {[0, 90, 180, 270].map((deg, i) => (
          <div
            key={deg}
            className="absolute"
            style={{
              width: 5,
              height: 5,
              top: "50%",
              left: "50%",
              marginTop: -2.5,
              marginLeft: -2.5,
              transform: `rotate(${deg}deg) translateX(50px)`,
              animation: `node-pulse 1.8s ease-in-out ${0.1 * i + 0.4}s infinite`,
            }}
          >
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: i === 0 ? "rgba(147,197,253,0.95)" : "rgba(56,189,248,0.5)",
                boxShadow: i === 0 ? "0 0 8px rgba(147,197,253,0.8)" : "0 0 4px rgba(56,189,248,0.4)",
              }}
            />
          </div>
        ))}

        {/* ─── Center logo ─── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(56,189,248,0.18)",
              boxShadow: "0 0 20px rgba(56,189,248,0.12), inset 0 1px 0 rgba(255,255,255,0.06)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <AIMetricsIcon />
          </div>
        </motion.div>
      </motion.div>

      {/* ─── Wordmark + tagline ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.75 }}
        className="text-center"
        style={{ overflow: "hidden" }}
      >
        <p
          style={{
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: "rgba(255,255,255,0.92)",
            lineHeight: 1,
            position: "relative",
            display: "inline-block",
          }}
        >
          AI Metrics
          {/* Shimmer sweep */}
          <span
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(90deg, transparent 0%, rgba(147,197,253,0.5) 50%, transparent 100%)",
              backgroundSize: "200% 100%",
              animation: "shimmer-sweep 1.6s ease 0.9s forwards",
              opacity: 0,
              mixBlendMode: "screen",
            }}
          />
        </p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 1.1 }}
          style={{
            fontSize: 11.5,
            color: "rgba(56,189,248,0.45)",
            marginTop: 6,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 400,
          }}
        >
          Personal AI operating system
        </motion.p>
      </motion.div>

      {/* ─── Precision progress line ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, delay: 1.0 }}
        style={{
          position: "absolute",
          bottom: 48,
          left: "50%",
          transform: "translateX(-50%)",
          width: 100,
          height: 1,
          background: "rgba(56,189,248,0.08)",
          borderRadius: 1,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: "100%",
            background: "linear-gradient(90deg, transparent, rgba(147,197,253,0.7), rgba(56,189,248,0.5))",
            borderRadius: 1,
            transformOrigin: "left center",
            animation: "progress-fill 1.0s cubic-bezier(0.22,1,0.36,1) 1.05s both",
          }}
        />
      </motion.div>

      {/* ─── Keyframe styles ─── */}
      <style>{`
        @keyframes arc-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.12); }
        }
        @keyframes node-pulse {
          0%, 100% { opacity: 0.45; transform: rotate(var(--r, 0deg)) translateX(50px) scale(1); }
          50% { opacity: 1; transform: rotate(var(--r, 0deg)) translateX(50px) scale(1.5); }
        }
        @keyframes aurora-breathe {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes shimmer-sweep {
          0% { opacity: 1; background-position: -200% 0; }
          100% { opacity: 0; background-position: 200% 0; }
        }
        @keyframes progress-fill {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
      `}</style>
    </motion.div>
  );
}

function AIMetricsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Top-left — brightest */}
      <rect x="2" y="2" width="8" height="8" rx="2" fill="rgba(255,255,255,0.65)" />
      {/* Top-right — dim */}
      <rect x="12" y="2" width="8" height="8" rx="2" fill="rgba(56,189,248,0.32)" />
      {/* Bottom-left — dim */}
      <rect x="2" y="12" width="8" height="8" rx="2" fill="rgba(56,189,248,0.28)" />
      {/* Bottom-right — medium */}
      <rect x="12" y="12" width="8" height="8" rx="2" fill="rgba(147,197,253,0.48)" />
    </svg>
  );
}


// ─── Root component ───────────────────────────────────────────────────────────

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const { toggle } = useHorizon();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    initFCM().catch(() => {});
    jarvis.autoStartIfEnabled();
    initStatusBar().catch(() => {});
    initNativeLifecycle().catch(() => {});
    ensureNotificationChannels().catch(() => {});

    let cleanupListeners: (() => void) | undefined;
    initNativeNotificationListeners({
      onNavigate: (url) => {
        router.navigate({ href: url });
      },
      onCompleteTask: (taskId) => {
        toggle(taskId);
      },
    }).then((cleanup) => {
      cleanupListeners = cleanup;
    });

    return () => {
      if (cleanupListeners) cleanupListeners();
    };
  }, [router, toggle]);

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
