import { REMOVAL_REASON_MAX, removeTreeSchema } from "@highdea/shared";
import { type SubmitEvent, useState } from "react";

import { useRemoveTree } from "../../api/admin";
import { ApiError } from "../../api/client";
import { FormField, inputClassName } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { useToast } from "../../components/Toast";
import { useApiForm } from "../../lib/forms";

type RemoveTreeModalProps = {
  open: boolean;
  tree: { id: string; title: string; ownerUsername: string };
  onClose: () => void;
};

/**
 * M-09 管理者によるツリーの非公開化。理由は必須で、所有者に表示される（manifests/explore.md M-09）。
 * 成功後はツリーが公開でなくなるため、ビューアは P-11（見つからない）を表示する。
 */
export function RemoveTreeModal({ open, tree, onClose }: RemoveTreeModalProps) {
  return (
    <Modal
      open={open}
      title={`Remove “${tree.title}”?`}
      onClose={onClose}
      testId="remove-tree-modal"
    >
      {open && <RemoveTreeForm tree={tree} onClose={onClose} />}
    </Modal>
  );
}

function RemoveTreeForm({ tree, onClose }: Omit<RemoveTreeModalProps, "open">) {
  const [reason, setReason] = useState("");
  const form = useApiForm(removeTreeSchema);
  const remove = useRemoveTree(tree.id, tree.ownerUsername);
  const toast = useToast();

  function submit(e: SubmitEvent) {
    e.preventDefault();
    const body = form.validate({ reason });
    if (!body) return;
    remove.mutate(body, {
      onSuccess: () => {
        toast("Tree removed from public view", "success");
        onClose();
      },
      onError: (err) => {
        // 他の管理者が先に非公開化していた場合（409 TREE_ALREADY_REMOVED）
        if (err instanceof ApiError && err.code === "TREE_ALREADY_REMOVED") {
          toast("Another admin already removed this tree.", "info");
          onClose();
          return;
        }
        form.applyServerError(err);
      },
    });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <p className="text-sm text-slate-700">
        Removes the tree from public view and makes it private. The owner keeps it and sees your
        reason.
      </p>
      <FormField
        id="removal-reason"
        label="Reason (shown to the owner)"
        error={form.fieldErrors.reason}
      >
        {(props) => (
          <textarea
            {...props}
            rows={3}
            maxLength={REMOVAL_REASON_MAX}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
            }}
            className={inputClassName}
          />
        )}
      </FormField>
      {form.formError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {form.formError}
        </p>
      )}
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
          disabled={remove.isPending}
          data-testid="remove-tree-confirm"
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
        >
          {remove.isPending ? "Removing…" : "Remove tree"}
        </button>
      </div>
    </form>
  );
}
