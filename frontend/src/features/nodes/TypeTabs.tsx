import clsx from "clsx";

import type { NodeType } from "./nodeForm";

export const NODE_TYPES: { type: NodeType; label: string; icon: string }[] = [
  { type: "TEXT", label: "Text", icon: "✎" },
  { type: "LINK", label: "Link", icon: "🔗" },
  { type: "VIDEO", label: "Video", icon: "▶" },
  { type: "IMAGE", label: "Image", icon: "🖼" },
];

/** ノードの種類の切り替え（Text / Link / Video / Image） */
export function TypeTabs({
  value,
  onChange,
}: {
  value: NodeType;
  onChange: (type: NodeType) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Idea type"
      className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1"
    >
      {NODE_TYPES.map((t) => (
        <button
          key={t.type}
          type="button"
          role="radio"
          aria-checked={value === t.type}
          data-testid={`type-${t.type}`}
          onClick={() => {
            onChange(t.type);
          }}
          className={clsx(
            "flex min-h-11 items-center justify-center gap-1 rounded-lg text-sm font-medium md:min-h-9",
            value === t.type
              ? "bg-surface text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900",
          )}
        >
          <span aria-hidden="true">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}
