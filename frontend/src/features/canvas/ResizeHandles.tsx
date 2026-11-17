import { NODE_HEIGHT_MAX, NODE_HEIGHT_MIN, NODE_WIDTH_MAX, NODE_WIDTH_MIN } from "@highdea/shared";
import clsx from "clsx";
import { type PointerEvent, useRef, useState } from "react";

/** 大きさを変えた結果（ワールド座標。x, y はカードの中心） */
export type ResizeBox = { x: number; y: number; width: number; height: number };

type Corner = "nw" | "ne" | "sw" | "se";
/** 角ごとの向き（右・下が +1） */
const DIRECTION: Record<Corner, { sx: 1 | -1; sy: 1 | -1 }> = {
  nw: { sx: -1, sy: -1 },
  ne: { sx: 1, sy: -1 },
  sw: { sx: -1, sy: 1 },
  se: { sx: 1, sy: 1 },
};
const CORNERS: Corner[] = ["nw", "ne", "sw", "se"];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * 角を動かしたあとのカードの大きさと中心（純粋関数）。反対の角は動かさない。
 * keepRatio（Shift）のときは元の縦横比を保つ。大きさは 60–800 × 40–600 の整数に収める（manifests/nodes.md §3.5）。
 */
/** 大きさの範囲（既定はカードの範囲 60–800 × 40–600） */
export type SizeLimits = {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
};
export const CARD_LIMITS: SizeLimits = {
  minWidth: NODE_WIDTH_MIN,
  maxWidth: NODE_WIDTH_MAX,
  minHeight: NODE_HEIGHT_MIN,
  maxHeight: NODE_HEIGHT_MAX,
};

export function resizeBox(
  start: ResizeBox,
  corner: Corner,
  dx: number,
  dy: number,
  keepRatio: boolean,
  limits: SizeLimits = CARD_LIMITS,
): ResizeBox {
  const { sx, sy } = DIRECTION[corner];
  let width = start.width + sx * dx;
  let height = start.height + sy * dy;
  if (keepRatio) {
    const scale = Math.max(width / start.width, height / start.height);
    width = start.width * scale;
    height = start.height * scale;
  }
  width = Math.round(clamp(width, limits.minWidth, limits.maxWidth));
  height = Math.round(clamp(height, limits.minHeight, limits.maxHeight));
  return {
    width,
    height,
    // 反対の角を固定するため、中心は大きさの変化の半分だけ動かした角の側へずれる
    x: Math.round(start.x + (sx * (width - start.width)) / 2),
    y: Math.round(start.y + (sy * (height - start.height)) / 2),
  };
}

type ResizeHandlesProps = {
  /** 大きさを変えるもの（ワールド座標の中心と大きさ）。カードなら cardSize とノードの位置 */
  box: ResizeBox;
  limits?: SizeLimits;
  /** 選択中のカードの画面上の位置と大きさ */
  rect: { x: number; y: number; width: number; height: number };
  /** ドラッグ中の大きさ（キャンバスに一時的に反映する）。null で取り消し */
  onResizing: (box: ResizeBox | null) => void;
  /** 離したとき。大きさか位置が変わっていれば呼ばれる */
  onCommit: (box: ResizeBox) => void;
};

/**
 * 選択中のカードの4隅に出す、大きさを変えるつまみ（manifests/nodes.md Resize handles）。
 * ポインターをつまみに捕まえて追うので、マウス・タッチ・ペンで同じように動く。保存は離したときに1回だけ。
 */
export function ResizeHandles({
  box,
  limits = CARD_LIMITS,
  rect,
  onResizing,
  onCommit,
}: ResizeHandlesProps) {
  const drag = useRef<{
    corner: Corner;
    pointerId: number;
    startX: number;
    startY: number;
    /** 画面 1px あたりのワールド座標 */
    perPixel: number;
    start: ResizeBox;
    last: ResizeBox;
  } | null>(null);
  const [active, setActive] = useState<ResizeBox | null>(null);

  function onPointerDown(corner: Corner, e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const start = { ...box };
    drag.current = {
      corner,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      perPixel: box.width / rect.width,
      start,
      last: start,
    };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const box = resizeBox(
      d.start,
      d.corner,
      (e.clientX - d.startX) * d.perPixel,
      (e.clientY - d.startY) * d.perPixel,
      e.shiftKey,
      limits,
    );
    d.last = box;
    setActive(box);
    onResizing(box);
  }

  function finish(e: PointerEvent<HTMLDivElement>, commit: boolean) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    setActive(null);
    const { start, last } = d;
    const changed =
      last.width !== start.width ||
      last.height !== start.height ||
      last.x !== start.x ||
      last.y !== start.y;
    if (commit && changed) onCommit(last);
    onResizing(null);
  }

  return (
    <>
      {CORNERS.map((corner) => {
        const { sx, sy } = DIRECTION[corner];
        return (
          <div
            key={corner}
            role="presentation"
            data-testid={`resize-handle-${corner}`}
            onPointerDown={(e) => {
              onPointerDown(corner, e);
            }}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => {
              finish(e, true);
            }}
            onPointerCancel={(e) => {
              finish(e, false);
            }}
            // 見えるつまみは 10px。押せる範囲はマウスで 24px、タッチでは 44px に広げる
            className={clsx(
              "absolute z-10 flex size-6 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center pointer-coarse:size-11",
              sx === sy ? "cursor-nwse-resize" : "cursor-nesw-resize",
            )}
            style={{
              left: rect.x + (sx > 0 ? rect.width : 0),
              top: rect.y + (sy > 0 ? rect.height : 0),
            }}
          >
            <span className="border-brand-600 bg-surface size-2.5 rounded-[2px] border-2 shadow-sm" />
          </div>
        );
      })}
      {active && (
        <p
          className="text-surface animate-fade-in pointer-events-none absolute z-10 -translate-x-1/2 rounded-md bg-slate-900/85 px-2 py-0.5 text-xs font-medium tabular-nums"
          style={{ left: rect.x + rect.width / 2, top: rect.y + rect.height + 10 }}
          data-testid="resize-size-label"
        >
          {active.width} × {active.height}
        </p>
      )}
    </>
  );
}
