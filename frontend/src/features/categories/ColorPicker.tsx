import clsx from "clsx";

import { inputClassName } from "../../components/FormField";

/** よく使う色の候補。先頭は DB の既定色（グレー #6B7280） */
export const CATEGORY_PALETTE = [
  "#6B7280",
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#14B8A6",
  "#3B82F6",
  "#6366F1",
  "#A855F7",
  "#EC4899",
] as const;

type ColorPickerProps = {
  id: string;
  value: string;
  onChange: (color: string) => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

/** カテゴリ色の選択。候補から選ぶか、#RRGGBB を直接入力する */
export function ColorPicker({ id, value, onChange, ...aria }: ColorPickerProps) {
  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Color presets" className="flex flex-wrap gap-2">
        {CATEGORY_PALETTE.map((color) => {
          const selected = value.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={color}
              onClick={() => {
                onChange(color);
              }}
              className={clsx(
                "size-8 rounded-full border-2 transition",
                selected ? "scale-110 border-slate-900" : "border-white ring-1 ring-slate-200",
              )}
              style={{ backgroundColor: color }}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="size-9 shrink-0 rounded-lg border border-slate-200"
          style={{ backgroundColor: value }}
        />
        <input
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value.trim());
          }}
          maxLength={7}
          spellCheck={false}
          className={clsx(inputClassName, "font-mono")}
          {...aria}
        />
      </div>
    </div>
  );
}
