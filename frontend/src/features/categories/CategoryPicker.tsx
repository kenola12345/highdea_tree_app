import { type CategoryResponse, MAX_CATEGORIES_PER_TREE } from "@highdea/shared";
import clsx from "clsx";
import { useState } from "react";

import { useCategories } from "../../api/categories";
import { readableTextColor } from "./CategoryChip";
import { CategoryFormModal } from "./CategoryFormModal";

type CategoryPickerProps = {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

/**
 * ツリーに付けるカテゴリの選択（M-01 / M-02 で使用）。1ツリー10個まで（manifests/trees.md §3.3）。
 * 10個選ぶと残りは選べなくなり、「+ New category」から作ったカテゴリはその場で選択される。
 */
export function CategoryPicker({ selectedIds, onChange }: CategoryPickerProps) {
  const { data: categories, isPending, isError } = useCategories();
  const [creating, setCreating] = useState(false);
  const atLimit = selectedIds.length >= MAX_CATEGORIES_PER_TREE;

  function toggle(id: string) {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
    else if (!atLimit) onChange([...selectedIds, id]);
  }

  function onCreated(category: CategoryResponse) {
    if (!atLimit) onChange([...selectedIds, category.id]);
  }

  return (
    <div data-testid="category-picker">
      {isPending && <p className="text-sm text-slate-500">Loading categories…</p>}
      {isError && <p className="text-sm text-red-700">Couldn&apos;t load your categories.</p>}
      {categories && (
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const selected = selectedIds.includes(c.id);
            const disabled = !selected && atLimit;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => {
                  toggle(c.id);
                }}
                className={clsx(
                  "inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
                  selected
                    ? "border-transparent"
                    : "bg-surface border-slate-300 text-slate-700 hover:bg-slate-50",
                )}
                style={
                  selected
                    ? { backgroundColor: c.color, color: readableTextColor(c.color) }
                    : undefined
                }
              >
                {!selected && (
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                )}
                {c.name}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setCreating(true);
            }}
            className="text-brand-700 hover:bg-brand-50 inline-flex min-h-9 items-center rounded-full border border-dashed border-slate-300 px-3 text-sm font-medium"
          >
            + New category
          </button>
        </div>
      )}
      <p className="mt-2 text-xs text-slate-500" aria-live="polite">
        {atLimit
          ? `You can pick up to ${String(MAX_CATEGORIES_PER_TREE)} categories per tree.`
          : `${String(selectedIds.length)} of ${String(MAX_CATEGORIES_PER_TREE)} selected`}
      </p>
      <CategoryFormModal
        open={creating}
        onClose={() => {
          setCreating(false);
        }}
        onSaved={onCreated}
      />
    </div>
  );
}
