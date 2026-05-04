import { createFileRoute } from "@tanstack/react-router";
import { Bell, Plus } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { primaryButtonClass } from "@/components/matrix-modal";
import {
  useImportantMessages,
  type ImportantMessage,
} from "@/lib/important-messages";
import { MessageCard } from "@/components/messages/message-card";
import { MessageModal } from "@/components/messages/message-modal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Important Messages — AI Metrics" },
      {
        name: "description",
        content: "Reminders, motives, and time-bound notes.",
      },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const { messages, loaded, add, update, remove } = useImportantMessages();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ImportantMessage | null>(null);

  const openAdd = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (m: ImportantMessage) => {
    setEditing(m);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setEditing(null);
  };

  return (
    <div className="px-4 md:px-10 py-8 md:py-14 max-w-3xl mx-auto">
      <PageHeader
        title="Important Messages"
        subtitle={loaded ? `${messages.length} saved` : "Loading…"}
        action={
          <button onClick={openAdd} className={primaryButtonClass}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Message</span>
            <span className="sm:hidden">Add</span>
          </button>
        }
      />

      {!loaded ? (
        <MessagesSkeleton />
      ) : messages.length === 0 ? (
        <EmptyState onAdd={openAdd} />
      ) : (
        <div className="flex flex-col gap-4">
          {messages.map((m) => (
            <MessageCard
              key={m.id}
              message={m}
              onEdit={() => openEdit(m)}
              onRemove={() => remove(m.id)}
            />
          ))}
        </div>
      )}

      <MessageModal
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

function MessagesSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
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
        <Bell className="h-6 w-6 text-copy-secondary" strokeWidth={1.5} />
      </div>
      <p className="text-[15px] font-medium text-foreground">No messages yet</p>
      <p className="text-[13px] text-copy-secondary mt-1.5 mb-6">
        Save important reminders with motive, time, and message.
      </p>
      <button onClick={onAdd} className={primaryButtonClass}>
        <Plus className="h-4 w-4" /> Add your first message
      </button>
    </div>
  );
}