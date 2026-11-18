import type { NodeConnection, NodeGroup, NodeSkeleton, TreeCanvasStyle } from "@highdea/shared";
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

import { readableTextColor } from "../categories/CategoryChip";
import { CANVAS_DEFAULTS } from "./canvasTheme";
import { ConnectionLine, connectionMidpoint } from "./ConnectionLine";
import { GridBackground } from "./GridBackground";
import { CanvasItem, GroupBox } from "./GroupBox";
import { cardSize, type LaidOutNode, layoutTree } from "./layout";
import { MiniMap } from "./MiniMap";
import { NodeCard } from "./NodeCard";
import { NodeCounter } from "./NodeCounter";
import { curveMidpoint, linkGeometry, NodeLink } from "./NodeLink";
import { useAutoCardSizes } from "./useAutoCardSizes";
import { useLoadNodeDetails } from "./useNodeDetails";
import { useVisibleNodes } from "./useVisibleNodes";
import { useZoom } from "./useZoom";
import { type DetailLevel, fitTransform, type ViewTransform, visibleWorldRect } from "./viewport";
import { ZoomControls } from "./ZoomControls";

/** エディタがキャンバスを操作するための API */
export type CanvasApi = {
  transform: ViewTransform;
  /** 画面（clientX/Y）座標をワールド座標へ */
  screenToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  centerOn: (point: { x: number; y: number }) => void;
  /** 画面ピクセル単位でパンする（ドラッグ中の端での自動スクロール用） */
  panBy: (dx: number, dy: number) => void;
  /** ツリー全体が収まるように表示する（Tidy up のあと） */
  fit: () => void;
};

type TreeCanvasProps = {
  treeId: string;
  nodes: NodeSkeleton[];
  /** アイデア同士のつながり（枝とは別の点線） */
  connections?: NodeConnection[];
  selectedId?: string | null;
  /** ノードのクリック・タップ（背景なら null）。additive は Shift / ⌘ / Ctrl を押していたか（ボックス用の複数選び） */
  onNodeSelect?: (id: string | null, additive?: boolean) => void;
  /** ダブルクリック・ダブルタップ */
  onNodeOpen?: (id: string) => void;
  /** ノード上で押し始めたとき（エディタのドラッグ開始用） */
  onNodePointerDown?: (id: string, event: PointerEvent<SVGSVGElement>) => void;
  /** ドラッグ中などで一時的に位置を上書きする（ワールド座標） */
  positionOverrides?: ReadonlyMap<string, { x: number; y: number }>;
  /** 大きさを変えている間、一時的にカードの大きさを上書きする（ワールド座標） */
  sizeOverrides?: ReadonlyMap<string, { width: number; height: number }>;
  /** 方眼・背景の見た目（ツリーの設定） */
  canvas?: TreeCanvasStyle;
  /** 右下のズーム操作の上に足すボタン（エディタの「Canvas」） */
  extraControls?: ReactNode;
  /** ノードの上で押し始めたドラッグでパンしない（エディタ用） */
  blockPanOnNodes?: boolean;
  /** 選択中のノードの上に重ねて表示するもの（エディタのツールバー）。rect は画面座標 */
  renderSelectedOverlay?: (
    node: LaidOutNode,
    rect: { x: number; y: number; width: number; height: number },
    level: DetailLevel,
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
  /** ボックス（アイデアをまとめる枠: manifests/nodes.md §3.5 Boxes） */
  groups?: NodeGroup[];
  /** 動かしている・大きさを変えているボックスの一時的な位置と大きさ */
  groupOverrides?: ReadonlyMap<string, Partial<NodeGroup>>;
  selectedGroupId?: string | null;
  /** ボックスの見出しを押したとき。渡したときだけ見出しを押せる（エディタ用） */
  onGroupSelect?: (id: string) => void;
  /** ボックスの見出しで押し始めたとき（中身ごと動かすドラッグの開始） */
  onGroupPointerDown?: (id: string, event: PointerEvent<SVGSVGElement>) => void;
  /** 選択中のボックスの上に重ねるもの（ツールバー・大きさのつまみ）。rect は画面座標 */
  renderGroupOverlay?: (
    group: NodeGroup,
    rect: { x: number; y: number; width: number; height: number },
  ) => ReactNode;
  /** ボックスにまとめるために選んでいるアイデア（Shift+クリック） */
  pickedIds?: ReadonlySet<string>;
  /** 選択中の枝の線（線が入る子ノードのID。エディタ） */
  selectedBranchId?: string | null;
  /** 枝の線を押したとき（子ノードのID）。渡したときだけ線を押せるようにする（エディタ用） */
  onBranchSelect?: (nodeId: string) => void;
  /** 選択中の枝の線の中点に重ねて表示するもの（色の変更）。point は画面座標 */
  renderBranchOverlay?: (node: LaidOutNode, point: { x: number; y: number }) => ReactNode;
};

const NO_CONNECTIONS: NodeConnection[] = [];
const NO_GROUPS: NodeGroup[] = [];

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
  sizeOverrides,
  canvas,
  extraControls,
  blockPanOnNodes = false,
  renderSelectedOverlay,
  showCounter = false,
  highlightId = null,
  liftedIds,
  apiRef,
  selectedConnectionId = null,
  onConnectionSelect,
  renderConnectionOverlay,
  selectedBranchId = null,
  onBranchSelect,
  renderBranchOverlay,
  groups = NO_GROUPS,
  groupOverrides,
  selectedGroupId = null,
  onGroupSelect,
  onGroupPointerDown,
  renderGroupOverlay,
  pickedIds,
}: TreeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { transform, setView, centerOn, zoomIn, zoomOut } = useZoom(svgRef, { blockPanOnNodes });

  // 大きさが未設定のカードは中身に合わせる（詳細が届くたびに計算し直す）
  const autoSizes = useAutoCardSizes(treeId, nodes);
  const baseLayout = useMemo(() => layoutTree(nodes, autoSizes), [nodes, autoSizes]);
  // ドラッグ中・大きさの変更中の位置と大きさを反映した配置（線も一緒に動く）
  const layout = useMemo(() => {
    const hasMoves = positionOverrides !== undefined && positionOverrides.size > 0;
    const hasSizes = sizeOverrides !== undefined && sizeOverrides.size > 0;
    if (!hasMoves && !hasSizes) return baseLayout;
    const moved = baseLayout.nodes.map((n) => {
      const p = positionOverrides?.get(n.id);
      const s = sizeOverrides?.get(n.id);
      if (!p && !s) return n;
      return { ...n, ...(p && { x: p.x, y: p.y }), ...(s && { width: s.width, height: s.height }) };
    });
    const byId = new Map(moved.map((n) => [n.id, n]));
    const links = baseLayout.links.flatMap((l) => {
      const source = byId.get(l.source.id);
      const target = byId.get(l.target.id);
      return source && target ? [{ id: l.id, source, target }] : [];
    });
    return { ...baseLayout, nodes: moved, byId, links };
  }, [baseLayout, positionOverrides, sizeOverrides]);

  const { visible, visibleIds, level } = useVisibleNodes(layout.nodes, transform, size);
  // ボックス（一時的な位置・大きさを反映）。大きい順に描いて、中に入れたボックスが上に来るようにする
  const laidOutGroups = useMemo(
    () =>
      groups
        .map((g) => ({ ...g, ...groupOverrides?.get(g.id) }))
        .sort((a, b) => b.width * b.height - a.width * a.height),
    [groups, groupOverrides],
  );
  // 全体を収めるときは、ボックスも含める
  const bounds = useMemo(() => {
    let { minX, minY, maxX, maxY } = layout.bounds;
    for (const g of laidOutGroups) {
      minX = Math.min(minX, g.positionX);
      minY = Math.min(minY, g.positionY);
      maxX = Math.max(maxX, g.positionX + g.width);
      maxY = Math.max(maxY, g.positionY + g.height);
    }
    return { minX, minY, maxX, maxY };
  }, [layout.bounds, laidOutGroups]);
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
        return a && b ? [{ id: c.id, color: c.color, kind: c.kind, arrow: c.arrow, a, b }] : [];
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
    setView(fitTransform(bounds, size.width, size.height));
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
      fit: () => {
        setView(fitTransform(bounds, size.width, size.height));
      },
    }),
    [transform, centerOn, setView, bounds, size],
  );

  const nodeIdOf = (target: EventTarget | null) =>
    target instanceof Element
      ? (target.closest("[data-node-id]")?.getAttribute("data-node-id") ?? null)
      : null;
  const connectionIdOf = (target: EventTarget | null) =>
    target instanceof Element
      ? (target.closest("[data-connection-id]")?.getAttribute("data-connection-id") ?? null)
      : null;
  const groupIdOf = (target: EventTarget | null) =>
    target instanceof Element
      ? (target.closest("[data-group-header]")?.getAttribute("data-group-header") ?? null)
      : null;
  const branchIdOf = (target: EventTarget | null) =>
    target instanceof Element
      ? (target.closest("[data-branch-id]")?.getAttribute("data-branch-id") ?? null)
      : null;

  const lastTap = useRef<{ id: string; at: number } | null>(null);
  function onPointerUp(e: PointerEvent<SVGSVGElement>) {
    // タッチのダブルタップでノードを開く（ブラウザの dblclick はタッチでは安定しないため自前で判定）
    if (e.pointerType !== "touch") return;
    // カードの中のボタン（Show more など）は、ダブルタップで開く対象にしない
    if (e.target instanceof Element && e.target.closest("[data-card-control]")) return;
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

  // 選んだアイデアに直接つながるもの（親・子・つながりの相手）だけを残し、ほかを薄くする（Focus on selection）
  const focus = useMemo(() => {
    if (!selectedId || !layout.byId.has(selectedId)) return null;
    const ids = new Set<string>([selectedId]);
    const node = layout.byId.get(selectedId);
    if (node?.parentId) ids.add(node.parentId);
    for (const n of layout.nodes) if (n.parentId === selectedId) ids.add(n.id);
    for (const c of connections) {
      if (c.nodeAId === selectedId) ids.add(c.nodeBId);
      if (c.nodeBId === selectedId) ids.add(c.nodeAId);
    }
    return ids;
  }, [selectedId, layout, connections]);
  const parents = useMemo(
    () => new Set(layout.nodes.flatMap((n) => (n.parentId ? [n.parentId] : []))),
    [layout.nodes],
  );

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

  const selectedBranch = selectedBranchId
    ? layout.links.find((l) => l.id === selectedBranchId)
    : undefined;
  const branchPoint = selectedBranch
    ? (() => {
        const p = curveMidpoint(linkGeometry(selectedBranch.source, selectedBranch.target, level));
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
          const branchId = onBranchSelect ? branchIdOf(e.target) : null;
          const groupId = onGroupSelect ? groupIdOf(e.target) : null;
          if (connectionId) onConnectionSelect?.(connectionId);
          else if (branchId) onBranchSelect?.(branchId);
          else if (groupId) onGroupSelect?.(groupId);
          else onNodeSelect?.(nodeIdOf(e.target), e.shiftKey || e.metaKey || e.ctrlKey);
        }}
        onDoubleClick={(e) => {
          const id = nodeIdOf(e.target);
          if (id) onNodeOpen?.(id);
        }}
        onPointerDown={(e) => {
          const id = nodeIdOf(e.target);
          if (id) {
            onNodePointerDown?.(id, e);
            return;
          }
          const groupId = onGroupPointerDown ? groupIdOf(e.target) : null;
          if (groupId) onGroupPointerDown?.(groupId, e);
        }}
        onPointerUp={onPointerUp}
      >
        <GridBackground transform={transform} canvas={canvas} />
        <g
          transform={`translate(${String(transform.x)},${String(transform.y)}) scale(${String(transform.k)})`}
        >
          <g>
            {laidOutGroups
              .filter((g) => g.kind === "BOX")
              .map((g) => (
                <GroupBox
                  key={g.id}
                  group={g}
                  preset={canvas?.nodeStyle ?? "MINIMAL"}
                  selected={g.id === selectedGroupId}
                  interactive={Boolean(onGroupSelect)}
                />
              ))}
          </g>
          <g>
            {links.map((l) => (
              <NodeLink
                key={l.id}
                source={l.source}
                target={l.target}
                level={level}
                selected={l.id === selectedBranchId}
                selectable={Boolean(onBranchSelect)}
                dimmed={focus !== null && l.source.id !== selectedId && l.target.id !== selectedId}
              />
            ))}
          </g>
          {/* つながりは枝の上に描く（枝の当たり判定に隠れて押せなくならないように） */}
          <g>
            {visibleConnections.map((c) => (
              <ConnectionLine
                key={c.id}
                id={c.id}
                a={c.a}
                b={c.b}
                color={c.color}
                kind={c.kind}
                arrow={c.arrow}
                level={level}
                selected={c.id === selectedConnectionId}
                selectable={Boolean(onConnectionSelect)}
                dimmed={focus !== null && c.a.id !== selectedId && c.b.id !== selectedId}
              />
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
                preset={canvas?.nodeStyle}
                hasChildren={parents.has(n.id)}
                dimmed={focus !== null && !focus.has(n.id)}
                highlighted={n.id === highlightId || (pickedIds?.has(n.id) ?? false)}
                lifted={liftedIds?.has(n.id) ?? false}
              />
            ))}
          </g>
          {/* 付箋と文字はカードの上に描く（メモとして見えるように） */}
          <g>
            {laidOutGroups
              .filter((g) => g.kind !== "BOX")
              .map((g) => (
                <CanvasItem
                  key={g.id}
                  item={g}
                  selected={g.id === selectedGroupId}
                  interactive={Boolean(onGroupSelect)}
                  labelColor={readableTextColor(
                    canvas?.backgroundColor ?? CANVAS_DEFAULTS.background,
                  )}
                />
              ))}
          </g>
        </g>
      </svg>

      {selected && selectedRect && renderSelectedOverlay?.(selected, selectedRect, level)}
      {selectedConnection &&
        connectionPoint &&
        renderConnectionOverlay?.(selectedConnection.id, connectionPoint)}
      {selectedBranch && branchPoint && renderBranchOverlay?.(selectedBranch.target, branchPoint)}
      {(() => {
        const g = selectedGroupId ? laidOutGroups.find((x) => x.id === selectedGroupId) : undefined;
        if (!g || !renderGroupOverlay) return null;
        return renderGroupOverlay(g, {
          x: g.positionX * transform.k + transform.x,
          y: g.positionY * transform.k + transform.y,
          width: g.width * transform.k,
          height: g.height * transform.k,
        });
      })()}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
        <div className="pointer-events-auto hidden sm:block">
          <MiniMap
            layout={layout}
            viewport={visibleWorldRect(transform, size.width, size.height, 0)}
            onJump={centerOn}
          />
        </div>
        <div className="pointer-events-auto ml-auto flex flex-col items-end gap-2">
          {extraControls}
          {showCounter && <NodeCounter count={nodes.length} />}
          <ZoomControls scale={transform.k} onZoomIn={zoomIn} onZoomOut={zoomOut} onFit={fit} />
        </div>
      </div>
    </div>
  );
}
