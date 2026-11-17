import type { CategoryResponse } from "@highdea/shared";
import { useState } from "react";

import { useCategories } from "../../api/categories";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Spinner } from "../../components/Spinner";
import { CategoryChip } from "./CategoryChip";
import { CategoryFormModal } from "./CategoryFormModal";
import { DeleteCategoryModal } from "./DeleteCategoryModal";

/** 設定画面（P-10）の Categories タブ: 名前順の一覧、色・ツリー数、作成・編集・削除 */
export function CategoriesTab() {
  const { data: categories, isPending, isError, refetch } = useCategories();
  const [editing, setEditing] = useState<CategoryResponse | "new" | null>(null);
  const [deleting, setDeleting] = useState<CategoryResponse | null>(null);

  const newButton = (
    <button
      type="button"
      onClick={() => {
        setEditing("new");
      }}
      data-testid="new-category-button"
      className="bg-brand-700 hover:bg-brand-800 text-surface rounded-full px-4 py-2 text-sm font-medium"
    >
      + New category
    </button>
  );

  return (
    <section aria-labelledby="categories-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="categories-heading" className="text-lg font-semibold">
            Categories
          </h2>
          <p className="text-sm text-slate-600">Group your trees. Up to 100 categories.</p>
        </div>
        {categories && categories.length > 0 && newButton}
      </div>

      <div className="mt-4">
        {isPending && <Spinner />}
        {isError && (
          <ErrorState message="Couldn't load your categories." onRetry={() => void refetch()} />
        )}
        {categories?.length === 0 && (
          <EmptyState
            title="No categories yet"
            description="Create one to organize your trees."
            action={newButton}
          />
        )}
        {categories && categories.length > 0 && (
          <ul
            className="divide-y divide-slate-200 rounded-xl border border-slate-200"
            data-testid="category-list"
          >
            {categories.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 px-4 py-3"
                data-testid="category-row"
              >
                <div className="min-w-0 flex-1">
                  <CategoryChip category={c} />
                  <p className="mt-1 text-xs text-slate-500">
                    {c.treeCount} {c.treeCount === 1 ? "tree" : "trees"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(c);
                  }}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleting(c);
                  }}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CategoryFormModal
        open={editing !== null}
        category={editing === "new" || editing === null ? undefined : editing}
        onClose={() => {
          setEditing(null);
        }}
      />
      <DeleteCategoryModal
        category={deleting}
        onClose={() => {
          setDeleting(null);
        }}
      />
    </section>
  );
}
