import { useCategories } from "../../api/categories";

type MyTreesFilterProps = {
  value: string | undefined;
  onChange: (categoryId: string | undefined) => void;
};

/** マイツリーのカテゴリ絞り込み（選択は URL の ?category= に持つ） */
export function MyTreesFilter({ value, onChange }: MyTreesFilterProps) {
  const { data: categories } = useCategories();
  if (!categories || categories.length === 0) return null;
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-600">Category</span>
      <select
        value={value ?? ""}
        onChange={(e) => {
          onChange(e.target.value || undefined);
        }}
        data-testid="category-filter"
        className="focus:border-brand-600 rounded-lg border border-slate-300 px-3 py-2 text-base md:text-sm"
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.treeCount})
          </option>
        ))}
      </select>
    </label>
  );
}
