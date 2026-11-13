import type { NodeSkeleton } from "@highdea/shared";
import { stratify, tree as d3tree } from "d3-hierarchy";

/** カードの大きさ（ワールド座標）。表示範囲の判定と配置に使う */
export const CARD_WIDTH = 200;
export const CARD_HEIGHT = 84;
export const ROOT_WIDTH = 240;
export const ROOT_HEIGHT = 96;
/** 自動配置の間隔: 深さ方向（左→右）と兄弟方向（上→下） */
const DEPTH_SPACING = 300;
const SIBLING_SPACING = 120;

/** 線の色が誰にも設定されていないときの色（slate-400） */
export const DEFAULT_LINE_COLOR = "#94a3b8";

export type LaidOutNode = NodeSkeleton & {
  /** このノードへ入る線の色。自分の lineColor、なければ最も近い祖先の色、なければ既定の色（manifests/nodes.md §3.5） */
  branchColor: string;
  /** カード中心のワールド座標 */
  x: number;
  y: number;
  depth: number;
  isRoot: boolean;
};

export type Link = { id: string; source: LaidOutNode; target: LaidOutNode };

export type Layout = {
  nodes: LaidOutNode[];
  byId: Map<string, LaidOutNode>;
  links: Link[];
  /** 全ノードを囲む範囲（カードの大きさ込み） */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
};

/**
 * 位置が保存済みかどうか。ノード作成時の既定値は (0, 0) なので、ルート以外で (0, 0) なら「未配置」とみなして自動配置する。
 * （ルート以外を中心と同じ位置に置くと重なって見えないため、実用上この判定で問題ない）
 */
function hasSavedPosition(node: NodeSkeleton): boolean {
  return node.parentId === null || node.positionX !== 0 || node.positionY !== 0;
}

/**
 * フラットな骨格（parentId 付き）から木構造を作り、各ノードの表示位置を決める純粋関数。
 * 兄弟は sortOrder 順に並べ、自動配置（左→右のツリー、ルートが原点）より保存済みの位置を優先する（manifests/nodes.md TreeCanvas）。
 */
export function layoutTree(skeleton: NodeSkeleton[]): Layout {
  const empty: Layout = {
    nodes: [],
    byId: new Map(),
    links: [],
    bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
  };
  if (skeleton.length === 0) return empty;

  const ids = new Set(skeleton.map((n) => n.id));
  // 親が一覧にないノード（直前に削除された等）は表示しない。stratify が失敗しないように除く
  const usable = skeleton.filter((n) => n.parentId === null || ids.has(n.parentId));
  const root = stratify<NodeSkeleton>()
    .id((n) => n.id)
    .parentId((n) => n.parentId)(usable);
  root.sort(
    (a, b) => a.data.sortOrder - b.data.sortOrder || a.data.title.localeCompare(b.data.title),
  );
  d3tree<NodeSkeleton>().nodeSize([SIBLING_SPACING, DEPTH_SPACING])(root);

  const nodes: LaidOutNode[] = [];
  const byId = new Map<string, LaidOutNode>();
  // descendants() は親を子より先に返すので、親の色を引き継ぎながら順に決められる
  for (const d of root.descendants()) {
    const saved = hasSavedPosition(d.data);
    const parentColor = d.parent ? byId.get(d.parent.data.id)?.branchColor : undefined;
    // d3 の tree は x が兄弟方向・y が深さ方向なので、左→右に伸びるよう入れ替える
    const node: LaidOutNode = {
      ...d.data,
      x: saved ? d.data.positionX : (d.y ?? 0),
      y: saved ? d.data.positionY : (d.x ?? 0),
      depth: d.depth,
      isRoot: d.parent === null,
      branchColor: d.data.lineColor ?? parentColor ?? DEFAULT_LINE_COLOR,
    };
    nodes.push(node);
    byId.set(node.id, node);
  }

  const links: Link[] = [];
  for (const node of nodes) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) links.push({ id: node.id, source: parent, target: node });
  }

  return { nodes, byId, links, bounds: boundsOf(nodes) };
}

/** カードの大きさ（ルートは大きい） */
export function cardSize(node: { isRoot: boolean }): { width: number; height: number } {
  return node.isRoot
    ? { width: ROOT_WIDTH, height: ROOT_HEIGHT }
    : { width: CARD_WIDTH, height: CARD_HEIGHT };
}

/** ノード群を囲む範囲 */
export function boundsOf(nodes: { x: number; y: number; isRoot: boolean }[]): Layout["bounds"] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const { width, height } = cardSize(n);
    minX = Math.min(minX, n.x - width / 2);
    maxX = Math.max(maxX, n.x + width / 2);
    minY = Math.min(minY, n.y - height / 2);
    maxY = Math.max(maxY, n.y + height / 2);
  }
  return nodes.length === 0 ? { minX: 0, minY: 0, maxX: 0, maxY: 0 } : { minX, minY, maxX, maxY };
}
