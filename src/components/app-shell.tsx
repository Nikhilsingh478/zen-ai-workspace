import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
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
  X,
  ChevronRight,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SyncIndicator } from "@/components/sync-indicator";

const MAIN_NAV = [
  { to: "/", label: "Websites", icon: Globe },
  { to: "/desktop", label: "Desktop", icon: LayoutGrid },
  { to: "/links", label: "Links", icon: Link2 },
  { to: "/images", label: "Images", icon: ImageIcon },
  { to: "/messages", label: "Messages", icon: Bell },
  { to: "/insights", label: "Insights", icon: BarChart2 },
  { to: "/ask", label: "Ask", icon: MessageSquare },
] as const;

const PROMPTS_NAV = [
  { to: "/prompts", label: "Prompts", icon: Sparkles, badge: "Pro" },
] as const;

interface NavLinkProps {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  active: boolean;
  onClick?: () => void;
  badge?: string;
  variant?: "sidebar" | "mobile";
}

function NavLink({ to, label, icon: Icon, active, onClick, badge, variant = "sidebar" }: NavLinkProps) {
  if (variant === "mobile") {
    return (
      <Link
        to={to}
        onClick={onClick}
        className={cn(
          "relative flex flex-col items-center justify-center gap-1 py-2.5 px-2 text-[10px] font-medium transition-all duration-300",
          active ? "text-foreground" : "text-copy-secondary",
        )}
      >
        <div className="relative">
          <Icon className="h-5 w-5" strokeWidth={1.5} />
          {badge && (
            <span className="absolute -top-2 -right-2 bg-white/20 text-[7px] font-bold px-1.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <span className="truncate max-w-[50px] px-0.5">{label}</span>
        {active && (
          <span className="absolute bottom-1.5 h-1 w-4 rounded-full bg-foreground/80" />
        )}
      </Link>
    );
  }

  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "relative group flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-300 overflow-hidden",
        active
          ? "bg-white/[0.08] text-foreground shadow-sm"
          : "text-copy-secondary hover:text-foreground hover:bg-white/[0.04]",
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
        <span className="font-medium truncate">{label}</span>
      </div>
      {badge && (
        <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/15 text-white/80 shrink-0">
          {badge}
        </span>
      )}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-foreground/80 transition-all duration-300" />
      )}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col md:flex-row bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-white/[0.08] bg-[var(--surface-1)] transition-all duration-300">
        {/* Header */}
        <div className="px-6 pt-8 pb-6">
          <Link to="/" className="flex items-center gap-3 group transition-all duration-300">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-white/90 to-white/40 grid place-items-center group-hover:shadow-lg transition-all duration-300">
              <div className="h-3.5 w-3.5 rounded-[3px] bg-background" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-foreground">Zen AI</span>
              <span className="text-[10px] text-copy-muted">Workspace</span>
            </div>
          </Link>
        </div>

        {/* Prompts Section */}
        <div className="px-3 py-3 border-t border-white/[0.06]">
          <p className="px-3 text-xs font-semibold text-copy-secondary uppercase tracking-wider mb-3">
            Prompts
          </p>
          <nav className="flex flex-col gap-1.5">
            {PROMPTS_NAV.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  icon={item.icon}
                  active={active}
                  badge={item.badge}
                  variant="sidebar"
                />
              );
            })}
          </nav>
        </div>

        {/* Main Navigation */}
        <div className="px-3 py-3 border-t border-white/[0.06] flex-1">
          <p className="px-3 text-xs font-semibold text-copy-secondary uppercase tracking-wider mb-3">
            Navigation
          </p>
          <nav className="flex flex-col gap-1.5">
            {MAIN_NAV.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  icon={item.icon}
                  active={active}
                  variant="sidebar"
                />
              );
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="px-6 py-6 border-t border-white/[0.06] text-[11px] text-copy-muted">
          <SyncIndicator />
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        {/* Mobile header with menu toggle */}
        <div className="md:hidden flex items-center justify-between px-4 py-4 border-b border-white/[0.06] bg-[var(--surface-1)]">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-white/90 to-white/40 grid place-items-center">
              <div className="h-3 w-3 rounded-[3px] bg-background" />
            </div>
            <span className="text-sm font-bold tracking-tight">Zen AI</span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 hover:bg-white/[0.06] rounded-lg transition-all duration-200"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" strokeWidth={1.5} />
            ) : (
              <Menu className="h-5 w-5" strokeWidth={1.5} />
            )}
          </button>
        </div>

        {/* Mobile expandable sidebar */}
        {mobileMenuOpen && (
          <nav className="md:hidden bg-[var(--surface-1)] border-b border-white/[0.06] overflow-y-auto max-h-[calc(100dvh-80px)]">
            {/* Prompts Section */}
            <div className="px-4 py-4 border-b border-white/[0.06]">
              <p className="text-xs font-semibold text-copy-secondary uppercase tracking-wider mb-3 px-1">
                Prompts
              </p>
              <div className="flex flex-col gap-2">
                {PROMPTS_NAV.map((item) => {
                  const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "relative flex items-center justify-between gap-3 rounded-lg px-3 py-3 text-sm transition-all duration-300",
                        active
                          ? "bg-white/[0.08] text-foreground"
                          : "text-copy-secondary hover:text-foreground hover:bg-white/[0.04]",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="h-5 w-5" strokeWidth={1.5} />
                        <span className="font-medium">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/15 text-white/80">
                          {item.badge}
                        </span>
                      )}
                      {active && <ChevronRight className="h-4 w-4" />}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Main Navigation */}
            <div className="px-4 py-4">
              <p className="text-xs font-semibold text-copy-secondary uppercase tracking-wider mb-3 px-1">
                Navigation
              </p>
              <div className="flex flex-col gap-2">
                {MAIN_NAV.map((item) => {
                  const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "relative flex items-center justify-between gap-3 rounded-lg px-3 py-3 text-sm transition-all duration-300",
                        active
                          ? "bg-white/[0.08] text-foreground"
                          : "text-copy-secondary hover:text-foreground hover:bg-white/[0.04]",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="h-5 w-5" strokeWidth={1.5} />
                        <span className="font-medium">{item.label}</span>
                      </div>
                      {active && <ChevronRight className="h-4 w-4" />}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Mobile sync indicator */}
            <div className="px-4 py-4 border-t border-white/[0.06] text-[11px] text-copy-muted">
              <SyncIndicator />
            </div>
          </nav>
        )}

        {/* Main content */}
        <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[var(--surface-2)] shadow-[0_-8px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <div className="flex items-center justify-around px-2">
          {PROMPTS_NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                label={item.label}
                icon={item.icon}
                active={active}
                onClick={() => setMobileMenuOpen(false)}
                badge={item.badge}
                variant="mobile"
              />
            );
          })}
          <div className="h-10 w-px bg-white/[0.06]" />
          {MAIN_NAV.slice(0, 5).map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                label={item.label}
                icon={item.icon}
                active={active}
                onClick={() => setMobileMenuOpen(false)}
                variant="mobile"
              />
            );
          })}
          <div className="h-10 w-px bg-white/[0.06]" />
          {MAIN_NAV.slice(5).map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                label={item.label}
                icon={item.icon}
                active={active}
                onClick={() => setMobileMenuOpen(false)}
                variant="mobile"
              />
            );
          })}
        </div>
      </nav>

      {/* Spacing for mobile bottom nav */}
      <div className="md:hidden h-[72px]" />
    </div>
  );
}
