import type { CategoryResponse } from "@highdea/shared";

import { useDeleteCategory } from "../../api/categories";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";

type DeleteCategoryModalProps = { category: CategoryResponse | null; onClose: () => void };

/**
 * M-08 カテゴリ削除の確認。何個のツリーから外れるかを示す（manifests/common.md §4 Business rules visible in the UI）。
 * ツリー自体は消えず、ラベルが外れるだけ。
 */
export function DeleteCategoryModal({ category, onClose }: DeleteCategoryModalProps) {
  const remove = useDeleteCategory();
  const toast = useToast();
  const count = category?.treeCount ?? 0;

  return (
    <ConfirmDialog
      open={Boolean(category)}
      title={`Delete “${category?.name ?? ""}”?`}
      message={
        count > 0
          ? `Remove this category from ${String(count)} ${count === 1 ? "tree" : "trees"}? The trees themselves stay.`
          : "This category isn't on any trees. Delete it?"
      }
      confirmLabel="Delete category"
      danger
      pending={remove.isPending}
      error={remove.error?.message ?? null}
      testId="delete-category-modal"
      onCancel={() => {
        remove.reset();
        onClose();
      }}
      onConfirm={() => {
        if (!category) return;
        remove.mutate(category.id, {
          onSuccess: () => {
            toast("Category deleted", "success");
            onClose();
          },
        });
      }}
    />
  );
}
