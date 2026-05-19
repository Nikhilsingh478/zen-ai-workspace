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
  ChevronLeft,
  ChevronRight,
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
  { to: "/",         label: "Websites", icon: Globe        },
  { to: "/horizon",  label: "Horizon",  icon: CalendarDays },
  { to: "/jarvis",   label: "JARVIS",   icon: Cpu          },
  { to: "/timeline", label: "Timeline", icon: GitBranch    },
];

const MOBILE_SECONDARY: readonly NavItem[] = [
  { to: "/ask",      label: "Ask",      icon: MessageSquare},
  { to: "/prompts",  label: "Prompts",  icon: Sparkles  },
  { to: "/links",    label: "Links",    icon: Link2     },
  { to: "/images",   label: "Images",   icon: ImageIcon },
  { to: "/messages", label: "Messages", icon: Bell      },
  { to: "/insights", label: "Insights", icon: BarChart2 },
  { to: "/context",  label: "Context",  icon: Brain     },
];

// ─── Persist collapsed state ──────────────────────────────────────────────────

function getSavedCollapsed(): boolean {
  try {
    return localStorage.getItem("sidebar-collapsed") === "true";
  } catch {
    return false;
  }
}

function saveCollapsed(v: boolean) {
  try {
    localStorage.setItem("sidebar-collapsed", String(v));
  } catch { /* ignore */ }
}

// ─── Brand logo mark ──────────────────────────────────────────────────────────

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
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="2" y="2" width="4" height="4" rx="1" fill="rgba(255,255,255,0.9)" />
        <rect x="8" y="2" width="4" height="4" rx="1" fill="rgba(255,255,255,0.4)" />
        <rect x="2" y="8" width="4" height="4" rx="1" fill="rgba(255,255,255,0.4)" />
        <rect x="8" y="8" width="4" height="4" rx="1" fill="rgba(255,255,255,0.7)" />
      </svg>
    </div>
  );
}

// ─── Tooltip for collapsed icons ──────────────────────────────────────────────

function NavTooltip({ label, show }: { label: string; show: boolean }) {
  if (!show) return null;
  return (
    <div
      className="absolute left-full ml-3 px-2.5 py-1 rounded-lg text-[12px] font-medium pointer-events-none whitespace-nowrap z-50"
      style={{
        background: "var(--surface-2, rgba(20,22,30,0.98))",
        border: "1px solid rgba(125,211,252,0.15)",
        color: "rgba(255,255,255,0.85)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      }}
    >
      {label}
    </div>
  );
}

// ─── AppShell ─────────────────────────────────────────────────────────────────

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(getSavedCollapsed);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));
  const moreActive = MOBILE_SECONDARY.some((i) => isActive(i.to));

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      saveCollapsed(next);
      return next;
    });
  }

  const sidebarW = collapsed ? 60 : 224;

  return (
    <div className="h-[100dvh] overflow-hidden flex bg-background text-foreground">

      {/* ── Desktop sidebar ── */}
      <motion.aside
        className="hidden md:flex flex-col shrink-0 relative"
        animate={{ width: sidebarW }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        style={{
          background: "var(--surface-1)",
          borderRight: "1px solid rgba(125,211,252,0.08)",
          overflow: "hidden",
        }}
      >
        {/* Brand */}
        <div
          className="flex items-center pt-6 pb-8"
          style={{ paddingLeft: collapsed ? 0 : 20, paddingRight: collapsed ? 0 : 20, justifyContent: collapsed ? "center" : "flex-start" }}
        >
          <Link to="/" className="flex items-center gap-2.5 group min-w-0">
            <motion.div whileHover={{ scale: 1.08 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
              <BrandMark />
            </motion.div>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.div
                  key="brand-text"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: "hidden", whiteSpace: "nowrap" }}
                >
                  <span className="text-[14px] font-semibold tracking-tight" style={{ color: "rgba(255,255,255,0.9)" }}>
                    AI Metrics
                  </span>
                  <div className="text-[8px] tracking-[0.18em] font-medium mt-0.5" style={{ color: "rgba(125,211,252,0.55)" }}>
                    INTELLIGENCE SUITE
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Link>
        </div>

        {/* Nav divider */}
        <div className="mb-3 h-px mx-3" style={{ background: "rgba(125,211,252,0.08)" }} />

        {/* Nav items */}
        <nav className="flex flex-col gap-0.5 flex-1 px-2">
          {NAV.map((item) => {
            const active   = isActive(item.to);
            const Icon     = item.icon;
            const isJarvis = item.to === "/jarvis";
            const hovered  = hoveredItem === item.to;

            return (
              <div key={item.to} className="relative" onMouseEnter={() => setHoveredItem(item.to)} onMouseLeave={() => setHoveredItem(null)}>
                <Link
                  to={item.to}
                  className={cn(
                    "relative flex items-center rounded-lg transition-colors duration-150",
                    collapsed ? "justify-center px-0 py-2.5 mx-0.5" : "gap-3 px-3 py-2.5",
                    active ? "text-foreground" : "text-copy-secondary hover:text-foreground",
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
                  {active && !collapsed && (
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
                  <AnimatePresence initial={false}>
                    {!collapsed && (
                      <motion.span
                        key="label"
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.18 }}
                        className="font-medium relative z-10 text-[13px] overflow-hidden whitespace-nowrap"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {/* JARVIS glow dot */}
                  {isJarvis && active && !collapsed && (
                    <motion.span
                      className="ml-auto relative z-10 h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ background: "var(--jarvis-primary, #0EA5E9)" }}
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                </Link>

                {/* Tooltip when collapsed */}
                <AnimatePresence>
                  {collapsed && hovered && (
                    <motion.div
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 rounded-lg text-[12px] font-medium pointer-events-none whitespace-nowrap z-50"
                      style={{
                        background: "var(--surface-1)",
                        border: "1px solid rgba(125,211,252,0.15)",
                        color: "rgba(255,255,255,0.85)",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                      }}
                    >
                      {item.label}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        {/* Bottom: sync + collapse toggle */}
        <div
          className="px-3 py-4 flex flex-col gap-3"
          style={{ borderTop: "1px solid rgba(125,211,252,0.06)" }}
        >
          {/* Sync indicator — hidden when collapsed */}
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                key="sync"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <SyncIndicator />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapse toggle button */}
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              "flex items-center rounded-lg transition-all duration-150 group",
              collapsed ? "justify-center py-2" : "gap-2.5 px-2 py-2",
            )}
            style={{
              background: "rgba(125,211,252,0.04)",
              border: "1px solid rgba(125,211,252,0.08)",
              color: "rgba(125,211,252,0.45)",
              width: "100%",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(125,211,252,0.09)";
              (e.currentTarget as HTMLElement).style.color = "rgba(125,211,252,0.75)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(125,211,252,0.04)";
              (e.currentTarget as HTMLElement).style.color = "rgba(125,211,252,0.45)";
            }}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <motion.div
              animate={{ rotate: collapsed ? 0 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
              )}
            </motion.div>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  key="collapse-label"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.18 }}
                  className="text-[12px] font-medium overflow-hidden whitespace-nowrap"
                >
                  Collapse
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* ── Main content ── */}
      <div
        className="flex-1 min-w-0 min-h-0 flex flex-col pb-20 md:pb-0"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
      </div>

      {/* ── Mobile bottom nav ── */}
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
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "relative flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-all duration-200",
                        active ? "text-foreground" : "text-copy-secondary hover:text-foreground",
                      )}
                      style={active ? { background: "rgba(125,211,252,0.07)" } : undefined}
                    >
                      <item.icon
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

    </div>
  );
}
