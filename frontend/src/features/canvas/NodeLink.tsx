import { memo } from "react";

import type { LaidOutNode } from "./layout";

type NodeLinkProps = { source: LaidOutNode; target: LaidOutNode };

/**
 * 親ノードから子ノードへの線。中心どうしを結び、カードの下に描く（カードが線の端を隠す）。
 * 中心で結ぶと、放射状に置いた木でも、点だけの表示（遠いズーム）でも線が自然につながる。
 */
export const NodeLink = memo(function NodeLink({ source, target }: NodeLinkProps) {
  return (
    <line
      x1={source.x}
      y1={source.y}
      x2={target.x}
      y2={target.y}
      stroke="#94a3b8"
      strokeWidth={2}
      vectorEffect="non-scaling-stroke"
    />
  );
});
