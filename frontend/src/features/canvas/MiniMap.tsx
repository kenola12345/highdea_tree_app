import type { MouseEvent } from "react";

import type { Layout } from "./layout";
import type { WorldRect } from "./viewport";

type MiniMapProps = {
  layout: Layout;
  viewport: WorldRect;
  onJump: (point: { x: number; y: number }) => void;
};

const WIDTH = 160;
const HEIGHT = 110;

/** 木全体の縮小図と、いま見えている範囲の枠。クリックした場所へ移動する（manifests/nodes.md MiniMap） */
export function MiniMap({ layout, viewport, onJump }: MiniMapProps) {
  const { bounds } = layout;
  const pad = 200;
  const minX = bounds.minX - pad;
  const minY = bounds.minY - pad;
  const w = bounds.maxX - bounds.minX + pad * 2;
  const h = bounds.maxY - bounds.minY + pad * 2;
  const scale = Math.min(WIDTH / w, HEIGHT / h);
  const toMap = (x: number, y: number) => ({ x: (x - minX) * scale, y: (y - minY) * scale });

  function onClick(e: MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    onJump({ x: (e.clientX - rect.left) / scale + minX, y: (e.clientY - rect.top) / scale + minY });
  }

  const view = toMap(viewport.minX, viewport.minY);
  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      onClick={onClick}
      role="img"
      aria-label="Mini map. Click to move there."
      data-testid="mini-map"
      className="cursor-pointer rounded-xl border border-slate-200 bg-white/90 shadow-sm"
    >
      {layout.nodes.map((n) => {
        const p = toMap(n.x, n.y);
        return (
          <circle
            key={n.id}
            cx={p.x}
            cy={p.y}
            r={n.isRoot ? 3 : 1.5}
            className={n.isRoot ? "fill-brand-600" : "fill-slate-400"}
          />
        );
      })}
      <rect
        x={view.x}
        y={view.y}
        width={Math.max(4, (viewport.maxX - viewport.minX) * scale)}
        height={Math.max(4, (viewport.maxY - viewport.minY) * scale)}
        className="fill-brand-500/10 stroke-brand-600"
        strokeWidth={1.5}
      />
    </svg>
  );
}
