import { memo } from "react";

import type { LaidOutNode } from "./layout";
import { curveMidpoint, LineHalo, linkGeometry } from "./NodeLink";
import type { DetailLevel } from "./viewport";

/** つながりの線の既定の色（slate-500）。枝の線と見分けられるよう、色を選んでいなければ灰色の点線にする */
export const CONNECTION_COLOR = "#64748b";

type ConnectionLineProps = {
  id: string;
  a: LaidOutNode;
  b: LaidOutNode;
  /** 選んだ色（#RRGGBB）。null は既定の灰色 */
  color: string | null;
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
 * アイデア同士のつながり（manifests/nodes.md §3.5 Connections）。枝と同じ S 字だが、細かい点線で描く。
 * 選択中は色を保ったまま太くし、薄い青の縁取りで選んでいることを示す（選んだ色を確かめながら変えられるように）。
 */
export const ConnectionLine = memo(function ConnectionLine({
  id,
  a,
  b,
  color,
  level,
  selected,
  selectable,
}: ConnectionLineProps) {
  const { start, end, controls } = linkGeometry(...ordered(a, b), level);
  const d = controls
    ? `M ${n(start.x)} ${n(start.y)} C ${n(controls[0].x)} ${n(controls[0].y)}, ${n(controls[1].x)} ${n(controls[1].y)}, ${n(end.x)} ${n(end.y)}`
    : `M ${n(start.x)} ${n(start.y)} L ${n(end.x)} ${n(end.y)}`;
  const stroke = color ?? CONNECTION_COLOR;
  return (
    <g
      data-testid="connection-line"
      data-connection-id={selectable ? id : undefined}
      data-color={stroke}
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
      {selected && <LineHalo d={d} />}
      <path
        d={d}
        fill="none"
        stroke={stroke}
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
  return curveMidpoint(linkGeometry(...ordered(a, b), level));
}
