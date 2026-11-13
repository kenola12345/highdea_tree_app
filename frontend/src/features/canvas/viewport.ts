import { cardSize, type LaidOutNode } from "./layout";

/** ズーム状態（d3-zoom の transform と同じ形）。画面座標 = ワールド座標 × k + (x, y) */
export type ViewTransform = { x: number; y: number; k: number };

/** ズーム倍率で変わる描き方。遠いと点、少し近いと短い題名、読める倍率でカード全体（manifests/nodes.md §3.5） */
export type DetailLevel = "dot" | "title" | "card";

/** これより小さい倍率では点だけ */
export const DOT_BELOW = 0.35;
/** これ以上の倍率でカード全体を描き、中身（メモ・画像など）を取得する */
export const CARD_FROM = 0.6;

/** 倍率から描き方を決める */
export function detailLevel(k: number): DetailLevel {
  if (k < DOT_BELOW) return "dot";
  if (k < CARD_FROM) return "title";
  return "card";
}

export type WorldRect = { minX: number; minY: number; maxX: number; maxY: number };

/**
 * 画面に見えているワールド座標の範囲。margin（画面ピクセル）だけ外側に広げ、
 * パンしたときに端のカードが遅れて現れないようにする。
 */
export function visibleWorldRect(
  t: ViewTransform,
  width: number,
  height: number,
  margin = 200,
): WorldRect {
  return {
    minX: (-margin - t.x) / t.k,
    minY: (-margin - t.y) / t.k,
    maxX: (width + margin - t.x) / t.k,
    maxY: (height + margin - t.y) / t.k,
  };
}

/** 見えている範囲に一部でもかかるノードだけを返す（表示範囲外のノードは DOM に作らない） */
export function nodesInRect<N extends Pick<LaidOutNode, "x" | "y" | "isRoot">>(
  nodes: N[],
  rect: WorldRect,
): N[] {
  return nodes.filter((n) => {
    const { width, height } = cardSize(n);
    return (
      n.x + width / 2 >= rect.minX &&
      n.x - width / 2 <= rect.maxX &&
      n.y + height / 2 >= rect.minY &&
      n.y - height / 2 <= rect.maxY
    );
  });
}

/** 範囲全体が画面に収まる transform（余白 padding、拡大は maxScale まで） */
export function fitTransform(
  bounds: WorldRect,
  width: number,
  height: number,
  { padding = 48, minScale = 0.1, maxScale = 1 } = {},
): ViewTransform {
  const w = Math.max(bounds.maxX - bounds.minX, 1);
  const h = Math.max(bounds.maxY - bounds.minY, 1);
  const k = Math.min(
    maxScale,
    Math.max(minScale, Math.min((width - padding * 2) / w, (height - padding * 2) / h)),
  );
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return { k, x: width / 2 - cx * k, y: height / 2 - cy * k };
}
