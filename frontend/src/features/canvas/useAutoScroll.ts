import { useEffect, useRef } from "react";

/** 画面の端からこの距離（px）に入ったら自動でスクロールする */
const EDGE = 48;
const MAX_SPEED = 14;

/**
 * ドラッグ中、ポインターが画面の端に近づいたらキャンバスをその方向へ動かし続ける。
 * 大きな木の端から端までノードを運べるようにする（manifests/nodes.md「While dragging near the screen edge…」）。
 * onTick はスクロールした後に呼ばれ、ドラッグ中の位置を再計算するのに使う。
 */
export function useAutoScroll(
  active: boolean,
  pointer: { current: { x: number; y: number } | null },
  getRect: () => DOMRect | undefined,
  panBy: (dx: number, dy: number) => void,
  onTick: () => void,
): void {
  const frame = useRef<number | null>(null);
  const callbacks = useRef({ getRect, panBy, onTick });

  useEffect(() => {
    callbacks.current = { getRect, panBy, onTick };
  }, [getRect, panBy, onTick]);

  useEffect(() => {
    if (!active) return;
    function speed(distance: number) {
      return distance < EDGE ? Math.ceil(((EDGE - distance) / EDGE) * MAX_SPEED) : 0;
    }
    function step() {
      const rect = callbacks.current.getRect();
      const p = pointer.current;
      if (rect && p) {
        const dx = speed(p.x - rect.left) - speed(rect.right - p.x);
        const dy = speed(p.y - rect.top) - speed(rect.bottom - p.y);
        if (dx !== 0 || dy !== 0) {
          callbacks.current.panBy(dx, dy);
          callbacks.current.onTick();
        }
      }
      frame.current = requestAnimationFrame(step);
    }
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [active, pointer]);
}
