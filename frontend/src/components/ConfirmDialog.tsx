import type { ReactNode } from "react";

import { Modal } from "./Modal";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** 削除など取り消せない操作は赤いボタンにする */
  danger?: boolean;
  pending?: boolean;
  error?: string | null;
  testId?: string;
};

/** 確認ダイアログ（削除・ゴミ箱移動など） */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  danger = false,
  pending = false,
  error,
  testId,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      testId={testId}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            data-testid="confirm-button"
            className={
              danger
                ? "rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                : "bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            }
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm text-slate-700">{message}</div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </Modal>
  );
}
