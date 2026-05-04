import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Image as ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { primaryButtonClass } from "@/components/matrix-modal";
import { useImageBoard, type ImageItem } from "@/lib/image-board";
import { UploadImageModal } from "@/components/image-board/upload-modal";
import { RenameImageModal } from "@/components/image-board/rename-modal";
import { DeleteImageModal } from "@/components/image-board/delete-modal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/images")({
  head: () => ({
    meta: [
      { title: "Image Board — AI Metrics" },
      {
        name: "description",
        content: "Personal masonry board of uploaded images.",
      },
    ],
  }),
  component: ImagesPage,
});

function ImagesPage() {
  const { images, loaded, upload, rename, remove } = useImageBoard();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [renaming, setRenaming] = useState<ImageItem | null>(null);
  const [deleting, setDeleting] = useState<ImageItem | null>(null);

  return (
    <div className="px-4 md:px-10 py-8 md:py-14 max-w-6xl mx-auto">
      <PageHeader
        title="Image Board"
        subtitle={loaded ? `${images.length} images` : "Loading…"}
        action={
          <button
            onClick={() => setUploadOpen(true)}
            className={primaryButtonClass}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Upload Image</span>
            <span className="sm:hidden">Upload</span>
          </button>
        }
      />

      {!loaded ? (
        <ImagesSkeleton />
      ) : images.length === 0 ? (
        <EmptyState onAdd={() => setUploadOpen(true)} />
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 [column-fill:_balance]">
          {images.map((img) => (
            <ImageCard
              key={img.id}
              image={img}
              onEdit={() => setRenaming(img)}
              onDelete={() => setDeleting(img)}
            />
          ))}
        </div>
      )}

      <UploadImageModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUpload={upload}
      />
      <RenameImageModal
        open={!!renaming}
        onClose={() => setRenaming(null)}
        image={renaming}
        onSubmit={async (name) => {
          if (renaming) await rename(renaming.id, name);
        }}
      />
      <DeleteImageModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        image={deleting}
        onConfirm={async () => {
          if (deleting) await remove(deleting.id);
        }}
      />
    </div>
  );
}

function ImageCard({
  image,
  onEdit,
  onDelete,
}: {
  image: ImageItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="group relative mb-4 break-inside-avoid rounded-2xl border border-border bg-[var(--surface-2)] overflow-hidden hover:border-white/[0.13] transition"
    >
      <div className="relative">
        <img
          src={image.publicUrl}
          alt={image.name}
          loading="lazy"
          className="w-full h-auto block object-cover"
        />
        <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="h-8 w-8 grid place-items-center rounded-lg bg-black/55 backdrop-blur text-white hover:bg-black/75 transition"
            aria-label="Rename image"
            title="Rename"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="h-8 w-8 grid place-items-center rounded-lg bg-black/55 backdrop-blur text-white hover:bg-red-500/80 transition"
            aria-label="Delete image"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <p className="px-3.5 py-2.5 text-[12.5px] text-foreground truncate border-t border-border/40">
        {image.name}
      </p>
    </motion.div>
  );
}

function ImagesSkeleton() {
  const heights = ["h-48", "h-64", "h-40", "h-56", "h-72", "h-44"];
  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 [column-fill:_balance]">
      {heights.map((h, i) => (
        <div
          key={i}
          className={cn(
            "mb-4 break-inside-avoid rounded-2xl bg-white/[0.04] animate-pulse",
            h,
          )}
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
        <ImageIcon className="h-6 w-6 text-copy-secondary" strokeWidth={1.5} />
      </div>
      <p className="text-[15px] font-medium text-foreground">No images yet</p>
      <p className="text-[13px] text-copy-secondary mt-1.5 mb-6">
        Upload your first image to start the board.
      </p>
      <button onClick={onAdd} className={primaryButtonClass}>
        <Plus className="h-4 w-4" /> Upload an image
      </button>
    </div>
  );
}