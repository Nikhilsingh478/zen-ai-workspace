import { createFileRoute } from "@tanstack/react-router";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { Link2, Plus } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { primaryButtonClass } from "@/components/matrix-modal";
import { useLinkBoard, type LinkItem } from "@/lib/link-board";
import { LinkCard } from "@/components/link-board/link-card";
import { LinkModal } from "@/components/link-board/link-modal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/links")({
  head: () => ({
    meta: [
      { title: "Link Board — AI Metrics" },
      {
        name: "description",
        content: "Curated, drag-and-drop board of important links.",
      },
    ],
  }),
  component: LinksPage,
});

function LinksPage() {
  const { links, loaded, add, update, remove, reorder } = useLinkBoard();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LinkItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = links.findIndex((l) => l.id === active.id);
    const newIndex = links.findIndex((l) => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(links, oldIndex, newIndex);
    reorder(next.map((l) => l.id));
  };

  const openAdd = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (link: LinkItem) => {
    setEditing(link);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setEditing(null);
  };

  return (
    <div className="px-4 md:px-10 py-8 md:py-14 max-w-6xl mx-auto">
      <PageHeader
        title="Link Board"
        subtitle={
          loaded ? `${links.length} saved · drag to reorder` : "Loading…"
        }
        action={
          <button onClick={openAdd} className={primaryButtonClass}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Link</span>
            <span className="sm:hidden">Add</span>
          </button>
        }
      />

      {!loaded ? (
        <LinkSkeleton />
      ) : links.length === 0 ? (
        <EmptyState onAdd={openAdd} />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={links.map((l) => l.id)}
            strategy={rectSortingStrategy}
          >
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              }}
            >
              {links.map((link) => (
                <LinkCard
                  key={link.id}
                  link={link}
                  onEdit={() => openEdit(link)}
                  onRemove={() => remove(link.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <LinkModal
        open={open}
        onClose={close}
        initial={editing}
        onSubmit={async (input) => {
          if (editing) await update(editing.id, input);
          else await add(input);
        }}
      />
    </div>
  );
}

function LinkSkeleton() {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className={cn("h-32 rounded-2xl bg-white/[0.04] animate-pulse")}
          style={{ animationDelay: `${i * 0.06}s` }}
        />
      ))}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 md:py-32 text-center">
      <div className="h-14 w-14 rounded-2xl bg-[var(--surface-2)] border border-border grid place-items-center mb-5">
        <Link2 className="h-6 w-6 text-copy-secondary" strokeWidth={1.5} />
      </div>
      <p className="text-[15px] font-medium text-foreground">No links yet</p>
      <p className="text-[13px] text-copy-secondary mt-1.5 mb-6">
        Build your personal board of must-keep URLs.
      </p>
      <button onClick={onAdd} className={primaryButtonClass}>
        <Plus className="h-4 w-4" /> Add your first link
      </button>
    </div>
  );
}