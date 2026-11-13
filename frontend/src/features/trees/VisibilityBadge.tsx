import type { TreeVisibility } from "@highdea/shared";
import clsx from "clsx";

type VisibilityBadgeProps = { visibility: TreeVisibility; removed?: boolean };

/** 公開状態のバッジ。管理者に非公開化されたツリーは「Removed by admin」を優先して表示する（manifests/trees.md P-04） */
export function VisibilityBadge({ visibility, removed = false }: VisibilityBadgeProps) {
  const label = removed ? "Removed by admin" : visibility === "PUBLIC" ? "Public" : "Private";
  return (
    <span
      data-testid="visibility-badge"
      className={clsx(
        "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium",
        removed && "bg-red-100 text-red-800",
        !removed && visibility === "PUBLIC" && "bg-brand-100 text-brand-700",
        !removed && visibility === "PRIVATE" && "bg-slate-100 text-slate-700",
      )}
    >
      {label}
    </span>
  );
}
