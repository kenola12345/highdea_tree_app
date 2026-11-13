import { type SubmitEvent, useState } from "react";

import { FormField, inputClassName } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import type { NodeType } from "./nodeForm";
import { TypeTabs } from "./TypeTabs";

type AddBranchModalProps = {
  open: boolean;
  parentTitle: string;
  onClose: () => void;
  /** 種類と題名を受け取って追加する（呼び出し側が作成し、続けて M-04 を開く） */
  onSubmit: (values: { type: NodeType; title: string }) => void;
};

/**
 * M-05 枝の追加: 種類と題名だけを決めて子ノードを作り、続けて M-04 で詳細（URL・画像・メモ）を入れる（manifests/nodes.md M-05）。
 * リンク・動画・画像は作成時に URL や画像が必須なため、まずテキストとして作り、M-04 で選んだ種類に切り替えて保存する。
 */
export function AddBranchModal({ open, parentTitle, onClose, onSubmit }: AddBranchModalProps) {
  return (
    <Modal open={open} title="Add a branch" onClose={onClose} testId="add-branch-modal">
      {open && <AddBranchForm parentTitle={parentTitle} onClose={onClose} onSubmit={onSubmit} />}
    </Modal>
  );
}

function AddBranchForm({ parentTitle, onClose, onSubmit }: Omit<AddBranchModalProps, "open">) {
  const [type, setType] = useState<NodeType>("TEXT");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | undefined>();

  function submit(e: SubmitEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Enter a title");
      return;
    }
    if (trimmed.length > 200) {
      setError("Use 200 characters or fewer");
      return;
    }
    onSubmit({ type, title: trimmed });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <p className="text-sm text-slate-600">
        Branching from <span className="font-medium text-slate-900">{parentTitle}</span>
      </p>
      <TypeTabs value={type} onChange={setType} />
      <FormField id="branch-title" label="Title" error={error}>
        {(props) => (
          <input
            {...props}
            value={title}
            maxLength={200}
            data-testid="branch-title-input"
            onChange={(e) => {
              setTitle(e.target.value);
            }}
            className={inputClassName}
          />
        )}
      </FormField>
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
          data-testid="branch-submit"
          className="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2 text-sm font-medium text-white"
        >
          Add
        </button>
      </div>
    </form>
  );
}
