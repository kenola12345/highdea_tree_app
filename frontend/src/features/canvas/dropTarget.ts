import { cardSize, type LaidOutNode } from "./layout";

/**
 * ドロップ位置（ワールド座標）の下にある付け替え先ノードを探す純粋関数。
 * 動かしている枝の中のノードは対象にしない（自分の枝の下へは移せない: manifests/nodes.md §3.5）。
 */
export function findDropTarget(
  nodes: LaidOutNode[],
  point: { x: number; y: number },
  draggedBranch: ReadonlySet<string>,
): LaidOutNode | null {
  // 後に描かれたもの（上に重なっているもの）を優先する
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (!n || draggedBranch.has(n.id)) continue;
    const { width, height } = cardSize(n);
    if (Math.abs(point.x - n.x) <= width / 2 && Math.abs(point.y - n.y) <= height / 2) return n;
  }
  return null;
}

/**
 * 付け替えてよいか。中心のアイデアは他のノードの下へ移せず、現在の親へ落としても付け替えにはならない
 * （サーバーの 409 INVALID_MOVE と同じ条件を、リクエストの前に UI で判断する）。
 */
export function canReparent(
  dragged: LaidOutNode,
  target: LaidOutNode,
  draggedBranch: ReadonlySet<string>,
): boolean {
  if (dragged.isRoot) return false;
  if (draggedBranch.has(target.id)) return false;
  return dragged.parentId !== target.id;
}
