import type { TreeCategoryRef } from "@highdea/shared";

type CategoryChipProps = { category: Pick<TreeCategoryRef, "name" | "color"> };

const DARK_TEXT = "#0f172a";
const LIGHT_TEXT = "#ffffff";

/** 相対輝度（WCAG の計算式） */
function luminance(hex: string): number | null {
  const value = /^#([0-9a-f]{6})$/i.exec(hex)?.[1];
  if (!value) return null;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(value.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * 背景色に対して読みやすい文字色（濃い色か白）を選ぶ。カテゴリ色はユーザーが自由に決めるため、
 * 両方のコントラスト比を計算して高いほうを使う（WCAG AA の 4.5:1 にできるだけ近づける）。
 */
export function readableTextColor(hex: string): typeof DARK_TEXT | typeof LIGHT_TEXT {
  const bg = luminance(hex);
  if (bg === null) return LIGHT_TEXT;
  const dark = luminance(DARK_TEXT) ?? 0;
  const contrastWithWhite = 1.05 / (bg + 0.05);
  const contrastWithDark = (bg + 0.05) / (dark + 0.05);
  return contrastWithWhite >= contrastWithDark ? LIGHT_TEXT : DARK_TEXT;
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
