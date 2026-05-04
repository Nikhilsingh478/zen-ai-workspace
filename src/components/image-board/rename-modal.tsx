import { useEffect, useState } from "react";
import {
  MatrixModal,
  fieldClass,
  labelClass,
  primaryButtonClass,
  ghostButtonClass,
} from "@/components/matrix-modal";
import { cn } from "@/lib/utils";
import type { ImageItem } from "@/lib/image-board";

export function RenameImageModal({
  open,
  onClose,
  image,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  image: ImageItem | null;
  onSubmit: (name: string) => Promise<void> | void;
}) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName(image?.name ?? "");
  }, [open, image]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onSubmit(name.trim());
    onClose();
  };

  return (
    <MatrixModal open={open} onClose={onClose} title="Rename image">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelClass}>Image name</label>
          <input
            className={fieldClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={ghostButtonClass}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className={cn(
              primaryButtonClass,
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          >
            Save
          </button>
        </div>
      </form>
    </MatrixModal>
  );
}