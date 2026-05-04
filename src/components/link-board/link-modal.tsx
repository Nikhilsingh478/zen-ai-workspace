import { useEffect, useState } from "react";
import {
  MatrixModal,
  fieldClass,
  labelClass,
  primaryButtonClass,
  ghostButtonClass,
} from "@/components/matrix-modal";
import { cn } from "@/lib/utils";
import type { LinkInput, LinkItem } from "@/lib/link-board";

export function LinkModal({
  open,
  onClose,
  initial,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  initial?: LinkItem | null;
  onSubmit: (input: LinkInput) => Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setUrl(initial?.url ?? "");
      setDescription(initial?.description ?? "");
    }
  }, [open, initial]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    await onSubmit({
      name: name.trim(),
      url: url.trim(),
      description: description.trim() || null,
    });
    onClose();
  };

  return (
    <MatrixModal
      open={open}
      onClose={onClose}
      title={initial ? "Edit link" : "New link"}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelClass}>Link Name</label>
          <input
            className={fieldClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Anthropic Docs"
            autoFocus
          />
        </div>
        <div>
          <label className={labelClass}>URL</label>
          <input
            className={fieldClass}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>
        <div>
          <label className={labelClass}>Description (optional)</label>
          <textarea
            className={cn(fieldClass, "min-h-[88px] resize-none")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Why this link matters…"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={ghostButtonClass}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || !url.trim()}
            className={cn(
              primaryButtonClass,
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          >
            {initial ? "Save changes" : "Add Link"}
          </button>
        </div>
      </form>
    </MatrixModal>
  );
}