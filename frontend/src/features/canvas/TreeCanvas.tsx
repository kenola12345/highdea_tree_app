import type { NodeConnection, NodeSkeleton } from "@highdea/shared";
import clsx from "clsx";
import {
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import { ConnectionLine, connectionMidpoint } from "./ConnectionLine";
import { GridBackground } from "./GridBackground";
import { cardSize, type LaidOutNode, layoutTree } from "./layout";
import { MiniMap } from "./MiniMap";
import { NodeCard } from "./NodeCard";
import { NodeCounter } from "./NodeCounter";
import { NodeLink } from "./NodeLink";
import { useLoadNodeDetails } from "./useNodeDetails";
import { useVisibleNodes } from "./useVisibleNodes";
import { useZoom } from "./useZoom";
import { fitTransform, type ViewTransform, visibleWorldRect } from "./viewport";
import { ZoomControls } from "./ZoomControls";

/** エディタがキャンバスを操作するための API */
export type CanvasApi = {
  transform: ViewTransform;
  /** 画面（clientX/Y）座標をワールド座標へ */
  screenToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  centerOn: (point: { x: number; y: number }) => void;
  /** 画面ピクセル単位でパンする（ドラッグ中の端での自動スクロール用） */
  panBy: (dx: number, dy: number) => void;
};

type TreeCanvasProps = {
  treeId: string;
  nodes: NodeSkeleton[];
  /** アイデア同士のつながり（枝とは別の点線） */
  connections?: NodeConnection[];
  selectedId?: string | null;
  /** ノードのクリック・タップ（背景なら null） */
  onNodeSelect?: (id: string | null) => void;
  /** ダブルクリック・ダブルタップ */
  onNodeOpen?: (id: string) => void;
  /** ノード上で押し始めたとき（エディタのドラッグ開始用） */
  onNodePointerDown?: (id: string, event: PointerEvent<SVGSVGElement>) => void;
  /** ドラッグ中などで一時的に位置を上書きする（ワールド座標） */
  positionOverrides?: ReadonlyMap<string, { x: number; y: number }>;
  /** ノードの上で押し始めたドラッグでパンしない（エディタ用） */
  blockPanOnNodes?: boolean;
  /** 選択中のノードの上に重ねて表示するもの（エディタのツールバー）。rect は画面座標 */
  renderSelectedOverlay?: (
    node: LaidOutNode,
    rect: { x: number; y: number; width: number; height: number },
  ) => ReactNode;
  showCounter?: boolean;
  /** ドラッグ中のドロップ先として強調するノード */
  highlightId?: string | null;
  /** ドラッグで持ち上げている枝のノード */
  liftedIds?: ReadonlySet<string>;
  apiRef?: RefObject<CanvasApi | null>;
  /** 選択中のつながり（エディタ） */
  selectedConnectionId?: string | null;
  /** つながりの線を押したとき。渡したときだけ線を押せるようにする（エディタ用） */
  onConnectionSelect?: (id: string) => void;
  /** 選択中のつながりの中点に重ねて表示するもの（「Remove connection」）。point は画面座標 */
  renderConnectionOverlay?: (id: string, point: { x: number; y: number }) => ReactNode;
};

const NO_CONNECTIONS: NodeConnection[] = [];

const DOUBLE_TAP_MS = 300;
/** 最初の表示の最小倍率（短い題名が読める倍率） */
const INITIAL_MIN_SCALE = 0.45;

/**
 * ツリーのキャンバス（エディタ P-05 とビューア P-06 で共通）。
 * 骨格から配置を計算し、見えている範囲のノードと線だけを SVG に描く。パン・ズームは d3-zoom、描画は React。
 * ドラッグ等の編集操作は持たず、ポインターイベントを外に渡すだけにして、エディタがこのファイルを変えずに機能を足せるようにする。
 */
export function TreeCanvas({
  treeId,
  nodes,
  connections = NO_CONNECTIONS,
  selectedId = null,
  onNodeSelect,
  onNodeOpen,
  onNodePointerDown,
  positionOverrides,
  blockPanOnNodes = false,
  renderSelectedOverlay,
  showCounter = false,
  highlightId = null,
  liftedIds,
  apiRef,
  selectedConnectionId = null,
  onConnectionSelect,
  renderConnectionOverlay,
}: TreeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { transform, setView, centerOn, zoomIn, zoomOut } = useZoom(svgRef, { blockPanOnNodes });

  const baseLayout = useMemo(() => layoutTree(nodes), [nodes]);
  // ドラッグ中の位置を反映した配置（線も一緒に動く）
  const layout = useMemo(() => {
    if (!positionOverrides || positionOverrides.size === 0) return baseLayout;
    const moved = baseLayout.nodes.map((n) => {
      const p = positionOverrides.get(n.id);
      return p ? { ...n, x: p.x, y: p.y } : n;
    });
    const byId = new Map(moved.map((n) => [n.id, n]));
    const links = baseLayout.links.flatMap((l) => {
      const source = byId.get(l.source.id);
      const target = byId.get(l.target.id);
      return source && target ? [{ id: l.id, source, target }] : [];
    });
    return { ...baseLayout, nodes: moved, byId, links };
  }, [baseLayout, positionOverrides]);

  const { visible, visibleIds, level } = useVisibleNodes(layout.nodes, transform, size);
  const links = useMemo(
    () => layout.links.filter((l) => visibleIds.has(l.source.id) || visibleIds.has(l.target.id)),
    [layout.links, visibleIds],
  );
  // つながりは両端のノードの位置（ドラッグ中の上書き込み）から描く。どちらかの端が見えていれば描く
  const laidOutConnections = useMemo(
    () =>
      connections.flatMap((c) => {
        const a = layout.byId.get(c.nodeAId);
        const b = layout.byId.get(c.nodeBId);
        return a && b ? [{ id: c.id, a, b }] : [];
      }),
    [connections, layout.byId],
  );
  const visibleConnections = useMemo(
    () => laidOutConnections.filter((c) => visibleIds.has(c.a.id) || visibleIds.has(c.b.id)),
    [laidOutConnections, visibleIds],
  );
  // 読める倍率のときだけ、見えているノードの中身を取りに行く
  useLoadNodeDetails(treeId, visible, level === "card");

  // キャンバスの大きさを追従する
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  // 最初に表示するとき（ツリーごとに1回）は全体が収まるようにする。
  // ただし収めると点しか見えないほど小さくなる場合（スマホで大きな木など）は、題名が読める倍率で中心のアイデアを表示する
  const fittedFor = useRef<string | null>(null);
  useEffect(() => {
    if (fittedFor.current === treeId || size.width === 0 || baseLayout.nodes.length === 0) return;
    fittedFor.current = treeId;
    const fit = fitTransform(baseLayout.bounds, size.width, size.height);
    const root = baseLayout.nodes.find((n) => n.isRoot);
    if (fit.k >= INITIAL_MIN_SCALE || !root) {
      setView(fit);
      return;
    }
    const k = INITIAL_MIN_SCALE;
    setView({ k, x: size.width / 2 - root.x * k, y: size.height / 2 - root.y * k });
  }, [treeId, size, baseLayout, setView]);

  function fit() {
    setView(fitTransform(layout.bounds, size.width, size.height));
  }

  useImperativeHandle(
    apiRef,
    () => ({
      transform,
      centerOn,
      screenToWorld: (clientX, clientY) => {
        const rect = svgRef.current?.getBoundingClientRect();
        const left = rect?.left ?? 0;
        const top = rect?.top ?? 0;
        return {
          x: (clientX - left - transform.x) / transform.k,
          y: (clientY - top - transform.y) / transform.k,
        };
      },
      panBy: (dx, dy) => {
        setView({ ...transform, x: transform.x + dx, y: transform.y + dy });
      },
    }),
    [transform, centerOn, setView],
  );

  const nodeIdOf = (target: EventTarget | null) =>
    target instanceof Element
      ? (target.closest("[data-node-id]")?.getAttribute("data-node-id") ?? null)
      : null;
  const connectionIdOf = (target: EventTarget | null) =>
    target instanceof Element
      ? (target.closest("[data-connection-id]")?.getAttribute("data-connection-id") ?? null)
      : null;

  const lastTap = useRef<{ id: string; at: number } | null>(null);
  function onPointerUp(e: PointerEvent<SVGSVGElement>) {
    // タッチのダブルタップでノードを開く（ブラウザの dblclick はタッチでは安定しないため自前で判定）
    if (e.pointerType !== "touch") return;
    const id = nodeIdOf(e.target);
    if (!id) return;
    const now = Date.now();
    if (lastTap.current?.id === id && now - lastTap.current.at < DOUBLE_TAP_MS) {
      lastTap.current = null;
      onNodeOpen?.(id);
    } else {
      lastTap.current = { id, at: now };
    }
  }

  const selected = selectedId ? layout.byId.get(selectedId) : undefined;
  const selectedRect = selected
    ? (() => {
        const { width, height } = cardSize(selected);
        return {
          x: (selected.x - width / 2) * transform.k + transform.x,
          y: (selected.y - height / 2) * transform.k + transform.y,
          width: width * transform.k,
          height: height * transform.k,
        };
      })()
    : null;

  const selectedConnection = selectedConnectionId
    ? laidOutConnections.find((c) => c.id === selectedConnectionId)
    : undefined;
  const connectionPoint = selectedConnection
    ? (() => {
        const p = connectionMidpoint(selectedConnection.a, selectedConnection.b, level);
        return { x: p.x * transform.k + transform.x, y: p.y * transform.k + transform.y };
      })()
    : null;

  // キャンバス上（ツールバーやズームボタンの上も含む）では、ブラウザのページ拡大・スクロールを起こさない
  // （manifests/nodes.md「the browser doesn't scroll or zoom the page while the user works on the canvas」）
  return (
    <div
      ref={containerRef}
      className="bg-canvas relative h-full w-full touch-none overflow-hidden overscroll-none"
      data-testid="tree-canvas"
    >
      <svg
        ref={svgRef}
        className={clsx(
          "absolute inset-0 h-full w-full touch-none select-none",
          "cursor-grab active:cursor-grabbing",
        )}
        onClick={(e: MouseEvent<SVGSVGElement>) => {
          const connectionId = onConnectionSelect ? connectionIdOf(e.target) : null;
          if (connectionId) onConnectionSelect?.(connectionId);
          else onNodeSelect?.(nodeIdOf(e.target));
        }}
        onDoubleClick={(e) => {
          const id = nodeIdOf(e.target);
          if (id) onNodeOpen?.(id);
        }}
        onPointerDown={(e) => {
          const id = nodeIdOf(e.target);
          if (id) onNodePointerDown?.(id, e);
        }}
        onPointerUp={onPointerUp}
      >
        <GridBackground transform={transform} />
        <g
          transform={`translate(${String(transform.x)},${String(transform.y)}) scale(${String(transform.k)})`}
        >
          <g>
            {visibleConnections.map((c) => (
              <ConnectionLine
                key={c.id}
                id={c.id}
                a={c.a}
                b={c.b}
                level={level}
                selected={c.id === selectedConnectionId}
                selectable={Boolean(onConnectionSelect)}
              />
            ))}
          </g>
          <g>
            {links.map((l) => (
              <NodeLink key={l.id} source={l.source} target={l.target} level={level} />
            ))}
          </g>
          <g>
            {visible.map((n) => (
              <NodeCard
                key={n.id}
                treeId={treeId}
                node={n}
                level={level}
                selected={n.id === selectedId}
                highlighted={n.id === highlightId}
                lifted={liftedIds?.has(n.id) ?? false}
              />
            ))}
          </g>
        </g>
      </svg>

      {selected && selectedRect && renderSelectedOverlay?.(selected, selectedRect)}
      {selectedConnection &&
        connectionPoint &&
        renderConnectionOverlay?.(selectedConnection.id, connectionPoint)}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
        <div className="pointer-events-auto hidden sm:block">
          <MiniMap
            layout={layout}
            viewport={visibleWorldRect(transform, size.width, size.height, 0)}
            onJump={centerOn}
          />
        </div>
        <div className="pointer-events-auto ml-auto flex flex-col items-end gap-2">
          {showCounter && <NodeCounter count={nodes.length} />}
          <ZoomControls scale={transform.k} onZoomIn={zoomIn} onZoomOut={zoomOut} onFit={fit} />
        </div>
      </div>
    </div>
  );
}
