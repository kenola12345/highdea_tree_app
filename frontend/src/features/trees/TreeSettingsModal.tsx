import { type TreeCategoryRef, type TreeVisibility, updateTreeSchema } from "@highdea/shared";
import { type SubmitEvent, useState } from "react";

import { ApiError } from "../../api/client";
import { useUpdateTree } from "../../api/trees";
import { FormField, inputClassName } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { useToast } from "../../components/Toast";
import { useApiForm } from "../../lib/forms";
import { CategoryPicker } from "../categories/CategoryPicker";
import { VisibilityField } from "./VisibilityField";

export type EditableTree = {
  id: string;
  title: string;
  description: string | null;
  visibility: TreeVisibility;
  categories: TreeCategoryRef[];
  removedAt: string | null;
  removalReason: string | null;
};

type TreeSettingsModalProps = {
  tree: EditableTree | null;
  onClose: () => void;
  /** 「Move to Trash」を押したとき（M-03 を開く） */
  onMoveToTrash: (tree: EditableTree) => void;
};

/** M-02 ツリー設定: 題名・説明・公開状態・カテゴリの変更とゴミ箱への移動（manifests/trees.md M-02） */
export function TreeSettingsModal({ tree, onClose, onMoveToTrash }: TreeSettingsModalProps) {
  return (
    <Modal
      open={Boolean(tree)}
      title="Tree settings"
      onClose={onClose}
      testId="tree-settings-modal"
    >
      {tree && (
        <TreeSettingsForm
          key={tree.id}
          tree={tree}
          onClose={onClose}
          onMoveToTrash={onMoveToTrash}
        />
      )}
    </Modal>
  );
}

function TreeSettingsForm({
  tree,
  onClose,
  onMoveToTrash,
}: TreeSettingsModalProps & { tree: EditableTree }) {
  const [title, setTitle] = useState(tree.title);
  const [description, setDescription] = useState(tree.description ?? "");
  const [visibility, setVisibility] = useState<TreeVisibility>(tree.visibility);
  const [categoryIds, setCategoryIds] = useState(tree.categories.map((c) => c.id));
  const form = useApiForm(updateTreeSchema);
  const update = useUpdateTree();
  const toast = useToast();
  // 管理者に非公開化されたツリーは所有者でも公開に戻せない（manifests/trees.md §3.9・M-02）
  const removed = Boolean(tree.removedAt);

  function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    const body = form.validate({
      title,
      description,
      categoryIds,
      ...(removed ? {} : { visibility }),
    });
    if (!body) return;
    update.mutate(
      { id: tree.id, body },
      {
        onSuccess: () => {
          toast("Tree saved", "success");
          onClose();
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code === "TREE_REMOVED") {
            form.setFormError("An admin removed this tree, so it can't be made public.");
            return;
          }
          form.applyServerError(err, { CATEGORY_NOT_FOUND: "categoryIds" });
        },
      },
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {removed && (
        <div
          role="note"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          data-testid="removal-banner"
        >
          <p className="font-medium">Removed by an admin; can&apos;t be made public.</p>
          {tree.removalReason && <p className="mt-1">Reason: {tree.removalReason}</p>}
        </div>
      )}
      <FormField id="settings-title" label="Title" error={form.fieldErrors.title}>
        {(props) => (
          <input
            {...props}
            value={title}
            maxLength={100}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
            className={inputClassName}
          />
        )}
      </FormField>
      <FormField
        id="settings-description"
        label="Description (optional)"
        error={form.fieldErrors.description}
      >
        {(props) => (
          <textarea
            {...props}
            rows={2}
            maxLength={500}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
            }}
            className={inputClassName}
          />
        )}
      </FormField>
      <VisibilityField value={visibility} onChange={setVisibility} disabled={removed} />
      <div>
        <p className="mb-1 text-sm font-medium text-slate-800">Categories</p>
        <CategoryPicker selectedIds={categoryIds} onChange={setCategoryIds} />
        {form.fieldErrors.categoryIds && (
          <p className="mt-1 text-xs text-red-700">{form.fieldErrors.categoryIds}</p>
        )}
      </div>
      {form.formError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {form.formError}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={() => {
            onMoveToTrash(tree);
          }}
          data-testid="settings-move-to-trash"
          className="rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          Move to Trash
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={update.isPending}
            data-testid="tree-settings-save"
            className="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {update.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}
