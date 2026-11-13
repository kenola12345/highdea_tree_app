import type { NodeSkeleton } from "@highdea/shared";

/** 指定ノードとその子孫すべての ID（枝ごと移動・削除するときに使う） */
export function branchIds(
  nodes: Pick<NodeSkeleton, "id" | "parentId">[],
  rootId: string,
): Set<string> {
  const children = new Map<string, string[]>();
  for (const n of nodes) {
    if (!n.parentId) continue;
    const list = children.get(n.parentId) ?? [];
    list.push(n.id);
    children.set(n.parentId, list);
  }
  const out = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined) break;
    for (const child of children.get(id) ?? []) {
      if (!out.has(child)) {
        out.add(child);
        stack.push(child);
      }
    }
  }
  return out;
}

/** 子孫の数（自分は含まない）。M-06 の「N ideas under it」に使う（manifests/nodes.md M-06） */
export function countDescendants(
  nodes: Pick<NodeSkeleton, "id" | "parentId">[],
  id: string,
): number {
  return branchIds(nodes, id).size - 1;
}

/** 間隔（ワールド座標）。自動配置と同じ値にそろえる */
const CHILD_DX = 300;
const CHILD_DY = 120;
/** 重なり判定に使うカードの大きさ（中心どうしの距離がこれ未満なら重なる） */
const CARD_W = 210;
const CARD_H = 96;

/**
 * 新しい子ノード（または付け替えたノード）を置く位置。親の右側、既存の子がいれば一番下の子のさらに下
 * （manifests/nodes.md M-05「creates the child node next to its parent」）。
 * 放射状に置かれた木では他のカードと重なることがあるので、重ならない位置まで下へずらす。
 */
export function newChildPosition(
  layout: {
    byId: ReadonlyMap<string, { x: number; y: number }>;
    nodes: { id: string; parentId: string | null; x: number; y: number }[];
  },
  parentId: string,
  exclude: ReadonlySet<string> = new Set(),
): { x: number; y: number } {
  const parent = layout.byId.get(parentId);
  if (!parent) return { x: 0, y: 0 };
  const others = layout.nodes.filter((n) => !exclude.has(n.id));
  const children = others.filter((n) => n.parentId === parentId);
  const start =
    children.length === 0
      ? { x: Math.round(parent.x + CHILD_DX), y: Math.round(parent.y) }
      : (() => {
          const lowest = children.reduce((a, b) => (b.y > a.y ? b : a));
          return { x: Math.round(lowest.x), y: Math.round(lowest.y + CHILD_DY) };
        })();
  const overlaps = (p: { x: number; y: number }) =>
    others.some((n) => Math.abs(n.x - p.x) < CARD_W && Math.abs(n.y - p.y) < CARD_H);
  const pos = { ...start };
  for (let i = 0; i < 50 && overlaps(pos); i++) pos.y += CHILD_DY;
  return pos;
}
