import { Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "sonner";
import { AppShell } from "@/components/app-shell";

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

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <AppShell>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="h-full"
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
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
    </AppShell>
  );
}
