import type { NodeGroup } from "@highdea/shared";
import { type PointerEvent, type RefObject, useEffect, useRef, useState } from "react";

import type { GroupRect } from "../history/historyStore";
import { contentsOf } from "./GroupBox";
import type { Layout } from "./layout";
import type { CanvasApi } from "./TreeCanvas";

type DragState = {
  id: string;
  pointerId: number;
  startWorld: { x: number; y: number };
  nodes: Map<string, { x: number; y: number }>;
  groups: Map<string, NodeGroup>;
  moved: boolean;
};

export type GroupDropResult = {
  nodes: { id: string; positionX: number; positionY: number }[];
  groups: GroupRect[];
};

/**
 * ボックスの見出しのドラッグ（manifests/nodes.md §3.5 Boxes）。押し始めたときに中にあるアイデアとボックスを決め、
 * 動かしている間はそれらの位置を一時的に上書きし、離したときに1回だけ保存する（onDrop）。
 */
export function useGroupDrag({
  apiRef,
  layout,
  groups,
  onDrop,
}: {
  apiRef: RefObject<CanvasApi | null>;
  layout: Layout;
  groups: NodeGroup[];
  onDrop: (result: GroupDropResult) => void;
}) {
  const drag = useRef<DragState | null>(null);
  const [view, setView] = useState<{
    nodes: Map<string, { x: number; y: number }>;
    groups: Map<string, Partial<NodeGroup>>;
  } | null>(null);
  const latest = useRef({ layout, groups, onDrop });
  useEffect(() => {
    latest.current = { layout, groups, onDrop };
  });

  function onGroupPointerDown(id: string, event: PointerEvent<SVGSVGElement>) {
    const api = apiRef.current;
    const group = latest.current.groups.find((g) => g.id === id);
    if (!api || !group || event.button !== 0) return;
    // ボックスだけが中身（アイデアと中のボックス・付箋・文字）を一緒に動かす。付箋と文字はそれだけ動く
    const { nodeIds, groupIds } =
      group.kind === "BOX"
        ? contentsOf(group, latest.current.layout.nodes, latest.current.groups)
        : { nodeIds: [], groupIds: [] };
    const nodes = new Map<string, { x: number; y: number }>();
    for (const nodeId of nodeIds) {
      const n = latest.current.layout.byId.get(nodeId);
      if (n) nodes.set(nodeId, { x: n.x, y: n.y });
    }
    const moving = new Map<string, NodeGroup>([[id, group]]);
    for (const gid of groupIds) {
      const g = latest.current.groups.find((x) => x.id === gid);
      if (g) moving.set(gid, g);
    }
    drag.current = {
      id,
      pointerId: event.pointerId,
      startWorld: api.screenToWorld(event.clientX, event.clientY),
      nodes,
      groups: moving,
      moved: false,
    };
  }

  // 動かす・離すはウィンドウ全体で受ける（ポインターが見出しの外へ出ても追えるように）
  useEffect(() => {
    function delta(e: globalThis.PointerEvent) {
      const d = drag.current;
      const api = apiRef.current;
      if (!d || !api || e.pointerId !== d.pointerId) return null;
      const world = api.screenToWorld(e.clientX, e.clientY);
      return {
        d,
        dx: Math.round(world.x - d.startWorld.x),
        dy: Math.round(world.y - d.startWorld.y),
      };
    }
    function onMove(e: globalThis.PointerEvent) {
      const r = delta(e);
      if (!r) return;
      if (!r.d.moved && Math.abs(r.dx) + Math.abs(r.dy) < 3) return;
      r.d.moved = true;
      setView({
        nodes: new Map([...r.d.nodes].map(([id, p]) => [id, { x: p.x + r.dx, y: p.y + r.dy }])),
        groups: new Map(
          [...r.d.groups].map(([id, g]) => [
            id,
            { positionX: g.positionX + r.dx, positionY: g.positionY + r.dy },
          ]),
        ),
      });
    }
    function onUp(e: globalThis.PointerEvent) {
      const r = delta(e);
      if (!r) return;
      drag.current = null;
      setView(null);
      if (!r.d.moved) return;
      latest.current.onDrop({
        nodes: [...r.d.nodes].map(([id, p]) => ({
          id,
          positionX: p.x + r.dx,
          positionY: p.y + r.dy,
        })),
        groups: [...r.d.groups].map(([id, g]) => ({
          id,
          positionX: g.positionX + r.dx,
          positionY: g.positionY + r.dy,
        })),
      });
    }
    function onCancel(e: globalThis.PointerEvent) {
      if (drag.current?.pointerId !== e.pointerId) return;
      drag.current = null;
      setView(null);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [apiRef]);

  return { view, onGroupPointerDown, isDragging: view !== null };
}
