import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Keyboard, Search } from "lucide-react";
import { CommandPalette } from "@/components/desktop/command-palette";
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
  const { items } = useDesktopStorage();

  return (
    <motion.div
      className="min-h-[calc(100vh-2rem)] px-5 py-8 md:px-10 md:py-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Desktop"
          subtitle="Drag tools into place, group folders, and launch with Ctrl K."
          action={
            <div className="hidden items-center gap-2 rounded-xl border border-border bg-[#141416] px-3 py-2 text-xs text-copy-secondary md:flex">
              <Keyboard className="h-3.5 w-3.5" />
              <span>Ctrl K</span>
              <Search className="h-3.5 w-3.5" />
            </div>
          }
        />

        <DesktopGrid />
      </div>

      <CommandPalette items={items} />
    </motion.div>
  );
}
