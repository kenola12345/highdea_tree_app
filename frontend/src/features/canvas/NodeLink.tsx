import clsx from "clsx";
import { memo } from "react";

import { readableTextColor } from "../categories/CategoryChip";
import { cardSize, type LaidOutNode } from "./layout";
import type { DetailLevel } from "./viewport";

type NodeLinkProps = {
  source: LaidOutNode;
  target: LaidOutNode;
  level: DetailLevel;
  selected?: boolean;
  /** エディタでは押して選べる（太い透明の当たり判定を付ける） */
  selectable?: boolean;
  /** 選択中のアイデアに関係ないので薄くする */
  dimmed?: boolean;
};

type Point = { x: number; y: number };

/**
 * 親から子への線の端点と制御点。向き合う辺（左右に離れていれば左右の辺、上下なら上下の辺）の中央から出入りし、
 * なめらかな S 字の曲線にする（manifests/nodes.md §3.5 Line style）。点表示（遠いズーム）では中心どうしを結ぶ。
 */
export function linkGeometry(source: LaidOutNode, target: LaidOutNode, level: DetailLevel) {
  if (level === "dot") {
    return {
      start: { x: source.x, y: source.y },
      end: { x: target.x, y: target.y },
      controls: null,
    };
  }
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const s = cardSize(source);
  const t = cardSize(target);
  let start: Point;
  let end: Point;
  let c1: Point;
  let c2: Point;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const dir = dx >= 0 ? 1 : -1;
    start = { x: source.x + (dir * s.width) / 2, y: source.y };
    end = { x: target.x - (dir * t.width) / 2, y: target.y };
    const bend = Math.max(40, Math.abs(end.x - start.x) / 2);
    c1 = { x: start.x + dir * bend, y: start.y };
    c2 = { x: end.x - dir * bend, y: end.y };
  } else {
    const dir = dy >= 0 ? 1 : -1;
    start = { x: source.x, y: source.y + (dir * s.height) / 2 };
    end = { x: target.x, y: target.y - (dir * t.height) / 2 };
    const bend = Math.max(30, Math.abs(end.y - start.y) / 2);
    c1 = { x: start.x, y: start.y + dir * bend };
    c2 = { x: end.x, y: end.y - dir * bend };
  }
  return { start, end, controls: [c1, c2] as const };
}

const n = (v: number) => String(Math.round(v * 10) / 10);

/** 曲線（または直線）の中点。選択中の線のツールバーの位置に使う。3次ベジェの t=0.5 の点 */
export function curveMidpoint({ start, end, controls }: ReturnType<typeof linkGeometry>): Point {
  if (!controls) return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const [c1, c2] = controls;
  return {
    x: (start.x + 3 * c1.x + 3 * c2.x + end.x) / 8,
    y: (start.y + 3 * c1.y + 3 * c2.y + end.y) / 8,
  };
}

/** 選択中の線の下に敷く、差し色の黄色の淡い縁取り（線の色はそのまま見せる） */
export function LineHalo({ d }: { d: string }) {
  return (
    <path
      d={d}
      fill="none"
      stroke="#F6C945"
      strokeOpacity={0.55}
      strokeWidth={10}
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
      data-testid="line-halo"
    />
  );
}

/**
 * 親ノードから子ノードへの線。落ち着いた実線の S 字曲線（端点の丸は付けない）。
 * 色は子ノードの枝の色（自分か祖先が設定した色）。エディタでは押して選べ、選ぶと色を変えられる（manifests/nodes.md §3.5）。
 */
export const NodeLink = memo(function NodeLink({
  source,
  target,
  level,
  selected = false,
  selectable = false,
  dimmed = false,
}: NodeLinkProps) {
  const { start, end, controls } = linkGeometry(source, target, level);
  const color = target.branchColor;
  const d = controls
    ? `M ${n(start.x)} ${n(start.y)} C ${n(controls[0].x)} ${n(controls[0].y)}, ${n(controls[1].x)} ${n(controls[1].y)}, ${n(end.x)} ${n(end.y)}`
    : `M ${n(start.x)} ${n(start.y)} L ${n(end.x)} ${n(end.y)}`;
  return (
    <g
      data-testid="node-link"
      data-color={color}
      data-branch-id={selectable ? target.id : undefined}
      data-selected={selected || undefined}
      data-dimmed={dimmed || undefined}
      className={clsx("transition-opacity duration-200", selectable && "cursor-pointer")}
      opacity={dimmed ? 0.2 : 1}
    >
      {selectable && (
        // 細い破線は押しにくいので、見えない太い線で当たり判定を広げる（画面上で 16px）
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
        stroke={color}
        // 枝（親→子）は落ち着いた実線。点線・破線はアイデア同士のつながりの種類に使う（manifests/nodes.md Line style）
        strokeWidth={selected ? 3 : 1.75}
        strokeOpacity={selected ? 1 : 0.85}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      {/* 線のラベル（manifests/nodes.md Line labels）。線の色の札を線の中点に置く。点表示では出さない */}
      {target.lineLabel && level !== "dot" && (
        <LineLabel
          text={target.lineLabel}
          color={color}
          at={curveMidpoint({ start, end, controls })}
          selectable={selectable}
        />
      )}
    </g>
  );
});

/** 線の中点の札。線の色で塗り、文字は読みやすい色。押すと線を選ぶ（親の g の data-branch-id） */
function LineLabel({
  text,
  color,
  at,
  selectable,
}: {
  text: string;
  color: string;
  at: Point;
  selectable: boolean;
}) {
  // 太字 12px のおおよその字幅で札の幅を見積もる
  const width = text.length * 7 + 18;
  return (
    <g data-testid="line-label" pointerEvents={selectable ? "all" : "none"}>
      <rect x={at.x - width / 2} y={at.y - 11} width={width} height={22} rx={11} fill={color} />
      <text
        x={at.x}
        y={at.y + 4}
        textAnchor="middle"
        fontSize={12}
        fontWeight={700}
        fill={readableTextColor(color)}
      >
        {text}
      </text>
    </g>
  );
}
