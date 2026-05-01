import { createFileRoute } from "@tanstack/react-router";
import { DesktopGrid } from "@/components/desktop/desktop-grid";
import { PageHeader } from "@/components/page-header";
import { useDesktopStorage } from "@/lib/store";

export const Route = createFileRoute("/desktop")({
  head: () => ({
    meta: [
      { title: "Desktop - AI Matrix" },
      { name: "description", content: "A focused launcher for your AI tools." },
    ],
  }),
  component: DesktopPage,
});

function DesktopPage() {
  const { loaded } = useDesktopStorage();

  return (
    <div className="min-h-[calc(100vh-2rem)] px-5 py-8 md:px-10 md:py-12">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Desktop"
          subtitle="Drag tools into place, right-click to create folders."
        />
        {loaded ? <DesktopGrid /> : <DesktopSkeleton />}
      </div>
    </div>
  );
}

function DesktopSkeleton() {
  return (
    <div className="flex flex-wrap gap-4 mt-4">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div
          key={i}
          className="h-24 w-24 rounded-2xl bg-white/[0.04] animate-pulse"
          style={{ animationDelay: `${i * 0.05}s` }}
        />
      ))}
    </div>
  );
}
