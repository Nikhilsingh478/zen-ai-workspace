import { Link, useRouterState } from "@tanstack/react-router";
import {
  Globe,
  LayoutGrid,
  Sparkles,
  MessageSquare,
  BarChart2,
  Link2,
  Image as ImageIcon,
  Bell,
  Menu,
  CalendarDays,
  Cpu,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, type ReactNode, type ComponentType } from "react";
import { cn } from "@/lib/utils";
import { SyncIndicator } from "@/components/sync-indicator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const NAV = [
  { to: "/", label: "Websites", icon: Globe },
  { to: "/desktop", label: "Desktop", icon: LayoutGrid },
  { to: "/prompts", label: "Prompts", icon: Sparkles },
  { to: "/links", label: "Links", icon: Link2 },
  { to: "/images", label: "Images", icon: ImageIcon },
  { to: "/messages", label: "Messages", icon: Bell },
  { to: "/horizon", label: "Horizon", icon: CalendarDays },
  { to: "/insights", label: "Insights", icon: BarChart2 },
  { to: "/ask", label: "Ask", icon: MessageSquare },
  { to: "/jarvis", label: "JARVIS", icon: Cpu },
] as const;

type NavItem = { to: string; label: string; icon: ComponentType<{ className?: string; strokeWidth?: number }> };

const MOBILE_PRIMARY: readonly NavItem[] = [
  { to: "/", label: "Websites", icon: Globe },
  { to: "/horizon", label: "Horizon", icon: CalendarDays },
  { to: "/jarvis", label: "JARVIS", icon: Cpu },
  { to: "/ask", label: "Ask", icon: MessageSquare },
];

const MOBILE_SECONDARY: readonly NavItem[] = [
  { to: "/prompts", label: "Prompts", icon: Sparkles },
  { to: "/links", label: "Links", icon: Link2 },
  { to: "/images", label: "Images", icon: ImageIcon },
  { to: "/messages", label: "Messages", icon: Bell },
  { to: "/insights", label: "Insights", icon: BarChart2 },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));
  const moreActive = MOBILE_SECONDARY.some((i) => isActive(i.to));

  return (
    <div className="h-[100dvh] overflow-hidden flex bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border bg-[var(--surface-1)]">
        <div className="px-6 pt-7 pb-10">
          <Link to="/" className="flex items-center gap-2.5 group">
            <motion.div
              className="h-7 w-7 rounded-lg bg-gradient-to-br from-white/90 to-white/40 grid place-items-center"
              whileHover={{ scale: 1.08 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <div className="h-3 w-3 rounded-[3px] bg-background" />
            </motion.div>
            <span className="text-[15px] font-semibold tracking-tight">AI Metrics</span>
          </Link>
        </div>
        <nav className="px-3 flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active = isActive(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150",
                  active
                    ? "text-foreground"
                    : "text-copy-secondary hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active-bg"
                    className="absolute inset-0 rounded-lg"
                    style={{ background: "rgba(14,165,233,0.07)" }}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                {active && (
                  <motion.span
                    layoutId="sidebar-active-bar"
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-r-full"
                    style={{ background: "var(--jarvis-primary, #0EA5E9)" }}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon className="h-[18px] w-[18px] relative z-10 shrink-0" strokeWidth={1.75} />
                <span className="font-medium relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto px-6 pb-6 text-[11px] text-copy-muted">
          <SyncIndicator />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col pb-20 md:pb-0">
        <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-3 left-3 right-3 z-50 rounded-2xl border border-border bg-[var(--surface-2)]/90 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
        <div className="grid grid-cols-5">
          {MOBILE_PRIMARY.map((item) => {
            const active = isActive(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors duration-150",
                  active ? "text-foreground" : "text-copy-secondary hover:text-foreground",
                )}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                <span className="truncate max-w-full px-0.5">{item.label}</span>
                {active && (
                  <motion.span
                    layoutId="mobile-active-dot"
                    className="absolute top-1 h-0.5 w-5 rounded-full bg-foreground/80"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
              </Link>
            );
          })}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                  moreActive ? "text-foreground" : "text-copy-secondary hover:text-foreground",
                )}
                aria-label="Open menu"
              >
                <Menu className="h-[18px] w-[18px]" strokeWidth={1.75} />
                <span>More</span>
                {moreActive && (
                  <motion.span
                    layoutId="mobile-active-dot"
                    className="absolute top-1 h-0.5 w-5 rounded-full bg-foreground/80"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[78vw] max-w-xs border-l border-border bg-[var(--surface-1)] p-0"
            >
              <SheetHeader className="px-6 pt-7 pb-4 border-b border-border">
                <SheetTitle className="flex items-center gap-2.5 text-left">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-white/90 to-white/40 grid place-items-center">
                    <div className="h-3 w-3 rounded-[3px] bg-background" />
                  </div>
                  <span className="text-[15px] font-semibold tracking-tight">AI Metrics</span>
                </SheetTitle>
              </SheetHeader>
              <nav className="px-3 py-4 flex flex-col gap-1">
                {[...MOBILE_PRIMARY, ...MOBILE_SECONDARY].map((item) => {
                  const active = isActive(item.to);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "relative flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-all duration-200",
                        active
                          ? "bg-white/[0.07] text-foreground"
                          : "text-copy-secondary hover:text-foreground hover:bg-white/[0.04]",
                      )}
                    >
                      <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                      <span className="font-medium">{item.label}</span>
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-r-full bg-foreground/80" />
                      )}
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-auto px-6 py-5 text-[11px] text-copy-muted border-t border-border">
                <SyncIndicator />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      {/* Sync indicator (mobile floating) */}
      <AnimatePresence>
        <div className="fixed bottom-24 right-4 z-50 md:bottom-4">
          <div className="rounded-full border border-border bg-[var(--surface-2)] px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
            <SyncIndicator compact />
          </div>
        </div>
      </AnimatePresence>
    </div>
  );
}
