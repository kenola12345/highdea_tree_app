import clsx from "clsx";

import { useExploreCategories } from "../../api/explore";

type CategoryChipsProps = {
  selected: string | undefined;
  onSelect: (key: string | undefined) => void;
};

const chip =
  "inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap";

/**
 * よく使われているカテゴリのチップ。押すとそのカテゴリで絞り込み（もう一度押すと解除）。
 * 選択中のカテゴリのキーは URL の ?category= に持つ。スマホでは横にスクロールする（manifests/explore.md P-07）。
 */
export function CategoryChips({ selected, onSelect }: CategoryChipsProps) {
  const { data } = useExploreCategories();
  const categories = data?.categories ?? [];
  if (categories.length === 0) return null;
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1"
      role="group"
      aria-label="Popular categories"
      data-testid="category-chips"
    >
      <button
        type="button"
        aria-pressed={!selected}
        onClick={() => {
          onSelect(undefined);
        }}
        className={clsx(
          chip,
          !selected
            ? "border-slate-900 bg-slate-900 text-white"
            : "border-slate-300 text-slate-700 hover:bg-slate-50",
        )}
      >
        All
      </button>
      {categories.map((c) => {
        const active = selected === c.key;
        return (
          <button
            key={c.key}
            type="button"
            aria-pressed={active}
            onClick={() => {
              onSelect(active ? undefined : c.key);
            }}
            className={clsx(
              chip,
              active
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-slate-300 text-slate-700 hover:bg-slate-50",
            )}
          >
            {c.name}
            <span className={clsx("text-xs", active ? "text-white/80" : "text-slate-400")}>
              {c.treeCount}
            </span>
          </button>
        );
      })}
    </div>
  );
}
