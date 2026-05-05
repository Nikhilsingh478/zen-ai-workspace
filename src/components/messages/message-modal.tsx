import { useEffect, useState } from "react";
import {
  MatrixModal,
  fieldClass,
  labelClass,
  primaryButtonClass,
  ghostButtonClass,
} from "@/components/matrix-modal";
import { cn } from "@/lib/utils";
import type {
  ImportantMessage,
  ImportantMessageInput,
} from "@/lib/important-messages";

export function MessageModal({
  open,
  onClose,
  initial,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  initial?: ImportantMessage | null;
  onSubmit: (input: ImportantMessageInput) => Promise<void> | void;
}) {
  const [motive, setMotive] = useState("");
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (open) {
      setMotive(initial?.motive ?? "");
      setTime(initial?.time ?? "");
      setMessage(initial?.message ?? "");
    }
  }, [open, initial]);

  const valid =
    motive.trim().length > 0 &&
    time.trim().length > 0 &&
    message.trim().length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    await onSubmit({
      motive: motive.trim(),
      time: time.trim(),
      message: message.trim(),
    });
    onClose();
  };

  return (
    <MatrixModal
      open={open}
      onClose={onClose}
      title={initial ? "Edit message" : "New important message"}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelClass}>Motive</label>
          <input
            className={fieldClass}
            value={motive}
            onChange={(e) => setMotive(e.target.value)}
            placeholder="e.g. Follow up with client"
            autoFocus
          />
        </div>
        <div>
          <label className={labelClass}>Time</label>
          <input
            type="time"
            className={cn(fieldClass, "[&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:cursor-pointer")}
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Message</label>
          <textarea
            rows={4}
            className={cn(fieldClass, "resize-none leading-relaxed")}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What needs to be remembered?"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={ghostButtonClass}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid}
            className={cn(
              primaryButtonClass,
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          >
            {initial ? "Save changes" : "Add Message"}
          </button>
        </div>
      </form>
    </MatrixModal>
  );
}