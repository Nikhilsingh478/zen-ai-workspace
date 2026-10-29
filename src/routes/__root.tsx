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

// ─── High-Concept Architectural Loader ────────────────────────────────────────

const LOADER_DURATION = 1350; // Snappy, intentional 1.35s duration

function Splash({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startTime = performance.now();
    const duration = LOADER_DURATION - 150; // complete progress just before exit

    let frameId: number;
    const updateProgress = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      // Ease out expo: 1 - 2^(-10t)
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setProgress(Math.round(eased * 100));

      if (t < 1) {
        frameId = requestAnimationFrame(updateProgress);
      }
    };
    frameId = requestAnimationFrame(updateProgress);

    const doneTimer = setTimeout(onDone, LOADER_DURATION);
    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  const stageText =
    progress < 35
      ? "INITIALIZING KERNEL"
      : progress < 75
        ? "CONSTRUCTING MATRIX"
        : "SYSTEM READY";

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{
        opacity: 0,
        scale: 1.03,
        filter: "blur(12px)",
        transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
      }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden select-none"
      style={{ background: "#050608" }}
    >
      {/* ── Subtle architectural radial depth ── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 48%, rgba(56,189,248,0.08) 0%, rgba(99,102,241,0.03) 38%, transparent 70%)",
        }}
      />

      {/* ── Microscopic blueprint grid dots ── */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* ── Viewport Framing Brackets (High-End Swiss / HUD) ── */}
      <div className="pointer-events-none absolute inset-6 md:inset-10 flex flex-col justify-between">
        {/* Top bar */}
        <div className="flex items-center justify-between text-[10px] font-mono tracking-[0.2em] text-white/35 uppercase">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span>AI.OS // CORE v4.2</span>
          </div>
          <div className="tabular-nums font-semibold text-white/50">
            {progress.toString().padStart(3, "0")}%
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between text-[10px] font-mono tracking-[0.2em] text-white/30 uppercase">
          <span>SYS.LATENCY // 12MS</span>
          <span>INITIALIZED</span>
        </div>
      </div>

      {/* ── Center Stage: Kinetic Matrix Monolith ── */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Monolith 4-Quadrant Emblem */}
        <div className="relative mb-8 flex items-center justify-center">
          {/* Ambient core glow */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.9, 1.15, 1], opacity: [0.3, 0.7, 0.4] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute h-28 w-28 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(56,189,248,0.2) 0%, rgba(99,102,241,0.06) 50%, transparent 75%)",
              filter: "blur(16px)",
            }}
          />

          {/* 2x2 Precision Modular Prisms */}
          <div className="relative grid grid-cols-2 gap-1.5 p-1">
            {/* Quadrant 1: Top-Left */}
            <motion.div
              initial={{ opacity: 0, x: -16, y: -16, rotate: -8 }}
              animate={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
              className="h-7 w-7 rounded-lg relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(56,189,248,0.08) 100%)",
                border: "1px solid rgba(255,255,255,0.18)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)",
              }}
            >
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)",
                  animation: "facet-sweep 1.6s ease-in-out infinite",
                }}
              />
            </motion.div>

            {/* Quadrant 2: Top-Right */}
            <motion.div
              initial={{ opacity: 0, x: 16, y: -16, rotate: 8 }}
              animate={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
              className="h-7 w-7 rounded-lg relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(56,189,248,0.14) 0%, rgba(99,102,241,0.06) 100%)",
                border: "1px solid rgba(125,211,252,0.25)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            />

            {/* Quadrant 3: Bottom-Left */}
            <motion.div
              initial={{ opacity: 0, x: -16, y: 16, rotate: 8 }}
              animate={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
              className="h-7 w-7 rounded-lg relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(56,189,248,0.04) 100%)",
                border: "1px solid rgba(147,197,253,0.18)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)",
              }}
            />

            {/* Quadrant 4: Bottom-Right */}
            <motion.div
              initial={{ opacity: 0, x: 16, y: 16, rotate: -8 }}
              animate={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              className="h-7 w-7 rounded-lg relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(56,189,248,0.16) 100%)",
                border: "1px solid rgba(255,255,255,0.22)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18)",
              }}
            />

            {/* Center Nexus: Optical Diamond Aperture */}
            <motion.div
              initial={{ scale: 0, rotate: 0 }}
              animate={{ scale: [0, 1.2, 1], rotate: 45 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-[2px] bg-white shadow-[0_0_12px_rgba(255,255,255,0.9),0_0_24px_rgba(56,189,248,0.8)] z-10"
            />
          </div>
        </div>

        {/* ── Typographic Stagger Reveal ── */}
        <div className="flex flex-col items-center overflow-hidden mb-5">
          <div className="overflow-hidden">
            <motion.h1
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
              className="text-[15px] font-semibold tracking-[0.34em] text-white/95 uppercase font-sans"
              style={{ textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}
            >
              AI MATRIX
            </motion.h1>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.45 }}
            className="text-[10px] tracking-[0.22em] text-sky-400/65 font-mono uppercase mt-1.5"
          >
            Neural Operating System
          </motion.p>
        </div>

        {/* ── Precision Status & Progress Track ── */}
        <div className="flex flex-col items-center gap-2 w-48">
          <div className="flex items-center justify-between w-full text-[9px] font-mono tracking-[0.2em] text-white/40 uppercase">
            <span>{stageText}</span>
            <span className="tabular-nums text-white/60">{progress}%</span>
          </div>

          {/* Hairline track */}
          <div className="w-full h-[1.5px] bg-white/[0.08] rounded-full overflow-hidden relative">
            <motion.div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, rgba(56,189,248,0.3) 0%, #38bdf8 80%, #ffffff 100%)",
                boxShadow: "0 0 8px rgba(56,189,248,0.8)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Keyframe helpers */}
      <style>{`
        @keyframes facet-sweep {
          0% { transform: translateX(-150%) skewX(-20deg); }
          50%, 100% { transform: translateX(200%) skewX(-20deg); }
        }
      `}</style>
    </motion.div>
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
