import clsx from "clsx";

import { CATEGORY_PALETTE } from "../categories/ColorPicker";

type LineColorFieldProps = {
  value: string | null;
  /** 祖先から受け継ぐ色（Inherit を選んだときの見え方） */
  inheritedColor: string;
  isRoot: boolean;
  onChange: (color: string | null) => void;
};

/**
 * 枝の線の色（M-04）。このアイデアへ入る線と、その下の線すべてに使われる。Inherit は祖先の色を受け継ぐ
 * （manifests/nodes.md §3.5 Line colors per branch）。中心のアイデアで選ぶと木全体の既定の色になる。
 */
export function LineColorField({ value, inheritedColor, isRoot, onChange }: LineColorFieldProps) {
  const swatch = "flex size-9 items-center justify-center rounded-full border-2 transition";
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-800">Line color</legend>
      <p className="text-xs text-slate-500">
        {isRoot
          ? "Default color for every line in this tree."
          : "Used for the line into this idea and every line below it."}
      </p>
      <div
        role="radiogroup"
        aria-label="Line color"
        className="mt-2 flex flex-wrap items-center gap-2"
      >
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          onClick={() => {
            onChange(null);
          }}
          data-testid="line-color-inherit"
          className={clsx(
            "flex h-9 items-center gap-2 rounded-full border-2 px-3 text-xs font-medium",
            value === null ? "border-slate-900" : "border-slate-200 hover:border-slate-300",
          )}
        >
          <span
            aria-hidden="true"
            className="size-3 rounded-full"
            style={{ backgroundColor: inheritedColor }}
          />
          {isRoot ? "Default" : "Inherit"}
        </button>
        {CATEGORY_PALETTE.map((color) => {
          const selected = value?.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={color}
              data-testid={`line-color-${color}`}
              onClick={() => {
                onChange(color);
              }}
              className={clsx(
                swatch,
                selected ? "scale-110 border-slate-900" : "border-white ring-1 ring-slate-200",
              )}
              style={{ backgroundColor: color }}
            />
          );
        })}
      </div>
    </fieldset>
  );
}
