import type { TreeCategoryRef } from "@highdea/shared";

type CategoryChipProps = { category: Pick<TreeCategoryRef, "name" | "color"> };

/** 背景色の明るさから、読みやすい文字色（黒か白）を選ぶ。カテゴリ色はユーザーが自由に決めるため */
export function readableTextColor(hex: string): "#0f172a" | "#ffffff" {
  const value = /^#([0-9a-f]{6})$/i.exec(hex)?.[1];
  if (!value) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(value.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.4 ? "#0f172a" : "#ffffff";
}

/** カテゴリの色付きラベル */
export function CategoryChip({ category }: CategoryChipProps) {
  return (
    <span
      className="inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: category.color, color: readableTextColor(category.color) }}
    >
      {category.name}
    </span>
  );
}
