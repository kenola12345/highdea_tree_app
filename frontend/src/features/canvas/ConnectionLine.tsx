import { memo } from "react";

import type { LaidOutNode } from "./layout";
import { linkGeometry } from "./NodeLink";
import type { DetailLevel } from "./viewport";

/** つながりの線の色（slate-500）と、選択中の色（blue-600）。枝の線と見分けられるよう灰色の点線にする */
export const CONNECTION_COLOR = "#64748b";
const SELECTED_COLOR = "#2563eb";

type ConnectionLineProps = {
  id: string;
  a: LaidOutNode;
  b: LaidOutNode;
  level: DetailLevel;
  selected: boolean;
  /** エディタでは押して選べる（太い透明の当たり判定を付ける） */
  selectable: boolean;
};

const n = (v: number) => String(Math.round(v * 10) / 10);

/** 向きはないので、左（同じなら上）にあるアイデアを始点にして、線の形が保存順に左右されないようにする */
function ordered(a: LaidOutNode, b: LaidOutNode): [LaidOutNode, LaidOutNode] {
  return a.x < b.x || (a.x === b.x && a.y <= b.y) ? [a, b] : [b, a];
}

/**
 * アイデア同士のつながり（manifests/nodes.md §3.5 Connections）。枝と同じ S 字だが、細かい灰色の点線で描く。
 */
export const ConnectionLine = memo(function ConnectionLine({
  id,
  a,
  b,
  level,
  selected,
  selectable,
}: ConnectionLineProps) {
  const { start, end, controls } = linkGeometry(...ordered(a, b), level);
  const d = controls
    ? `M ${n(start.x)} ${n(start.y)} C ${n(controls[0].x)} ${n(controls[0].y)}, ${n(controls[1].x)} ${n(controls[1].y)}, ${n(end.x)} ${n(end.y)}`
    : `M ${n(start.x)} ${n(start.y)} L ${n(end.x)} ${n(end.y)}`;
  return (
    <g
      data-testid="connection-line"
      data-connection-id={selectable ? id : undefined}
      data-selected={selected || undefined}
      className={selectable ? "cursor-pointer" : undefined}
    >
      {selectable && (
        // 細い点線は押しにくいので、見えない太い線で当たり判定を広げる（画面上で 16px）
        <path
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth={16}
          vectorEffect="non-scaling-stroke"
          pointerEvents="stroke"
        />
      )}
      <path
        d={d}
        fill="none"
        stroke={selected ? SELECTED_COLOR : CONNECTION_COLOR}
        strokeWidth={selected ? 3 : 2}
        strokeDasharray="1 6"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
    </g>
  );
});

/** つながりの中点（選択時のツールバーの位置に使う）。曲線の t=0.5 の点 */
export function connectionMidpoint(a: LaidOutNode, b: LaidOutNode, level: DetailLevel) {
  const { start, end, controls } = linkGeometry(...ordered(a, b), level);
  if (!controls) return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const [c1, c2] = controls;
  return {
    x: (start.x + 3 * c1.x + 3 * c2.x + end.x) / 8,
    y: (start.y + 3 * c1.y + 3 * c2.y + end.y) / 8,
  };
}
