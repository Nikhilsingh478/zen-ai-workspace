import { useEffect, useRef, useState } from "react";
import {
  MatrixModal,
  fieldClass,
  labelClass,
  primaryButtonClass,
  ghostButtonClass,
} from "@/components/matrix-modal";
import { cn } from "@/lib/utils";
import { MAX_IMAGE_BYTES } from "@/lib/image-board";

export function UploadImageModal({
  open,
  onClose,
  onUpload,
}: {
  open: boolean;
  onClose: () => void;
  onUpload: (name: string, file: File) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setFile(null);
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > MAX_IMAGE_BYTES) {
      setError("File is over 5MB.");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setFile(f);
    if (f && !name.trim()) {
      setName(f.name.replace(/\.[^.]+$/, ""));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !file || busy) return;
    setBusy(true);
    const ok = await onUpload(name.trim(), file);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <MatrixModal open={open} onClose={onClose} title="Upload image">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelClass}>Image name</label>
          <input
            className={fieldClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Brand mark v3"
            autoFocus
          />
        </div>
        <div>
          <label className={labelClass}>File</label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onFileChange}
            className={cn(
              fieldClass,
              "file:mr-3 file:rounded-lg file:border-0 file:bg-white/[0.06] file:px-3 file:py-1.5 file:text-foreground file:text-xs file:font-medium hover:file:bg-white/[0.1] cursor-pointer",
            )}
          />
          {error && (
            <p className="mt-2 text-[12px] text-red-400">{error}</p>
          )}
          {file && !error && (
            <p className="mt-2 text-[11px] text-copy-muted">
              {(file.size / 1024).toFixed(0)} KB · {file.type || "image"}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className={ghostButtonClass}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || !file || busy}
            className={cn(
              primaryButtonClass,
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          >
            {busy ? "Uploading…" : "Upload"}
          </button>
        </div>
      </form>
    </MatrixModal>
  );
}