import { MAX_NODES_PER_TREE } from "@highdea/shared";
import clsx from "clsx";

/** 「142 / 2000」のノード数表示。上限に達したら色を変える（manifests/nodes.md NodeCounter） */
export function NodeCounter({ count }: { count: number }) {
  const full = count >= MAX_NODES_PER_TREE;
  return (
    <span
      data-testid="node-counter"
      className={clsx(
        "bg-surface rounded-lg border px-2 py-1 text-xs tabular-nums shadow-sm",
        full ? "border-red-300 text-red-700" : "border-slate-200 text-slate-600",
      )}
    >
      {count.toLocaleString()} / {MAX_NODES_PER_TREE.toLocaleString()} ideas
    </span>
  );
}
