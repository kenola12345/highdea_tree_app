import type { NodeRole } from "@highdea/shared";
import clsx from "clsx";

import { ROLE_INFO, ROLE_ORDER } from "../canvas/nodeStyles";

/**
 * M-04 のアイデアの種類（manifests/nodes.md §3.5 Idea kinds）: なし / Core / Supporting / Important / Example / Question。
 * 種類は見た目の強弱だけを変える（中身や並びは変わらない）。中心のアイデアには出さない。
 */
export function NodeKindField({
  value,
  onChange,
}: {
  value: NodeRole | null;
  onChange: (role: NodeRole | null) => void;
}) {
  const options: { role: NodeRole | null; label: string; icon: string; hint: string }[] = [
    { role: null, label: "None", icon: "○", hint: "A plain card" },
    ...ROLE_ORDER.map((role) => ({ role, ...ROLE_INFO[role] })),
  ];
  return (
    <div>
      <p id="node-kind-label" className="mb-1 block text-sm font-medium text-slate-800">
        Kind
      </p>
      <p className="mb-2 text-xs text-slate-500">Make key ideas stand out and details recede.</p>
      <div role="radiogroup" aria-labelledby="node-kind-label" className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={value === o.role}
            title={o.hint}
            onClick={() => {
              onChange(o.role);
            }}
            data-testid={`kind-${o.role ?? "NONE"}`}
            className={clsx(
              "flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold md:min-h-8",
              value === o.role
                ? "border-ink bg-ink text-surface"
                : "border-slate-300 text-slate-700 hover:bg-slate-50",
            )}
          >
            <span aria-hidden="true" className="text-xs">
              {o.icon}
            </span>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
