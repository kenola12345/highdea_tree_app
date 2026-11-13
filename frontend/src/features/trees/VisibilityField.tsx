import type { TreeVisibility } from "@highdea/shared";
import clsx from "clsx";

type VisibilityFieldProps = {
  value: TreeVisibility;
  onChange: (value: TreeVisibility) => void;
  /** 管理者に非公開化されたツリーは公開に戻せないため操作できなくする */
  disabled?: boolean;
};

const OPTIONS: { value: TreeVisibility; label: string; description: string }[] = [
  { value: "PRIVATE", label: "Private", description: "Only you can see it." },
  { value: "PUBLIC", label: "Public", description: "Anyone can view it and find it on Explore." },
];

/** 公開状態の選択（Private / Public） */
export function VisibilityField({ value, onChange, disabled = false }: VisibilityFieldProps) {
  return (
    <fieldset disabled={disabled} className="disabled:opacity-60">
      <legend className="text-sm font-medium text-slate-800">Visibility</legend>
      <div className="mt-1 grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className={clsx(
              "flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm",
              value === o.value ? "border-brand-600 bg-brand-50" : "border-slate-300",
              disabled && "cursor-not-allowed",
            )}
          >
            <input
              type="radio"
              name="visibility"
              value={o.value}
              checked={value === o.value}
              onChange={() => {
                onChange(o.value);
              }}
              className="accent-brand-600 mt-0.5"
            />
            <span>
              <span className="block font-medium">{o.label}</span>
              <span className="block text-xs text-slate-600">{o.description}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
