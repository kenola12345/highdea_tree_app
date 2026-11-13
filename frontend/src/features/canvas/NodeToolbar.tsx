import { MAX_NODES_PER_TREE } from "@highdea/shared";

import { OpenLink } from "../../components/OpenLink";
import type { LaidOutNode } from "./layout";
import { useNodeDetail } from "./useNodeDetails";

type NodeToolbarProps = {
  treeId: string;
  node: LaidOutNode;
  rect: { x: number; y: number; width: number; height: number };
  nodeCount: number;
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onView: () => void;
};

const button =
  "flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-3 text-sm font-medium whitespace-nowrap hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 md:min-h-9";

/**
 * 選択中のノードの上に出るツールバー: + Add（M-05）・Edit（M-04）・Delete（M-06）、画像・動画は View（M-10）。
 * 中心のアイデアには Delete を出さず、2,000件に達したら + Add を押せなくする（manifests/nodes.md NodeToolbar）。
 * スマホでは押しやすいよう各ボタンを 44×44px 以上にする。
 */
export function NodeToolbar({
  treeId,
  node,
  rect,
  nodeCount,
  onAdd,
  onEdit,
  onDelete,
  onView,
}: NodeToolbarProps) {
  const details = useNodeDetail(treeId, node.id);
  const full = nodeCount >= MAX_NODES_PER_TREE;
  const isMedia = node.type === "IMAGE" || node.type === "VIDEO";
  return (
    <div
      role="toolbar"
      aria-label="Idea actions"
      data-testid="node-toolbar"
      className="absolute z-10 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
      style={{ left: rect.x + rect.width / 2, top: Math.max(rect.y - 8, 56) }}
    >
      <button
        type="button"
        onClick={onAdd}
        disabled={full}
        title={full ? "This tree is full (2,000 ideas)" : "Add a branch (Tab)"}
        data-testid="add-branch-button"
        className={button}
      >
        + Add
      </button>
      <button
        type="button"
        onClick={onEdit}
        title="Edit (Enter)"
        data-testid="edit-node-button"
        className={button}
      >
        Edit
      </button>
      {isMedia && (
        <button type="button" onClick={onView} data-testid="view-media-button" className={button}>
          View
        </button>
      )}
      {node.type === "LINK" && (
        <OpenLink url={details?.url} testId="toolbar-open-link" className={button} />
      )}
      {!node.isRoot && (
        <button
          type="button"
          onClick={onDelete}
          title="Delete (Delete key)"
          data-testid="delete-node-button"
          className={`${button} text-red-700 hover:bg-red-50`}
        >
          Delete
        </button>
      )}
    </div>
  );
}
