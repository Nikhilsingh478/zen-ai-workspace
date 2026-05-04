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
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SyncIndicator } from "@/components/sync-indicator";

const NAV = [
  { to: "/", label: "Websites", icon: Globe },
  { to: "/desktop", label: "Desktop", icon: LayoutGrid },
  { to: "/prompts", label: "Prompts", icon: Sparkles },
  { to: "/links", label: "Links", icon: Link2 },
  { to: "/images", label: "Images", icon: ImageIcon },
  { to: "/messages", label: "Messages", icon: Bell },
  { to: "/insights", label: "Insights", icon: BarChart2 },
  { to: "/ask", label: "Ask", icon: MessageSquare },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="h-[100dvh] overflow-hidden flex bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border bg-[var(--surface-1)]">
        <div className="px-6 pt-7 pb-10">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-white/90 to-white/40 grid place-items-center">
              <div className="h-3 w-3 rounded-[3px] bg-background" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">AI Metrics</span>
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
        <div className="mt-auto px-6 pb-6 text-[11px] text-copy-muted">
          <SyncIndicator />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col pb-20 md:pb-0">
        <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
      </div>

      {/* Mobile bottom nav — 5 items */}
      <nav className="md:hidden fixed bottom-3 left-3 right-3 z-50 rounded-2xl border border-border bg-[var(--surface-2)] shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
        <div className="grid grid-cols-8">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 py-2 text-[8px] font-medium",
                  active ? "text-foreground" : "text-copy-secondary",
                )}
              >
                <Icon className="h-[15px] w-[15px]" strokeWidth={1.75} />
                <span className="truncate max-w-full px-0.5">{item.label}</span>
                {active && (
                  <span className="absolute top-0.5 h-0.5 w-4 rounded-full bg-foreground/80" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="fixed bottom-24 right-4 z-50 md:bottom-4">
        <div className="rounded-full border border-border bg-[var(--surface-2)] px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
          <SyncIndicator compact />
        </div>
      </div>
    </div>
  );
}
