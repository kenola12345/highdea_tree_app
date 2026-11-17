// 「Tidy up」: カードが重ならないようにツリー全体を並べ直す（manifests/nodes.md §3.5 Tidy up）。
// 中心のアイデアはそのまま。枝を順番のまま右と左に分け（左右の縦の広がりがそろう所で）、各段は前の段の一番広いカードの先に置き、
// 兄弟はカードの高さに合わせて間をあける。カードの大きさは見えている大きさ（中身に合わせた大きさ・変えた大きさ）を使う。
import { hierarchy, type HierarchyPointNode, tree as d3tree } from "d3-hierarchy";

import { cardSize, type LaidOutNode } from "./layout";

/** 段の間（左右）と兄弟の間・いとこの間（上下）のすき間（px） */
const LEVEL_GAP = 90;
const SIBLING_GAP = 28;
const COUSIN_GAP = 48;

type Item = { node: LaidOutNode | null; children: Item[] };

/** 並べ直したあとの各ノードの中心（ワールド座標）。中心のアイデアは含めない（動かさない） */
export function tidyLayout(nodes: LaidOutNode[]): { id: string; x: number; y: number }[] {
  const root = nodes.find((n) => n.isRoot);
  if (!root) return [];
  const childrenOf = new Map<string, LaidOutNode[]>();
  for (const n of nodes) {
    if (!n.parentId) continue;
    const list = childrenOf.get(n.parentId) ?? [];
    list.push(n);
    childrenOf.set(n.parentId, list);
  }
  for (const list of childrenOf.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  }
  const build = (n: LaidOutNode): Item => ({
    node: n,
    children: (childrenOf.get(n.id) ?? []).map(build),
  });

  const top = childrenOf.get(root.id) ?? [];
  // 枝ごとの縦の広がり（葉のカードの高さとすき間の合計のおおよそ）。左右の高さがそろうよう、順番を保ったまま分ける
  const extent = (n: LaidOutNode): number => {
    const kids = childrenOf.get(n.id) ?? [];
    const own = cardSize(n).height;
    if (kids.length === 0) return own;
    const sum = kids.reduce((total, k) => total + extent(k), 0) + SIBLING_GAP * (kids.length - 1);
    return Math.max(own, sum);
  };
  const extents = top.map(extent);
  const total = extents.reduce((a, b) => a + b, 0);
  let split = Math.ceil(top.length / 2);
  let best = Infinity;
  let running = 0;
  for (let k = 1; k <= top.length; k++) {
    running += extents[k - 1] ?? 0;
    const diff = Math.abs(running - (total - running));
    if (diff < best) {
      best = diff;
      split = k;
    }
  }
  const sides: { items: LaidOutNode[]; dir: 1 | -1 }[] = [
    { items: top.slice(0, split), dir: 1 },
    { items: top.slice(split), dir: -1 },
  ];
  const rootWidth = cardSize(root).width;
  const result: { id: string; x: number; y: number }[] = [];

  for (const side of sides) {
    if (side.items.length === 0) continue;
    // 片側の枝をまとめる仮の根（中心のアイデアの代わり。位置の計算にだけ使う）
    const virtual: Item = { node: null, children: side.items.map(build) };
    const h = hierarchy(virtual, (d) => d.children);
    const heightOf = (d: HierarchyPointNode<Item>) =>
      d.data.node ? cardSize(d.data.node).height : 0;
    const laid = d3tree<Item>()
      .nodeSize([1, 1])
      .separation((a, b) => {
        const gap = a.parent === b.parent ? SIBLING_GAP : COUSIN_GAP;
        return (heightOf(a) + heightOf(b)) / 2 + gap;
      })(h);

    // 各段の横の位置: 前の段の一番広いカードの右端（左側は左端）の先
    const maxWidth = new Map<number, number>();
    laid.each((d) => {
      if (!d.data.node) return;
      maxWidth.set(d.depth, Math.max(maxWidth.get(d.depth) ?? 0, cardSize(d.data.node).width));
    });
    const depthX = new Map<number, number>([[0, 0]]);
    let edge = rootWidth / 2;
    for (let depth = 1; maxWidth.has(depth); depth++) {
      const w = maxWidth.get(depth) ?? 0;
      depthX.set(depth, edge + LEVEL_GAP + w / 2);
      edge += LEVEL_GAP + w;
    }

    // 片側の上下の真ん中を、中心のアイデアの高さにそろえる
    const ys: number[] = [];
    laid.each((d) => {
      if (d.data.node) ys.push(d.x);
    });
    const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
    laid.each((d) => {
      const n = d.data.node;
      if (!n) return;
      result.push({
        id: n.id,
        x: Math.round(root.x + side.dir * (depthX.get(d.depth) ?? 0)),
        y: Math.round(root.y + d.x - mid),
      });
    });
  }
  return result;
}
