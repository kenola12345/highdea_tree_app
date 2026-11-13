import { useId } from "react";

import type { ViewTransform } from "./viewport";

/** 方眼のマス（ワールド座標）。太線は 5 マスごと */
const CELL = 24;
const MAJOR = CELL * 5;
/** これより縮小したら細かい線を出さない（線が詰まりすぎて灰色の面に見えるため） */
const MINOR_FROM = 0.35;

/**
 * ノートのような方眼の背景（manifests/nodes.md §3.5 Line style）。
 * パターンをキャンバスの transform に合わせて動かすので、パン・ズームと一緒に方眼も動く。
 */
export function GridBackground({ transform }: { transform: ViewTransform }) {
  const id = useId().replace(/:/g, "");
  const patternTransform = `translate(${String(transform.x)},${String(transform.y)}) scale(${String(transform.k)})`;
  return (
    <>
      <defs>
        <pattern
          id={`${id}-minor`}
          width={CELL}
          height={CELL}
          patternUnits="userSpaceOnUse"
          patternTransform={patternTransform}
        >
          <path
            d={`M ${String(CELL)} 0 L 0 0 0 ${String(CELL)}`}
            fill="none"
            stroke="#dbe7f7"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </pattern>
        <pattern
          id={`${id}-major`}
          width={MAJOR}
          height={MAJOR}
          patternUnits="userSpaceOnUse"
          patternTransform={patternTransform}
        >
          <path
            d={`M ${String(MAJOR)} 0 L 0 0 0 ${String(MAJOR)}`}
            fill="none"
            stroke="#c3d6f0"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="#fcfdff" />
      {transform.k >= MINOR_FROM && <rect width="100%" height="100%" fill={`url(#${id}-minor)`} />}
      <rect width="100%" height="100%" fill={`url(#${id}-major)`} data-testid="grid-background" />
    </>
  );
}
