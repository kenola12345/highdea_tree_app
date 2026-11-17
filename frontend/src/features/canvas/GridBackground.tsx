import type { TreeCanvasStyle } from "@highdea/shared";
import { useId } from "react";

import { CANVAS_DEFAULTS } from "./canvasTheme";
import type { ViewTransform } from "./viewport";

/** 太線（大きい点）は 5 マスごと。マスの大きさはツリーの設定（gridSpacing、既定 24） */
const MAJOR_EVERY = 5;
/** これより縮小したら細かい線・点を出さない（詰まりすぎて灰色の面に見えるため） */
const MINOR_FROM = 0.35;
/** 細かい線・点の濃さ（太線に対する割合）。既定の色で以前の淡い方眼と同じ見た目になる値 */
const MINOR_STRENGTH = 0.6;

/** キャンバスの見た目の既定値（manifests/nodes.md §3.5 Canvas look）。色の null はテーマの既定の色（canvasTheme.ts） */
export const DEFAULT_CANVAS_STYLE: TreeCanvasStyle = {
  gridStyle: "LINES",
  gridColor: null,
  gridOpacity: 100,
  gridSpacing: 24,
  backgroundColor: null,
  nodeStyle: "MINIMAL",
};

type GridBackgroundProps = { transform: ViewTransform; canvas?: TreeCanvasStyle };

/**
 * キャンバスの背景（manifests/nodes.md §3.5 Canvas look）。方眼の種類（線・点・なし）、色、不透明度、背景色はツリーごとの設定。
 * パターンをキャンバスの transform に合わせて動かすので、パン・ズームと一緒に方眼も動く。
 */
export function GridBackground({ transform, canvas = DEFAULT_CANVAS_STYLE }: GridBackgroundProps) {
  const id = useId().replace(/:/g, "");
  const patternTransform = `translate(${String(transform.x)},${String(transform.y)}) scale(${String(transform.k)})`;
  const color = canvas.gridColor ?? CANVAS_DEFAULTS.grid;
  const opacity = canvas.gridOpacity / 100;
  const background = canvas.backgroundColor ?? CANVAS_DEFAULTS.background;
  const CELL = canvas.gridSpacing;
  const MAJOR = CELL * MAJOR_EVERY;
  // マスが小さいほど、縮小したときに細かい線が詰まりやすいので早めに隠す
  const showMinor = transform.k * (CELL / 24) >= MINOR_FROM;

  return (
    <>
      {canvas.gridStyle === "LINES" && (
        <defs>
          <LinePattern
            id={`${id}-minor`}
            size={CELL}
            transform={patternTransform}
            color={color}
            opacity={opacity * MINOR_STRENGTH}
          />
          <LinePattern
            id={`${id}-major`}
            size={MAJOR}
            transform={patternTransform}
            color={color}
            opacity={opacity}
          />
        </defs>
      )}
      {canvas.gridStyle === "DOTS" && (
        <defs>
          {/* 点は画面上でいつも同じ大きさに見えるよう、半径を倍率で割る */}
          <DotPattern
            id={`${id}-minor`}
            size={CELL}
            radius={1.3 / transform.k}
            transform={patternTransform}
            color={color}
            opacity={opacity * MINOR_STRENGTH}
          />
          <DotPattern
            id={`${id}-major`}
            size={MAJOR}
            radius={2 / transform.k}
            transform={patternTransform}
            color={color}
            opacity={opacity}
          />
        </defs>
      )}
      <rect
        width="100%"
        height="100%"
        fill={background}
        data-testid="grid-background"
        data-grid-style={canvas.gridStyle}
        data-grid-color={color}
        data-grid-opacity={canvas.gridOpacity}
      />
      {canvas.gridStyle !== "NONE" && (
        <>
          {showMinor && <rect width="100%" height="100%" fill={`url(#${id}-minor)`} />}
          <rect width="100%" height="100%" fill={`url(#${id}-major)`} />
        </>
      )}
    </>
  );
}

type PatternProps = {
  id: string;
  size: number;
  transform: string;
  color: string;
  opacity: number;
};

/** 方眼の線（各マスの上辺と左辺） */
function LinePattern({ id, size, transform, color, opacity }: PatternProps) {
  return (
    <pattern
      id={id}
      width={size}
      height={size}
      patternUnits="userSpaceOnUse"
      patternTransform={transform}
    >
      <path
        d={`M ${String(size)} 0 L 0 0 0 ${String(size)}`}
        fill="none"
        stroke={color}
        strokeOpacity={opacity}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    </pattern>
  );
}

/** 方眼の点。マスの中央に置く（角に置くと隣のマスで切れて4分の1しか見えないため） */
function DotPattern({
  id,
  size,
  radius,
  transform,
  color,
  opacity,
}: PatternProps & { radius: number }) {
  return (
    <pattern
      id={id}
      width={size}
      height={size}
      patternUnits="userSpaceOnUse"
      patternTransform={transform}
    >
      <circle cx={size / 2} cy={size / 2} r={radius} fill={color} fillOpacity={opacity} />
    </pattern>
  );
}
