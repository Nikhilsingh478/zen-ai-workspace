import { createFileRoute } from "@tanstack/react-router";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";
import { faviconFor, useWebsites, type Website } from "@/lib/store";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/desktop")({
  head: () => ({
    meta: [
      { title: "Desktop — AI Matrix" },
      { name: "description", content: "A focused launcher for your AI tools." },
    ],
  }),
  component: DesktopPage,
});

function DesktopPage() {
  const { websites } = useWebsites();
  const containerRef = useRef<HTMLDivElement>(null);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 18, mass: 0.4 });
  const sy = useSpring(my, { stiffness: 60, damping: 18, mass: 0.4 });
  const px = useTransform(sx, (v) => v * 6);
  const py = useTransform(sy, (v) => v * 6);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = (e.clientX - rect.left) / rect.width - 0.5;
      const cy = (e.clientY - rect.top) / rect.height - 0.5;
      mx.set(cx);
      my.set(cy);
    };
    el.addEventListener("mousemove", onMove);
    return () => el.removeEventListener("mousemove", onMove);
  }, [mx, my]);

  return (
    <div ref={containerRef} className="px-6 md:px-12 py-10 md:py-14 max-w-7xl mx-auto min-h-[calc(100vh-2rem)]">
      <PageHeader
        title="Desktop"
        subtitle="One click into the work."
      />

      <motion.div
        style={{ x: px, y: py }}
        className="grid gap-y-10 gap-x-6"
      >
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-y-10 gap-x-4 sm:gap-x-6">
          {websites.map((w, i) => (
            <Tile key={w.id} website={w} index={i} />
          ))}
        </div>
      </motion.div>

      {websites.length === 0 && (
        <p className="text-center text-copy-secondary py-20 text-sm">
          Add some websites to populate your launcher.
        </p>
      )}
    </div>
  );
}

function Tile({
  website,
  index,
}: {
  website: Website;
  index: number;
}) {
  return (
    <motion.a
      href={website.url}
      target="_blank"
      rel="noreferrer"
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.45,
        delay: Math.min(index * 0.035, 0.5),
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ scale: 1.08, y: -2 }}
      whileTap={{ scale: 0.96 }}
      className="group relative flex flex-col items-center gap-2.5 outline-none"
    >
      <div className="relative h-[72px] w-[72px] sm:h-[84px] sm:w-[84px] rounded-2xl bg-[var(--surface-2)] border border-white/[0.06] grid place-items-center overflow-hidden transition-all duration-300 group-hover:border-white/[0.14] group-hover:bg-[var(--surface-3)] group-hover:shadow-[0_10px_40px_-10px_rgba(255,255,255,0.08)]">
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-500 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.10),transparent_70%)]" />
        <img
          src={faviconFor(website.url, 128)}
          alt=""
          className="h-9 w-9 sm:h-10 sm:w-10 relative z-10"
          loading="lazy"
        />
      </div>
      <span className="text-[11.5px] sm:text-xs text-copy-secondary group-hover:text-foreground transition text-center leading-tight max-w-[88px] line-clamp-2">
        {website.name}
      </span>
    </motion.a>
  );
}