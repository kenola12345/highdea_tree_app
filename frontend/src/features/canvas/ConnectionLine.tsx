import type { ConnectionKind, NodeConnection } from "@highdea/shared";
import clsx from "clsx";
import { memo } from "react";

import type { LaidOutNode } from "./layout";
import { curveMidpoint, LineHalo, linkGeometry } from "./NodeLink";
import type { DetailLevel } from "./viewport";

/** つながりの線の既定の色（枝より少し濃い緑がかった灰色）。色を選んでいなければこの色 */
export const CONNECTION_COLOR = "#7A9283";

/** 種類ごとの線の模様と太さ（manifests/nodes.md §3.5 Connections Relationship type） */
const KIND_STYLE: Record<ConnectionKind, { dash: string | undefined; width: number }> = {
  // 関連: 控えめな点線
  RELATED: { dash: "1 6", width: 2 },
  // 順番: 矢印付きの実線
  SEQUENCE: { dash: undefined, width: 2 },
  // 依存: 矢印付きの破線
  DEPENDENCY: { dash: "7 5", width: 2 },
  // 対比: 一点鎖線と「vs」の印
  CONTRAST: { dash: "10 4 2 4", width: 2 },
};

export const KIND_LABEL: Record<ConnectionKind, string> = {
  RELATED: "Related",
  SEQUENCE: "Sequence",
  DEPENDENCY: "Depends on",
  CONTRAST: "Contrast",
};

type ConnectionLineProps = {
  id: string;
  /** 保存順の A・B（矢印の向きは A_TO_B / B_TO_A でこの順に対して決まる） */
  a: LaidOutNode;
  b: LaidOutNode;
  /** 選んだ色（#RRGGBB）。null は既定の灰色 */
  color: string | null;
  kind: ConnectionKind;
  arrow: NodeConnection["arrow"];
  level: DetailLevel;
  selected: boolean;
  /** エディタでは押して選べる（太い透明の当たり判定を付ける） */
  selectable: boolean;
  /** 選択中のアイデアに関係ないので薄くする */
  dimmed?: boolean;
};

const n = (v: number) => String(Math.round(v * 10) / 10);

/** 向きのない形にするため、左（同じなら上）にあるアイデアを始点にして、線の形が保存順に左右されないようにする */
function ordered(a: LaidOutNode, b: LaidOutNode): [LaidOutNode, LaidOutNode] {
  return a.x < b.x || (a.x === b.x && a.y <= b.y) ? [a, b] : [b, a];
}

/** 矢印の三角（先端 tip、来る方向 from）。線の端の向きに合わせる */
function arrowHead(tip: { x: number; y: number }, from: { x: number; y: number }): string {
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const size = 11;
  const back = { x: tip.x - ux * size, y: tip.y - uy * size };
  const left = { x: back.x - uy * size * 0.5, y: back.y + ux * size * 0.5 };
  const right = { x: back.x + uy * size * 0.5, y: back.y - ux * size * 0.5 };
  return `M ${n(tip.x)} ${n(tip.y)} L ${n(left.x)} ${n(left.y)} L ${n(right.x)} ${n(right.y)} Z`;
}

/**
 * アイデア同士のつながり（manifests/nodes.md §3.5 Connections）。枝と同じ S 字で、種類ごとに模様を変える
 * （関連=点線 / 順番=矢印付き実線 / 依存=矢印付き破線 / 対比=一点鎖線と「vs」）。
 * 選択中は色を保ったまま太くし、淡い黄色の縁取りで選んでいることを示す。
 */
export const ConnectionLine = memo(function ConnectionLine({
  id,
  a,
  b,
  color,
  kind,
  arrow,
  level,
  selected,
  selectable,
  dimmed = false,
}: ConnectionLineProps) {
  const [first, second] = ordered(a, b);
  const geometry = linkGeometry(first, second, level);
  const { start, end, controls } = geometry;
  const d = controls
    ? `M ${n(start.x)} ${n(start.y)} C ${n(controls[0].x)} ${n(controls[0].y)}, ${n(controls[1].x)} ${n(controls[1].y)}, ${n(end.x)} ${n(end.y)}`
    : `M ${n(start.x)} ${n(start.y)} L ${n(end.x)} ${n(end.y)}`;
  const stroke = color ?? CONNECTION_COLOR;
  const style = KIND_STYLE[kind];
  // 矢印は向きのある種類だけ。先端は向かう側のアイデアの端
  const directed = (kind === "SEQUENCE" || kind === "DEPENDENCY") && arrow !== null;
  const target = arrow === "A_TO_B" ? b : a;
  const towardsSecond = target.id === second.id;
  const head = directed
    ? towardsSecond
      ? arrowHead(end, controls ? controls[1] : start)
      : arrowHead(start, controls ? controls[0] : end)
    : null;
  const mid = kind === "CONTRAST" ? curveMidpoint(geometry) : null;

  return (
    <g
      data-testid="connection-line"
      data-connection-id={selectable ? id : undefined}
      data-color={stroke}
      data-kind={kind}
      data-selected={selected || undefined}
      data-dimmed={dimmed || undefined}
      className={clsx("transition-opacity duration-200", selectable && "cursor-pointer")}
      opacity={dimmed ? 0.18 : 1}
    >
      {selectable && (
        // 細い線は押しにくいので、見えない太い線で当たり判定を広げる（画面上で 16px）
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
        strokeWidth={selected ? style.width + 1 : style.width}
        strokeDasharray={style.dash}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      {head && <path d={head} fill={stroke} pointerEvents="none" data-testid="connection-arrow" />}
      {mid && (
        <g pointerEvents="none" data-testid="connection-vs">
          <circle cx={mid.x} cy={mid.y} r={10} fill="#ffffff" stroke={stroke} strokeWidth={1.5} />
          <text
            x={mid.x}
            y={mid.y + 3.5}
            textAnchor="middle"
            fontSize={9}
            fontWeight={800}
            fill={stroke}
          >
            vs
          </text>
        </g>
      )}
    </g>
  );
});

/** つながりの中点（選択時のツールバーの位置に使う）。曲線の t=0.5 の点 */
export function connectionMidpoint(a: LaidOutNode, b: LaidOutNode, level: DetailLevel) {
  return curveMidpoint(linkGeometry(...ordered(a, b), level));
}
