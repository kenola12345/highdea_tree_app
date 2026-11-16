import { type CategoryResponse, createCategorySchema } from "@highdea/shared";
import { type SubmitEvent, useState } from "react";

import { useCreateCategory, useUpdateCategory } from "../../api/categories";
import { ApiError } from "../../api/client";
import { FormField, inputClassName } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { useToast } from "../../components/Toast";
import { useApiForm } from "../../lib/forms";
import { CategoryChip } from "./CategoryChip";
import { ColorPicker, DEFAULT_CATEGORY_COLOR } from "./ColorPicker";

type CategoryFormModalProps = {
  open: boolean;
  onClose: () => void;
  /** 指定すると編集、なければ新規作成 */
  category?: CategoryResponse;
  /** 保存したカテゴリを呼び出し元に渡す（ツリーのカテゴリ選択で新しいカテゴリを選択状態にするため） */
  onSaved?: (category: CategoryResponse) => void;
};

/** M-07 カテゴリの作成・編集。名前の重複（大文字小文字を区別しない）は名前欄の下に表示する（manifests/trees.md M-07） */
export function CategoryFormModal({ open, onClose, category, onSaved }: CategoryFormModalProps) {
  return (
    <Modal
      open={open}
      title={category ? "Edit category" : "New category"}
      onClose={onClose}
      testId="category-form-modal"
    >
      {/* 開くたびに入力を初期化するため、key で作り直す */}
      {open && (
        <CategoryForm
          key={category?.id ?? "new"}
          category={category}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Modal>
  );
}

function CategoryForm({ category, onClose, onSaved }: Omit<CategoryFormModalProps, "open">) {
  const [name, setName] = useState(category?.name ?? "");
  const [color, setColor] = useState(category?.color ?? DEFAULT_CATEGORY_COLOR);
  const form = useApiForm(createCategorySchema);
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const toast = useToast();
  const pending = create.isPending || update.isPending;

  function onError(err: unknown) {
    // 101個目はサーバーが拒否する（manifests/trees.md §3.7 カテゴリは100個まで）
    if (err instanceof ApiError && err.code === "CATEGORY_LIMIT_REACHED") {
      form.setFormError("You can have up to 100 categories. Delete one to add another.");
      return;
    }
    form.applyServerError(err, { CATEGORY_NAME_TAKEN: "name" });
  }

  function onSuccess(saved: CategoryResponse) {
    toast(category ? "Category saved" : "Category created", "success");
    onSaved?.(saved);
    onClose();
  }

  function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    const body = form.validate({ name, color });
    if (!body) return;
    if (category) update.mutate({ id: category.id, body }, { onSuccess, onError });
    else create.mutate(body, { onSuccess, onError });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormField id="category-name" label="Name" error={form.fieldErrors.name}>
        {(props) => (
          <input
            {...props}
            value={name}
            maxLength={50}
            onChange={(e) => {
              setName(e.target.value);
            }}
            className={inputClassName}
          />
        )}
      </FormField>
      <FormField id="category-color" label="Color" error={form.fieldErrors.color}>
        {(props) => <ColorPicker {...props} value={color} onChange={setColor} />}
      </FormField>
      <div className="flex items-center gap-2 text-sm text-slate-600">
        Preview:{" "}
        <CategoryChip
          category={{
            name: name.trim() || "Category",
            color: /^#[0-9a-f]{6}$/i.test(color) ? color : "#6B7280",
          }}
        />
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
          disabled={pending}
          data-testid="category-save"
          className="bg-brand-700 hover:bg-brand-800 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : category ? "Save" : "Create"}
        </button>
      </div>
    </form>
  );
}
