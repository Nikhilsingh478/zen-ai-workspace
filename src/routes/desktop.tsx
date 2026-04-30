import { createFileRoute } from "@tanstack/react-router";
import { DesktopGrid } from "@/components/desktop/desktop-grid";
import { PageHeader } from "@/components/page-header";

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
  return (
    <div className="min-h-[calc(100vh-2rem)] px-5 py-8 md:px-10 md:py-12">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Desktop"
          subtitle="Drag tools into place, right-click to create folders."
        />
        <DesktopGrid />
      </div>
    </div>
  );
}
