import {
  MatrixModal,
  primaryButtonClass,
  ghostButtonClass,
} from "@/components/matrix-modal";
import { cn } from "@/lib/utils";
import type { ImageItem } from "@/lib/image-board";

export function DeleteImageModal({
  open,
  onClose,
  image,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  image: ImageItem | null;
  onConfirm: () => Promise<void> | void;
}) {
  return (
    <MatrixModal open={open} onClose={onClose} title="Delete image?">
      <div className="space-y-5">
        <p className="text-sm text-copy-secondary">
          {image
            ? `“${image.name}” will be permanently removed from your image board.`
            : "This image will be permanently removed."}
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ghostButtonClass}>
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              await onConfirm();
              onClose();
            }}
            className={cn(
              primaryButtonClass,
              "bg-red-500 text-white hover:bg-red-500/90",
            )}
          >
            Delete
          </button>
        </div>
      </div>
    </MatrixModal>
  );
}