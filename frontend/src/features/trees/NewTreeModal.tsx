import { createTreeSchema, type TreeVisibility } from "@highdea/shared";
import { type SubmitEvent, useState } from "react";
import { useNavigate } from "react-router";

import { useCreateTree } from "../../api/trees";
import { FormField, inputClassName } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { useApiForm } from "../../lib/forms";
import { CategoryPicker } from "../categories/CategoryPicker";
import { VisibilityField } from "./VisibilityField";

type NewTreeModalProps = { open: boolean; onClose: () => void };

/** M-01 ツリー作成。作成したらそのままエディタを開く（manifests/trees.md M-01） */
export function NewTreeModal({ open, onClose }: NewTreeModalProps) {
  return (
    <Modal open={open} title="New tree" onClose={onClose} testId="new-tree-modal">
      {open && <NewTreeForm onClose={onClose} />}
    </Modal>
  );
}

function NewTreeForm({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rootTitle, setRootTitle] = useState("");
  const [visibility, setVisibility] = useState<TreeVisibility>("PRIVATE");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const form = useApiForm(createTreeSchema);
  const create = useCreateTree();
  const navigate = useNavigate();

  function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    // 中心のアイデアは空なら題名と同じにする（サーバーも同じ既定値: manifests/trees.md POST /api/trees）
    const body = form.validate({
      title,
      description,
      visibility,
      categoryIds,
      ...(rootTitle.trim() ? { rootTitle } : {}),
    });
    if (!body) return;
    create.mutate(body, {
      onSuccess: ({ tree }) => {
        onClose();
        void navigate(`/trees/${tree.id}/edit`);
      },
      onError: (err) => form.applyServerError(err, { CATEGORY_NOT_FOUND: "categoryIds" }),
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormField id="tree-title" label="Title" error={form.fieldErrors.title}>
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
        id="tree-rootTitle"
        label="Center idea"
        hint="The idea in the middle of the canvas. Leave empty to use the title."
        error={form.fieldErrors.rootTitle}
      >
        {(props) => (
          <input
            {...props}
            value={rootTitle}
            placeholder={title.trim() || "Same as the title"}
            maxLength={200}
            onChange={(e) => {
              setRootTitle(e.target.value);
            }}
            className={inputClassName}
          />
        )}
      </FormField>
      <FormField
        id="tree-description"
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
      <VisibilityField value={visibility} onChange={setVisibility} />
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
          disabled={create.isPending}
          data-testid="create-tree-submit"
          className="bg-brand-700 hover:bg-brand-800 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {create.isPending ? "Creating…" : "Create and open"}
        </button>
      </div>
    </form>
  );
}
