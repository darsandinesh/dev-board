"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "./Button";
import { Dialog } from "./Dialog";

/**
 * A confirm-before-acting modal for destructive actions. Render it
 * conditionally (when there's something pending) and wire onConfirm/onCancel.
 */
export function ConfirmDialog({
  title = "Are you sure?",
  message,
  confirmLabel = "Delete",
  pending = false,
  onConfirm,
  onCancel,
}: {
  title?: string;
  message: React.ReactNode;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog title={undefined} onClose={onCancel} className="max-w-sm">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            <div className="mt-1 text-sm text-slate-500">{message}</div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} disabled={pending}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
