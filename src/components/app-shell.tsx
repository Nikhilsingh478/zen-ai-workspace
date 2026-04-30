import { Link, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, LayoutGrid, Sparkles, MessageSquare } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Websites", icon: Globe },
  { to: "/desktop", label: "Desktop", icon: LayoutGrid },
  { to: "/prompts", label: "Prompts", icon: Sparkles },
  { to: "/ask", label: "Ask", icon: MessageSquare },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border/60 bg-[var(--surface-1)]/40 backdrop-blur-sm">
        <div className="px-6 pt-7 pb-10">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-white/90 to-white/40 grid place-items-center">
              <div className="h-3 w-3 rounded-[3px] bg-background" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">AI Matrix</span>
          </Link>
        </div>
        <nav className="px-3 flex flex-col gap-1">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
                  active
                    ? "bg-white/[0.06] text-foreground"
                    : "text-secondary hover:text-foreground hover:bg-white/[0.04]",
                )}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                <span className="font-medium">{item.label}</span>
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-r-full bg-foreground/80"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto px-6 pb-6 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
            <span>Workspace synced</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col pb-20 md:pb-0">
        <AnimatePresence mode="wait">
          <motion.main
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 min-w-0"
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-3 left-3 right-3 z-50 rounded-2xl border border-border/60 bg-[var(--surface-2)]/90 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
        <div className="grid grid-cols-4">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={1.75} />
                <span>{item.label}</span>
                {active && (
                  <motion.span
                    layoutId="mobile-nav-active"
                    className="absolute top-1 h-1 w-6 rounded-full bg-foreground/80"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}