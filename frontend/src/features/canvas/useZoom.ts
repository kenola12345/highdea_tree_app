import { select } from "d3-selection";
import { zoom, type ZoomBehavior, zoomIdentity } from "d3-zoom";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

import type { ViewTransform } from "./viewport";

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 2.5;
const BUTTON_STEP = 1.25;

type UseZoomOptions = {
  /** true のとき、ノードの上で押し始めたドラッグではパンしない（エディタがノードのドラッグに使うため） */
  blockPanOnNodes?: boolean;
};

/**
 * SVG に d3-zoom を付け、ホイール・ピンチ・背景ドラッグでのパンとズームを扱う。
 * 2本指の操作はノードの上でも常にパン・ズームにする（スマホで canvas を動かせなくならないように: manifests/nodes.md ジェスチャー表）。
 * D3 は transform の計算だけを担い、描画は React が行う。
 */
export function useZoom(
  svgRef: RefObject<SVGSVGElement | null>,
  { blockPanOnNodes = false }: UseZoomOptions = {},
) {
  const [transform, setTransform] = useState<ViewTransform>({ x: 0, y: 0, k: 1 });
  const behaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const blockRef = useRef(blockPanOnNodes);

  useEffect(() => {
    blockRef.current = blockPanOnNodes;
  }, [blockPanOnNodes]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([MIN_SCALE, MAX_SCALE])
      .filter((event: Event) => {
        if (event instanceof WheelEvent) return true;
        if (event instanceof MouseEvent && (event.button !== 0 || event.ctrlKey)) return false;
        if (
          typeof TouchEvent !== "undefined" &&
          event instanceof TouchEvent &&
          event.touches.length > 1
        )
          return true;
        const onNode =
          event.target instanceof Element && event.target.closest("[data-node-id]") !== null;
        return !(blockRef.current && onNode);
      })
      .on("zoom", (event: { transform: ViewTransform }) => {
        const { x, y, k } = event.transform;
        setTransform({ x, y, k });
      });
    const selection = select(svg);
    selection.call(behavior);
    // ダブルクリックはノードを開く操作に使うので、d3 のダブルクリック拡大は無効にする
    selection.on("dblclick.zoom", null);
    behaviorRef.current = behavior;
    return () => {
      selection.on(".zoom", null);
    };
  }, [svgRef]);

  /** transform を直接設定する（d3-zoom の内部状態も合わせる） */
  const setView = useCallback(
    (next: ViewTransform) => {
      const svg = svgRef.current;
      const behavior = behaviorRef.current;
      if (!svg || !behavior) return;
      behavior.transform(select(svg), zoomIdentity.translate(next.x, next.y).scale(next.k));
    },
    [svgRef],
  );

  /** 画面中央を基準に拡大・縮小する */
  const scaleBy = useCallback(
    (factor: number) => {
      const svg = svgRef.current;
      const behavior = behaviorRef.current;
      if (!svg || !behavior) return;
      behavior.scaleBy(select(svg), factor);
    },
    [svgRef],
  );

  /** ワールド座標の点を画面の中央に持ってくる（倍率はそのまま） */
  const centerOn = useCallback(
    (point: { x: number; y: number }) => {
      const svg = svgRef.current;
      if (!svg) return;
      const { width, height } = svg.getBoundingClientRect();
      setView({
        k: transform.k,
        x: width / 2 - point.x * transform.k,
        y: height / 2 - point.y * transform.k,
      });
    },
    [setView, svgRef, transform.k],
  );

  return {
    transform,
    setView,
    centerOn,
    zoomIn: () => {
      scaleBy(BUTTON_STEP);
    },
    zoomOut: () => {
      scaleBy(1 / BUTTON_STEP);
    },
  };
}
