import { deactivateSchema } from "@highdea/shared";
import { type SubmitEvent, useState } from "react";

import { ApiError } from "../../api/client";
import { useDeactivate } from "../../api/users";
import { FormField, inputClassName } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { useApiForm } from "../../lib/forms";
import { FormError, TOO_MANY_PASSWORD_ATTEMPTS } from "./formParts";

type DeleteAccountModalProps = { open: boolean; onClose: () => void };

/**
 * M-11 退会の確認。何が起きるか（プロフィールと公開ツリーが見えなくなる、メールとユーザー名は使えないまま、元に戻せない）を
 * 説明し、パスワードを確認してから退会する。成功したらゲストとしてトップページへ（manifests/users.md M-11）。
 */
export function DeleteAccountModal({ open, onClose }: DeleteAccountModalProps) {
  return (
    <Modal open={open} title="Delete your account?" onClose={onClose} testId="delete-account-modal">
      {open && <DeleteAccountForm onClose={onClose} />}
    </Modal>
  );
}

function DeleteAccountForm({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState("");
  const form = useApiForm(deactivateSchema);
  const deactivate = useDeactivate();

  function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    const body = form.validate({ password });
    if (!body) return;
    deactivate.mutate(body, {
      onError: (err) => {
        if (err instanceof ApiError && err.code === "RATE_LIMITED")
          form.setFormError(TOO_MANY_PASSWORD_ATTEMPTS);
        else form.applyServerError(err, { WRONG_PASSWORD: "password" });
      },
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
        <li>Your profile and public trees disappear for everyone.</li>
        <li>Your email and username stay taken; they can&apos;t be used for a new account.</li>
        <li>This can&apos;t be undone.</li>
      </ul>
      <FormField
        id="delete-password"
        label="Enter your password to confirm"
        error={form.fieldErrors.password}
      >
        {(props) => (
          <input
            {...props}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
            }}
            className={inputClassName}
          />
        )}
      </FormField>
      <FormError message={form.formError} />
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={deactivate.isPending}
          data-testid="delete-account-confirm"
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
        >
          {deactivate.isPending ? "Deleting…" : "Delete my account"}
        </button>
      </div>
    </form>
  );
}
