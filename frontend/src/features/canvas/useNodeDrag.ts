import type { NodeSkeleton } from "@highdea/shared";
import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { TEMP_ID_PREFIX } from "../../api/nodes";
import { findDropTarget } from "./dropTarget";
import type { LaidOutNode, Layout } from "./layout";
import type { CanvasApi } from "./TreeCanvas";
import { branchIds } from "./treeOps";
import { useAutoScroll } from "./useAutoScroll";
import { useLongPress } from "./useLongPress";

/** マウスはこの距離（px）動いたらドラッグ開始。それ未満はクリック扱い */
const MOUSE_DRAG_START = 4;
/** タッチは長押しの前にこの距離動いたら、ノードを掴まずキャンバスのパンにする */
const TOUCH_SLOP = 8;

export type DropResult = {
  dragged: LaidOutNode;
  /** 動かした枝（自分＋子孫）の新しい位置 */
  moved: { id: string; x: number; y: number }[];
  /** ドロップ先のノード（無ければ空いている場所） */
  target: LaidOutNode | null;
  branch: ReadonlySet<string>;
};

type Gesture =
  | {
      kind: "pending";
      id: string;
      pointerId: number;
      pointerType: string;
      startX: number;
      startY: number;
    }
  | { kind: "panning"; pointerId: number; lastX: number; lastY: number }
  | {
      kind: "dragging";
      id: string;
      pointerId: number;
      branch: Set<string>;
      origin: Map<string, { x: number; y: number }>;
      startWorld: { x: number; y: number };
    };

type DragView = {
  overrides: Map<string, { x: number; y: number }>;
  liftedIds: Set<string>;
  targetId: string | null;
};

/**
 * ノード（と枝全体）のドラッグ。マウスは押して動かせば即ドラッグ、タッチは約300msの長押しで持ち上げ、
 * それより前に指が動いたらキャンバスのパンにする（ノードの上から始めたスワイプでも誤って掴まないように: manifests/nodes.md）。
 * ドラッグ中の位置は画面の中だけで更新し、保存はドロップした時に1回だけ onDrop で行う。
 * 2本目の指が触れたら（ピンチ）ドラッグをやめて元に戻す。
 */
export function useNodeDrag({
  nodes,
  layout,
  apiRef,
  getCanvasRect,
  onDrop,
}: {
  nodes: NodeSkeleton[];
  layout: Layout;
  apiRef: RefObject<CanvasApi | null>;
  getCanvasRect: () => DOMRect | undefined;
  onDrop: (result: DropResult) => void;
}) {
  const [view, setView] = useState<DragView | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const longPress = useLongPress();
  const latest = useRef({ nodes, layout, onDrop });

  useEffect(() => {
    latest.current = { nodes, layout, onDrop };
  }, [nodes, layout, onDrop]);

  /** ドラッグ中の見た目（位置の上書きとドロップ先）を、今のポインター位置から計算し直す */
  const recompute = useCallback(() => {
    const g = gesture.current;
    const api = apiRef.current;
    if (g?.kind !== "dragging" || !api || !pointer.current) return;
    const world = api.screenToWorld(pointer.current.x, pointer.current.y);
    const dx = world.x - g.startWorld.x;
    const dy = world.y - g.startWorld.y;
    const overrides = new Map<string, { x: number; y: number }>();
    g.origin.forEach((p, id) => overrides.set(id, { x: p.x + dx, y: p.y + dy }));
    const target = findDropTarget(latest.current.layout.nodes, world, g.branch);
    setView({ overrides, liftedIds: g.branch, targetId: target?.id ?? null });
  }, [apiRef]);

  const beginDrag = useCallback(
    (id: string, pointerId: number) => {
      const api = apiRef.current;
      const { layout: l, nodes: ns } = latest.current;
      if (!api || !pointer.current) return;
      const branch = branchIds(ns, id);
      const origin = new Map<string, { x: number; y: number }>();
      branch.forEach((bid) => {
        const n = l.byId.get(bid);
        if (n) origin.set(bid, { x: n.x, y: n.y });
      });
      gesture.current = {
        kind: "dragging",
        id,
        pointerId,
        branch,
        origin,
        startWorld: api.screenToWorld(pointer.current.x, pointer.current.y),
      };
      recompute();
    },
    [apiRef, recompute],
  );

  const end = useCallback(
    (commit: boolean) => {
      longPress.cancel();
      const g = gesture.current;
      gesture.current = null;
      if (g?.kind === "dragging") {
        suppressClick.current = true;
        const api = apiRef.current;
        const { layout: l } = latest.current;
        const dragged = l.byId.get(g.id);
        if (commit && api && pointer.current && dragged) {
          const world = api.screenToWorld(pointer.current.x, pointer.current.y);
          const dx = world.x - g.startWorld.x;
          const dy = world.y - g.startWorld.y;
          const moved = [...g.origin].map(([id, p]) => ({
            id,
            x: Math.round(p.x + dx),
            y: Math.round(p.y + dy),
          }));
          const target = findDropTarget(l.nodes, world, g.branch);
          // ほとんど動かしていなければ何もしない（不要な保存をしない）
          if (Math.abs(dx) + Math.abs(dy) >= 2 || target)
            latest.current.onDrop({ dragged, moved, target, branch: g.branch });
        }
      }
      if (g?.kind === "panning") suppressClick.current = true;
      setView(null);
      pointer.current = null;
    },
    [apiRef, longPress],
  );

  // ポインターの移動と離しはウィンドウ全体で受ける（指がノードやキャンバスの外へ出ても追えるように）
  useEffect(() => {
    function onMove(e: PointerEvent) {
      const g = gesture.current;
      if (!g || e.pointerId !== g.pointerId) return;
      const prev = pointer.current;
      pointer.current = { x: e.clientX, y: e.clientY };
      if (g.kind === "pending") {
        const dist = Math.hypot(e.clientX - g.startX, e.clientY - g.startY);
        if (g.pointerType === "mouse" && dist >= MOUSE_DRAG_START) beginDrag(g.id, g.pointerId);
        else if (g.pointerType !== "mouse" && dist >= TOUCH_SLOP) {
          // 長押し前に動いた: 掴まずにパンする
          longPress.cancel();
          gesture.current = {
            kind: "panning",
            pointerId: g.pointerId,
            lastX: e.clientX,
            lastY: e.clientY,
          };
          apiRef.current?.panBy(e.clientX - g.startX, e.clientY - g.startY);
        }
      } else if (g.kind === "panning" && prev) {
        apiRef.current?.panBy(e.clientX - g.lastX, e.clientY - g.lastY);
        gesture.current = { ...g, lastX: e.clientX, lastY: e.clientY };
      } else if (g.kind === "dragging") {
        e.preventDefault();
        recompute();
      }
    }
    function onUp(e: PointerEvent) {
      if (gesture.current && e.pointerId === gesture.current.pointerId) end(e.type === "pointerup");
    }
    function onOtherDown(e: PointerEvent) {
      // 2本目の指（ピンチ）が触れたらドラッグ・パンをやめ、d3-zoom にピンチを任せる
      if (gesture.current && e.pointerId !== gesture.current.pointerId) end(false);
    }
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("pointerdown", onOtherDown, true);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("pointerdown", onOtherDown, true);
    };
  }, [apiRef, beginDrag, end, longPress, recompute]);

  useAutoScroll(
    view !== null,
    pointer,
    getCanvasRect,
    (dx, dy) => apiRef.current?.panBy(dx, dy),
    recompute,
  );

  /** TreeCanvas の onNodePointerDown に渡す */
  const onNodePointerDown = useCallback(
    (id: string, e: ReactPointerEvent<SVGSVGElement>) => {
      if (gesture.current) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      // 保存中（仮IDの）ノードはまだ動かせない
      if (id.startsWith(TEMP_ID_PREFIX)) return;
      suppressClick.current = false;
      pointer.current = { x: e.clientX, y: e.clientY };
      gesture.current = {
        kind: "pending",
        id,
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        startX: e.clientX,
        startY: e.clientY,
      };
      if (e.pointerType !== "mouse") {
        longPress.start(() => {
          if (gesture.current?.kind === "pending") beginDrag(id, e.pointerId);
        });
      }
    },
    [beginDrag, longPress],
  );

  /** ドラッグやパンの直後のクリックは選択として扱わない（true を返したらクリックを無視する） */
  const consumeClick = useCallback(() => {
    const value = suppressClick.current;
    suppressClick.current = false;
    return value;
  }, []);

  return { view, onNodePointerDown, consumeClick, isDragging: view !== null };
}
