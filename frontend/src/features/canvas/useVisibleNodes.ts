import { useMemo } from "react";

import type { LaidOutNode } from "./layout";
import { detailLevel, nodesInRect, type ViewTransform, visibleWorldRect } from "./viewport";

/**
 * 画面に見えているノード（＋余白）と、倍率に応じた描き方を返す。
 * 2,000ノードの木でも DOM に作るのは見えている分だけにする（manifests/nodes.md §3.5 遅延読み込み）。
 */
export function useVisibleNodes(
  nodes: LaidOutNode[],
  transform: ViewTransform,
  size: { width: number; height: number },
) {
  return useMemo(() => {
    const rect = visibleWorldRect(transform, size.width, size.height);
    const visible = nodesInRect(nodes, rect);
    return {
      visible,
      visibleIds: new Set(visible.map((n) => n.id)),
      level: detailLevel(transform.k),
      rect,
    };
  }, [nodes, transform, size.width, size.height]);
}
