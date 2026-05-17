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
  Brain,
  GitBranch,
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
  { to: "/",         label: "Websites",  icon: Globe        },
  { to: "/desktop",  label: "Desktop",   icon: LayoutGrid   },
  { to: "/prompts",  label: "Prompts",   icon: Sparkles     },
  { to: "/links",    label: "Links",     icon: Link2        },
  { to: "/images",   label: "Images",    icon: ImageIcon    },
  { to: "/messages", label: "Messages",  icon: Bell         },
  { to: "/horizon",  label: "Horizon",   icon: CalendarDays },
  { to: "/timeline", label: "Timeline",  icon: GitBranch    },
  { to: "/insights", label: "Insights",  icon: BarChart2    },
  { to: "/ask",      label: "Ask",       icon: MessageSquare},
  { to: "/jarvis",   label: "JARVIS",    icon: Cpu          },
  { to: "/context",  label: "Context",   icon: Brain        },
] as const;

type NavItem = { to: string; label: string; icon: ComponentType<{ className?: string; strokeWidth?: number }> };

const MOBILE_PRIMARY: readonly NavItem[] = [
  { to: "/",        label: "Websites", icon: Globe        },
  { to: "/horizon", label: "Horizon",  icon: CalendarDays },
  { to: "/jarvis",  label: "JARVIS",   icon: Cpu          },
  { to: "/ask",     label: "Ask",      icon: MessageSquare},
];

const MOBILE_SECONDARY: readonly NavItem[] = [
  { to: "/prompts",  label: "Prompts",  icon: Sparkles  },
  { to: "/links",    label: "Links",    icon: Link2     },
  { to: "/images",   label: "Images",   icon: ImageIcon },
  { to: "/messages", label: "Messages", icon: Bell      },
  { to: "/timeline", label: "Timeline", icon: GitBranch },
  { to: "/insights", label: "Insights", icon: BarChart2 },
  { to: "/context",  label: "Context",  icon: Brain     },
];

// ─── Brand logo mark ─────────────────────────────────────────────────────────

function BrandMark() {
  return (
    <div
      className="h-7 w-7 rounded-lg grid place-items-center shrink-0"
      style={{
        background: "linear-gradient(135deg, rgba(125,211,252,0.9) 0%, rgba(186,230,253,0.7) 100%)",
        boxShadow: "0 0 12px rgba(125,211,252,0.3)",
        border: "1px solid rgba(125,211,252,0.4)",
      }}
    >
      {/* Inner grid mark */}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="2" y="2" width="4" height="4" rx="1" fill="rgba(255,255,255,0.9)" />
        <rect x="8" y="2" width="4" height="4" rx="1" fill="rgba(255,255,255,0.4)" />
        <rect x="2" y="8" width="4" height="4" rx="1" fill="rgba(255,255,255,0.4)" />
        <rect x="8" y="8" width="4" height="4" rx="1" fill="rgba(255,255,255,0.7)" />
      </svg>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));
  const moreActive = MOBILE_SECONDARY.some((i) => isActive(i.to));

  return (
    <div className="h-[100dvh] overflow-hidden flex bg-background text-foreground">

      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden md:flex flex-col w-56 shrink-0"
        style={{
          background: "var(--surface-1)",
          borderRight: "1px solid rgba(125,211,252,0.08)",
        }}
      >
        {/* Brand */}
        <div className="px-5 pt-6 pb-8">
          <Link to="/" className="flex items-center gap-2.5 group">
            <motion.div whileHover={{ scale: 1.08 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
              <BrandMark />
            </motion.div>
            <div>
              <span className="text-[14px] font-semibold tracking-tight" style={{ color: "rgba(255,255,255,0.9)" }}>
                AI Metrics
              </span>
              <div className="text-[8px] tracking-[0.18em] font-medium mt-0.5" style={{ color: "rgba(125,211,252,0.55)" }}>
                INTELLIGENCE SUITE
              </div>
            </div>
          </Link>
        </div>

        {/* Nav divider */}
        <div className="mx-4 mb-3 h-px" style={{ background: "rgba(125,211,252,0.08)" }} />

        {/* Nav items */}
        <nav className="px-3 flex flex-col gap-0.5 flex-1">
          {NAV.map((item) => {
            const active = isActive(item.to);
            const Icon   = item.icon;
            const isJarvis = item.to === "/jarvis";
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
                    style={{ background: "rgba(125,211,252,0.08)" }}
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
                <Icon
                  className="h-[17px] w-[17px] relative z-10 shrink-0"
                  strokeWidth={1.75}
                  style={{ color: active ? "var(--jarvis-primary, #0EA5E9)" : undefined }}
                />
                <span className="font-medium relative z-10 text-[13px]">{item.label}</span>

                {/* JARVIS glow dot when active */}
                {isJarvis && active && (
                  <motion.span
                    className="ml-auto relative z-10 h-1.5 w-1.5 rounded-full"
                    style={{ background: "var(--jarvis-primary, #0EA5E9)" }}
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div
          className="px-5 py-4"
          style={{ borderTop: "1px solid rgba(125,211,252,0.06)" }}
        >
          <SyncIndicator />
        </div>
      </aside>

      {/* ── Main content ── */}
      {/*
        Safe area top: on Android edge-to-edge the status bar overlays the WebView.
        env(safe-area-inset-top) is the exact pixel height of the status bar / notch.
        We apply it only to mobile (md:pt-0 resets it on desktop where no notch exists).
      */}
      <div
        className="flex-1 min-w-0 min-h-0 flex flex-col pb-20 md:pb-0"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
      </div>

      {/* ── Mobile bottom nav ── */}
      {/*
        Safe area bottom: on gesture-navigation Android devices, the bottom system
        gesture area is ~20-34px. We shift the nav up by that amount so it never
        sits underneath the gesture strip, while keeping the 12px (bottom-3) visual gap.
      */}
      <nav
        className="md:hidden fixed left-3 right-3 z-50 rounded-2xl"
        style={{
          bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
          background: "rgba(17,17,20,0.92)",
          border: "1px solid rgba(125,211,252,0.1)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(125,211,252,0.05)",
        }}
      >
        <div className="grid grid-cols-5">
          {MOBILE_PRIMARY.map((item) => {
            const active = isActive(item.to);
            const Icon   = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors duration-150",
                  active ? "text-foreground" : "text-copy-secondary hover:text-foreground",
                )}
                style={{ color: active ? "var(--jarvis-primary, #0EA5E9)" : undefined }}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                <span className="truncate max-w-full px-0.5">{item.label}</span>
                {active && (
                  <motion.span
                    layoutId="mobile-active-dot"
                    className="absolute top-1 h-0.5 w-5 rounded-full"
                    style={{ background: "var(--jarvis-primary, #0EA5E9)" }}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
              </Link>
            );
          })}

          {/* More sheet */}
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
                    className="absolute top-1 h-0.5 w-5 rounded-full"
                    style={{ background: "var(--jarvis-primary, #0EA5E9)" }}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[78vw] max-w-xs p-0"
              style={{
                background: "var(--surface-1)",
                borderLeft: "1px solid rgba(125,211,252,0.1)",
              }}
            >
              <SheetHeader className="px-5 pt-6 pb-4" style={{ borderBottom: "1px solid rgba(125,211,252,0.07)" }}>
                <SheetTitle className="flex items-center gap-2.5 text-left">
                  <BrandMark />
                  <div>
                    <span className="text-[14px] font-semibold tracking-tight">AI Metrics</span>
                    <div className="text-[8px] tracking-[0.18em] mt-0.5" style={{ color: "rgba(125,211,252,0.5)" }}>
                      INTELLIGENCE SUITE
                    </div>
                  </div>
                </SheetTitle>
              </SheetHeader>
              <nav className="px-3 py-4 flex flex-col gap-1">
                {[...MOBILE_PRIMARY, ...MOBILE_SECONDARY].map((item) => {
                  const active = isActive(item.to);
                  const Icon   = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "relative flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-all duration-200",
                        active
                          ? "text-foreground"
                          : "text-copy-secondary hover:text-foreground",
                      )}
                      style={active ? { background: "rgba(125,211,252,0.07)" } : undefined}
                    >
                      <Icon
                        className={cn("h-[18px] w-[18px]", active && "text-[var(--jarvis-primary,#0EA5E9)]")}
                        strokeWidth={1.75}
                      />
                      <span className="font-medium">{item.label}</span>
                      {active && (
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-r-full"
                          style={{ background: "var(--jarvis-primary, #0EA5E9)" }}
                        />
                      )}
                    </Link>
                  );
                })}
              </nav>
              <div
                className="px-5 py-4 text-[11px]"
                style={{ borderTop: "1px solid rgba(125,211,252,0.07)" }}
              >
                <SyncIndicator />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      {/* Mobile sync indicator (floating) */}
      <AnimatePresence>
        <div className="fixed bottom-24 right-4 z-50 md:bottom-4">
          <div
            className="rounded-full px-3 py-2 shadow-lg"
            style={{
              background: "var(--surface-2)",
              border: "1px solid rgba(125,211,252,0.1)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            }}
          >
            <SyncIndicator compact />
          </div>
        </div>
      </AnimatePresence>
    </div>
  );
}
