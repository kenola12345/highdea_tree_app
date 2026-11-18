// P-05 Tree Editor
import {
  BOX_HEIGHT_MIN,
  BOX_WIDTH_MIN,
  GROUP_HEIGHT_MIN,
  GROUP_SIZE_MAX,
  GROUP_WIDTH_MIN,
  type GroupKind,
  MAX_CONNECTIONS_PER_TREE,
  type NodeDetails,
  type NodeGroup,
} from "@highdea/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";

import {
  isTempConnection,
  sortPair,
  useCreateConnection,
  useDeleteConnection,
  useUpdateConnection,
} from "../api/connections";
import { isTempGroup, useCreateGroup, useDeleteGroup, useUpdateGroup } from "../api/groups";
import { fetchNodeDetails } from "../api/nodeDetails";
import {
  TEMP_ID_PREFIX,
  useCreateNode,
  useDeleteNode,
  useSavePositions,
  useUpdateNode,
} from "../api/nodes";
import { queryKeys } from "../api/queryKeys";
import { useTree } from "../api/tree";
import { ErrorState } from "../components/ErrorState";
import { Spinner } from "../components/Spinner";
import { useToast } from "../components/Toast";
import { CanvasButton, CanvasPanel, TidyUpButton } from "../features/canvas/CanvasPanel";
import { CANVAS_DEFAULTS } from "../features/canvas/canvasTheme";
import { CONNECTION_COLOR } from "../features/canvas/ConnectionLine";
import {
  BranchToolbar,
  ConnectBanner,
  ConnectionToolbar,
} from "../features/canvas/ConnectOverlays";
import { canReparent } from "../features/canvas/dropTarget";
import { EditorToolbar } from "../features/canvas/EditorToolbar";
import { contentsOf, NOTE_COLOR, rectAround } from "../features/canvas/GroupBox";
import {
  type AddChoice,
  AddMenu,
  GroupToolbar,
  PlaceBanner,
  PlacementLayer,
} from "../features/canvas/GroupOverlays";
import { cardSize, DEFAULT_LINE_COLOR, layoutTree } from "../features/canvas/layout";
import { NODE_STYLES } from "../features/canvas/nodeStyles";
import { NodeToolbar } from "../features/canvas/NodeToolbar";
import { type ResizeBox, ResizeHandles, type SizeLimits } from "../features/canvas/ResizeHandles";
import { tidyLayout } from "../features/canvas/tidyLayout";
import { type CanvasApi, TreeCanvas } from "../features/canvas/TreeCanvas";
import { countDescendants, newChildPosition } from "../features/canvas/treeOps";
import { useAutoCardSizes } from "../features/canvas/useAutoCardSizes";
import { useEditorKeys } from "../features/canvas/useEditorKeys";
import { useGroupDrag } from "../features/canvas/useGroupDrag";
import { type DropResult, useNodeDrag } from "../features/canvas/useNodeDrag";
import { readableTextColor } from "../features/categories/CategoryChip";
import { HistoryControls } from "../features/history/HistoryControls";
import { runAsOneStep } from "../features/history/historyStore";
import { useHistoryActions } from "../features/history/useHistoryActions";
import { AddBranchModal } from "../features/nodes/AddBranchModal";
import { DeleteNodeModal } from "../features/nodes/DeleteNodeModal";
import { type MediaNode, MediaViewerModal } from "../features/nodes/MediaViewerModal";
import { NodeEditorModal } from "../features/nodes/NodeEditorModal";
import type { NodeType } from "../features/nodes/nodeForm";
import { MoveToTrashModal } from "../features/trees/MoveToTrashModal";
import { TreeSettingsModal } from "../features/trees/TreeSettingsModal";
import { NotFound } from "./NotFoundPage";

/** キャンバスの項目の大きさの範囲（ボックスと、付箋・文字: manifests/nodes.md §3.5 Add menu and canvas items） */
const GROUP_LIMITS: SizeLimits = {
  minWidth: BOX_WIDTH_MIN,
  maxWidth: GROUP_SIZE_MAX,
  minHeight: BOX_HEIGHT_MIN,
  maxHeight: GROUP_SIZE_MAX,
};
const ITEM_LIMITS: SizeLimits = {
  minWidth: GROUP_WIDTH_MIN,
  maxWidth: GROUP_SIZE_MAX,
  minHeight: GROUP_HEIGHT_MIN,
  maxHeight: GROUP_SIZE_MAX,
};
/** クリックで置いたときの大きさ */
const ITEM_SIZE: Record<GroupKind, { width: number; height: number }> = {
  BOX: { width: 360, height: 240 },
  NOTE: { width: 220, height: 160 },
  LABEL: { width: 280, height: 60 },
};

/**
 * ツリーエディタ（P-05）。キャンバス上でノードの追加・編集・移動・付け替え・削除を行う。
 * 所有者以外は閲覧画面へ移す（isOwner で判断: manifests/common.md ルーティング）。
 */
export default function TreeEditorPage() {
  const { id = "" } = useParams();
  const { data, isPending, isError, notFound, refetch } = useTree(id);
  if (notFound) return <NotFound />;
  if (isPending) return <Spinner />;
  if (isError)
    return <ErrorState message="Couldn't load this tree." onRetry={() => void refetch()} />;
  if (!data.isOwner) return <Navigate to={`/trees/${id}`} replace />;
  return <Editor treeId={id} data={data} />;
}

function Editor({
  treeId,
  data,
}: {
  treeId: string;
  data: NonNullable<ReturnType<typeof useTree>["data"]>;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const apiRef = useRef<CanvasApi | null>(null);
  const canvasBoxRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; initialType?: NodeType } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [trashing, setTrashing] = useState(false);
  const [media, setMedia] = useState<MediaNode | null>(null);
  /** つなぐ元のアイデア。設定中は次に押したアイデアとつなぐ（manifests/nodes.md §3.5 Connections） */
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  /** 選択中の枝の線（線が入る子ノードのID）。押すと色を変えられる（manifests/nodes.md §3.5） */
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  /** 大きさを変えている間のカード（キャンバスに一時的に反映する: manifests/nodes.md SPA points） */
  const [resizing, setResizing] = useState<{ id: string; box: ResizeBox } | null>(null);
  const [canvasPanelOpen, setCanvasPanelOpen] = useState(false);
  /** ボックス（manifests/nodes.md §3.5 Boxes）: 選択中のボックス、Shift+クリックで選んだアイデア、大きさを変えている間の枠 */
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  /** 「+ Add」で選んだもの（置く場所を選んでいる間）と、置く場所が決まったアイデア（M-05 で題名を入れる） */
  const [placing, setPlacing] = useState<AddChoice | null>(null);
  const [placedIdea, setPlacedIdea] = useState<{ type: NodeType; x: number; y: number } | null>(
    null,
  );
  const [groupResizing, setGroupResizing] = useState<{
    id: string;
    rect: Partial<NodeGroup>;
  } | null>(null);

  const nodes = data.nodes;
  // キャンバスと同じ大きさ（中身に合わせた大きさ込み）で、ドロップ先の判定や新しい枝の位置を決める
  const autoSizes = useAutoCardSizes(treeId, nodes);
  const layout = useMemo(() => layoutTree(nodes, autoSizes), [nodes, autoSizes]);
  const createNode = useCreateNode(treeId);
  const updateNode = useUpdateNode(treeId);
  const deleteNode = useDeleteNode(treeId);
  const savePositions = useSavePositions(treeId);
  const createConnection = useCreateConnection(treeId);
  const deleteConnection = useDeleteConnection(treeId);
  const updateConnection = useUpdateConnection(treeId);
  const createGroup = useCreateGroup(treeId);
  const updateGroup = useUpdateGroup(treeId);
  const deleteGroup = useDeleteGroup(treeId);
  const cachedDetails = (nodeId: string) =>
    queryClient.getQueryData<NodeDetails>(queryKeys.nodeDetails(treeId, nodeId));

  /** ドロップ: ノードの上なら付け替え、空いている場所なら位置の保存（manifests/nodes.md SPA points） */
  const onDrop = useCallback(
    ({ dragged, moved, target, branch }: DropResult) => {
      if (target && dragged.parentId !== target.id) {
        if (!canReparent(dragged, target, branch)) {
          // 中心のアイデアは他のノードの下へ移せない。リクエストを送らずに元へ戻す（409 INVALID_MOVE と同じ条件）
          toast("The center idea can't be moved under another idea.", "error");
          return;
        }
        const pos = newChildPosition(layout, target.id, branch);
        const dx = pos.x - (layout.byId.get(dragged.id)?.x ?? 0);
        const dy = pos.y - (layout.byId.get(dragged.id)?.y ?? 0);
        // 付け替えと枝の位置の保存は、元に戻すときに1手で戻るようまとめる
        void runAsOneStep(treeId, "Move idea", () =>
          Promise.allSettled([
            updateNode.mutateAsync({
              id: dragged.id,
              body: { parentId: target.id, positionX: pos.x, positionY: pos.y },
            }),
            ...(() => {
              // 枝の子孫も同じだけ動かして、形を保ったまま新しい親の横へ移す
              const rest = [...branch].filter((bid) => bid !== dragged.id);
              if (rest.length === 0) return [];
              return [
                savePositions.mutateAsync(
                  rest.flatMap((bid) => {
                    const n = layout.byId.get(bid);
                    return n
                      ? [
                          {
                            id: bid,
                            positionX: Math.round(n.x + dx),
                            positionY: Math.round(n.y + dy),
                          },
                        ]
                      : [];
                  }),
                ),
              ];
            })(),
          ]),
        );
        return;
      }
      savePositions.mutate(moved.map((m) => ({ id: m.id, positionX: m.x, positionY: m.y })));
    },
    [layout, savePositions, toast, treeId, updateNode],
  );

  // 大きさを変えている間、画面の端でキャンバスを自動スクロールするための参照（ResizeHandles の canvas）
  const resizeCanvas = useMemo(
    () => ({ apiRef, getRect: () => canvasBoxRef.current?.getBoundingClientRect() }),
    [],
  );

  const drag = useNodeDrag({
    nodes,
    layout,
    apiRef,
    getCanvasRect: () => canvasBoxRef.current?.getBoundingClientRect(),
    onDrop,
  });

  /** M-04 を開く。中身をまだ取得していなければ先に取得する（遠いズームでは中身を読み込まないため） */
  const openEditor = useCallback(
    async (nodeId: string, initialType?: NodeType) => {
      if (nodeId.startsWith(TEMP_ID_PREFIX)) return;
      if (!queryClient.getQueryData(queryKeys.nodeDetails(treeId, nodeId))) {
        try {
          const [details] = await fetchNodeDetails(treeId, [nodeId]);
          if (details) queryClient.setQueryData(queryKeys.nodeDetails(treeId, nodeId), details);
        } catch {
          toast("Couldn't load this idea. Try again.", "error");
          return;
        }
      }
      setEditing({ id: nodeId, initialType });
    },
    [queryClient, toast, treeId],
  );

  /** M-10 画像・動画を大きく表示する */
  async function openMedia(nodeId: string) {
    const node = layout.byId.get(nodeId);
    if (!node || (node.type !== "IMAGE" && node.type !== "VIDEO")) return;
    let details = cachedDetails(nodeId);
    if (!details) [details] = await fetchNodeDetails(treeId, [nodeId]).catch(() => []);
    setMedia({
      title: node.title,
      type: node.type,
      imageUrl: details?.imageUrl ?? null,
      url: details?.url ?? null,
    });
  }

  /** M-05 から: 子ノードを作り、そのノードを中央に寄せて M-04 で詳細を入れる */
  function addBranch(
    parentId: string,
    { type, title }: { type: NodeType; title: string },
    at?: { x: number; y: number },
  ) {
    // 「+ Add」でキャンバスに置いたときはその場所、それ以外は親の横の空いている場所
    const pos = at ?? newChildPosition(layout, parentId);
    setAddingTo(null);
    apiRef.current?.centerOn(pos);
    createNode.mutate(
      { type: "TEXT", parentId, title, positionX: pos.x, positionY: pos.y },
      {
        onSuccess: ({ node }) => {
          setSelectedId(node.id);
          void openEditor(node.id, type === "TEXT" ? undefined : type);
        },
      },
    );
  }

  /**
   * つなぐ相手が決まったとき。つなげない組（同じアイデア・親子・つなぎ済み・上限）はリクエストを送らずに知らせる
   * （サーバーの 400 / 409 INVALID_CONNECTION / CONNECTION_LIMIT_REACHED と同じ条件）。
   */
  function connectTo(targetId: string) {
    const fromId = connectingFrom;
    setConnectingFrom(null);
    if (!fromId) return;
    const from = layout.byId.get(fromId);
    const target = layout.byId.get(targetId);
    if (!from || !target) return;
    if (fromId === targetId) {
      toast("Pick a different idea to connect to.", "info");
      return;
    }
    if (from.parentId === targetId || target.parentId === fromId) {
      toast("These ideas are already joined by a branch.", "info");
      return;
    }
    const [nodeAId, nodeBId] = sortPair(fromId, targetId);
    if (data.connections.some((c) => c.nodeAId === nodeAId && c.nodeBId === nodeBId)) {
      toast("These ideas are already connected.", "info");
      return;
    }
    if (data.connections.length >= MAX_CONNECTIONS_PER_TREE) {
      toast(
        `This tree has the most connections allowed (${String(MAX_CONNECTIONS_PER_TREE)}).`,
        "error",
      );
      return;
    }
    if (fromId.startsWith(TEMP_ID_PREFIX) || targetId.startsWith(TEMP_ID_PREFIX)) {
      toast("Wait until the new idea is saved, then connect it.", "info");
      return;
    }
    createConnection.mutate({ nodeAId: fromId, nodeBId: targetId });
    setSelectedId(targetId);
  }

  function removeSelectedConnection() {
    const id = selectedConnectionId;
    if (!id || isTempConnection(id)) return;
    setSelectedConnectionId(null);
    deleteConnection.mutate(id);
  }

  // 大きさの変更中は、そのカードの大きさと中心だけを上書きする（ドラッグ中はドラッグの上書き）
  const resizeSizes = useMemo(
    () =>
      resizing
        ? new Map([[resizing.id, { width: resizing.box.width, height: resizing.box.height }]])
        : undefined,
    [resizing],
  );
  const resizePositions = useMemo(
    () =>
      resizing ? new Map([[resizing.id, { x: resizing.box.x, y: resizing.box.y }]]) : undefined,
    [resizing],
  );

  /** 大きさの変更を離したとき: 大きさ（PATCH /api/nodes/:id）と中心の位置（positions）を保存する */
  function commitResize(nodeId: string, box: ResizeBox) {
    const node = layout.byId.get(nodeId);
    if (!node) return;
    // 大きさと位置は、元に戻すときに1手で戻るようまとめる
    const moved = box.x !== node.x || box.y !== node.y;
    void runAsOneStep(treeId, "Resize idea", () =>
      Promise.allSettled([
        updateNode.mutateAsync({ id: nodeId, body: { width: box.width, height: box.height } }),
        ...(moved
          ? [savePositions.mutateAsync([{ id: nodeId, positionX: box.x, positionY: box.y }])]
          : []),
      ]),
    );
  }

  /**
   * Tidy up: カードの見えている大きさで全体を並べ直し、全部の位置を1回で保存する（1手で元に戻せる）。
   * 保存中のノード（一時 ID）があるときは、ID が確定してから並べ直す。
   */
  // ボックスの見出しのドラッグ: 中のアイデアとボックスを一緒に動かし、離したら1回で保存する（1手で元に戻せる）
  const groupDrag = useGroupDrag({
    apiRef,
    layout,
    groups: data.groups,
    onDrop: ({ nodes: moved, groups: movedGroups }) => {
      void runAsOneStep(treeId, "Move box", () =>
        savePositions.mutateAsync({ nodes: moved, groups: movedGroups }),
      ).catch(() => {});
    },
  });
  const groupOverrides = useMemo(() => {
    const map = new Map<string, Partial<NodeGroup>>(groupDrag.view?.groups ?? []);
    if (groupResizing) map.set(groupResizing.id, groupResizing.rect);
    return map.size > 0 ? map : undefined;
  }, [groupDrag.view, groupResizing]);

  /** 置く場所が決まったとき（画面座標）。アイデアは M-05 を開き、ボックス・付箋・文字はその場で作って選ぶ */
  function place(startClient: { x: number; y: number }, endClient: { x: number; y: number }) {
    const api = apiRef.current;
    const choice = placing;
    setPlacing(null);
    if (!api || !choice) return;
    const a = api.screenToWorld(startClient.x, startClient.y);
    const b = api.screenToWorld(endClient.x, endClient.y);
    if (choice.kind === "idea") {
      setPlacedIdea({ type: choice.type, x: Math.round(a.x), y: Math.round(a.y) });
      return;
    }
    const size = ITEM_SIZE[choice.item];
    const limits = choice.item === "BOX" ? GROUP_LIMITS : ITEM_LIMITS;
    const drawn = choice.item === "BOX" && Math.abs(b.x - a.x) + Math.abs(b.y - a.y) > 30;
    const rect = drawn
      ? {
          positionX: Math.round(Math.min(a.x, b.x)),
          positionY: Math.round(Math.min(a.y, b.y)),
          width: Math.round(Math.max(limits.minWidth, Math.abs(b.x - a.x))),
          height: Math.round(Math.max(limits.minHeight, Math.abs(b.y - a.y))),
        }
      : {
          positionX: Math.round(a.x - size.width / 2),
          positionY: Math.round(a.y - size.height / 2),
          ...size,
        };
    setSelectedId(null);
    createGroup.mutate(
      { kind: choice.item, ...rect },
      {
        onSuccess: ({ group }) => {
          setSelectedGroupId(group.id);
        },
      },
    );
  }

  function tidyUp() {
    if (nodes.some((n) => n.id.startsWith(TEMP_ID_PREFIX))) {
      toast("Wait until the new idea is saved, then tidy up.", "info");
      return;
    }
    const positions = tidyLayout(layout.nodes);
    if (positions.length === 0) return;
    // ボックスは、並べ直す前に中にあったアイデアを、並べ直したあとの位置で囲み直す
    const next = new Map(positions.map((p) => [p.id, p]));
    const refit = data.groups
      .filter((g) => g.kind === "BOX")
      .flatMap((g) => {
        const { nodeIds } = contentsOf(g, layout.nodes, data.groups);
        const rect = rectAround(
          nodeIds.flatMap((id) => {
            const n = layout.byId.get(id);
            if (!n) return [];
            const p = next.get(id) ?? { x: n.x, y: n.y };
            return [{ x: p.x, y: p.y, ...cardSize(n) }];
          }),
        );
        return rect && !isTempGroup(g.id) ? [{ id: g.id, ...rect }] : [];
      });
    void runAsOneStep(treeId, "Tidy up", async () => {
      await savePositions.mutateAsync({
        nodes: positions.map((p) => ({ id: p.id, positionX: p.x, positionY: p.y })),
        groups: refit,
      });
      apiRef.current?.fit();
    }).catch(() => {});
  }

  const selected = selectedId ? layout.byId.get(selectedId) : undefined;
  const connectingNode = connectingFrom ? layout.byId.get(connectingFrom) : undefined;
  const modalOpen = Boolean(addingTo ?? editing ?? deletingId ?? media) || settingsOpen || trashing;

  // 元に戻す / やり直す（manifests/nodes.md §3.5 Undo and redo）。⌘Z・Ctrl+Z / ⇧⌘Z・Ctrl+Shift+Z・Ctrl+Y
  const history = useHistoryActions(treeId);
  const historyKeysRef = useRef({ enabled: true, undo: () => {}, redo: () => {} });
  useEffect(() => {
    historyKeysRef.current = {
      // モーダルが開いている間は、キャンバスの元に戻すのキーを使わない
      enabled: !modalOpen,
      undo: () => void history.undo(),
      redo: () => void history.redo(),
    };
  });
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const k = historyKeysRef.current;
      if (!k.enabled || !(e.metaKey || e.ctrlKey) || e.altKey) return;
      // 文字の入力中は、入力欄そのものの元に戻すを使う
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) k.redo();
        else k.undo();
      } else if (key === "y" && e.ctrlKey) {
        e.preventDefault();
        k.redo();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  // つなぐ相手を選んでいる間・つながりを選んでいる間のキー操作: Esc で取り消し、Delete/Backspace で選んだつながりを消す
  const connectKeysRef = useRef({
    connecting: false,
    connectionSelected: false,
    branchSelected: false,
    groupSelected: false,
    placing: false,
    remove: () => {},
    removeGroup: () => {},
  });
  useEffect(() => {
    connectKeysRef.current = {
      connecting: Boolean(connectingFrom) && !modalOpen,
      connectionSelected: Boolean(selectedConnectionId) && !modalOpen,
      branchSelected: Boolean(selectedBranchId) && !modalOpen,
      groupSelected: Boolean(selectedGroupId) && !modalOpen,
      placing: placing !== null && !modalOpen,
      remove: removeSelectedConnection,
      removeGroup: () => {
        if (selectedGroupId && !isTempGroup(selectedGroupId)) {
          deleteGroup.mutate(selectedGroupId);
          setSelectedGroupId(null);
        }
      },
    };
  });
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const k = connectKeysRef.current;
      const target = e.target as HTMLElement | null;
      // 線のツールバーのカラーピッカーにフォーカスがあっても Esc で選択を外せるようにする
      const inColorPicker = target?.matches("[role=toolbar] input[type=color]") ?? false;
      if (
        !inColorPicker &&
        target?.closest("input, textarea, select, [contenteditable=true], [role=dialog]")
      )
        return;
      if (e.key === "Escape") {
        if (k.connecting) setConnectingFrom(null);
        if (k.connectionSelected) setSelectedConnectionId(null);
        if (k.branchSelected) setSelectedBranchId(null);
        if (k.groupSelected) setSelectedGroupId(null);
        if (k.placing) setPlacing(null);
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        k.groupSelected &&
        !inColorPicker
      ) {
        e.preventDefault();
        k.removeGroup();
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        k.connectionSelected &&
        !inColorPicker
      ) {
        e.preventDefault();
        k.remove();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEditorKeys({
    enabled: Boolean(selected) && !modalOpen && !connectingFrom,
    onAdd: () => {
      if (selected && nodes.length < 2000) setAddingTo(selected.id);
    },
    onDelete: () => {
      if (selected && !selected.isRoot) setDeletingId(selected.id);
    },
    onEdit: () => {
      if (selected) void openEditor(selected.id);
    },
    onDeselect: () => {
      setSelectedId(null);
    },
  });

  /** 線の色を Inherit にしたとき使われる色（親の枝の色、中心のアイデアなら既定の色） */
  function inheritedColorFor(nodeId: string | undefined): string {
    const node = nodeId ? layout.byId.get(nodeId) : undefined;
    const parent = node?.parentId ? layout.byId.get(node.parentId) : undefined;
    return parent?.branchColor ?? DEFAULT_LINE_COLOR;
  }

  const editingNode = editing ? (nodes.find((n) => n.id === editing.id) ?? null) : null;
  const deletingNode = deletingId ? (layout.byId.get(deletingId) ?? null) : null;
  const addingParent = addingTo ? layout.byId.get(addingTo) : undefined;

  return (
    <div className="flex h-[calc(100dvh-4rem)] w-full flex-col">
      <EditorToolbar
        treeId={treeId}
        tree={data.tree}
        onOpenSettings={() => {
          setSettingsOpen(true);
        }}
        historyControls={
          <HistoryControls
            past={history.past}
            future={history.future}
            busy={history.busy}
            onUndo={() => void history.undo()}
            onRedo={() => void history.redo()}
            onJump={(target) => void history.jumpTo(target)}
          />
        }
      />
      <div ref={canvasBoxRef} className="relative min-h-0 flex-1">
        <TreeCanvas
          treeId={treeId}
          nodes={nodes}
          connections={data.connections}
          apiRef={apiRef}
          selectedId={selectedId}
          selectedConnectionId={selectedConnectionId}
          selectedBranchId={selectedBranchId}
          blockPanOnNodes
          showCounter
          positionOverrides={groupDrag.view?.nodes ?? resizePositions ?? drag.view?.overrides}
          sizeOverrides={resizeSizes}
          canvas={data.canvas}
          extraControls={
            <div className="flex items-center gap-2">
              <AddMenu
                onChoose={(choice) => {
                  setSelectedId(null);
                  setSelectedGroupId(null);
                  setConnectingFrom(null);
                  setPlacing(choice);
                }}
              />
              <TidyUpButton onClick={tidyUp} disabled={nodes.length < 2 || history.busy} />
              <CanvasButton
                open={canvasPanelOpen}
                onClick={() => {
                  setCanvasPanelOpen((open) => !open);
                }}
              />
            </div>
          }
          liftedIds={drag.view?.liftedIds}
          highlightId={drag.view?.targetId ?? null}
          onNodePointerDown={drag.onNodePointerDown}
          onNodeSelect={(nodeId) => {
            if (drag.consumeClick()) return;
            if (connectingFrom) {
              // つなぐ相手を選ぶモード: アイデアならつなぎ、背景なら取り消す
              if (nodeId) connectTo(nodeId);
              else setConnectingFrom(null);
              return;
            }
            setSelectedConnectionId(null);
            setSelectedBranchId(null);
            setSelectedGroupId(null);
            setSelectedId(nodeId);
          }}
          groups={data.groups}
          groupOverrides={groupOverrides}
          selectedGroupId={selectedGroupId}
          onGroupSelect={(groupId) => {
            if (drag.consumeClick()) return;
            setConnectingFrom(null);
            setSelectedId(null);
            setSelectedConnectionId(null);
            setSelectedBranchId(null);
            setSelectedGroupId(groupId);
          }}
          onGroupPointerDown={(groupId, e) => {
            if (!isTempGroup(groupId)) groupDrag.onGroupPointerDown(groupId, e);
          }}
          renderGroupOverlay={(group, rect) =>
            groupDrag.isDragging ? null : (
              <>
                <ResizeHandles
                  key={`${group.id}-resize`}
                  box={{
                    x: group.positionX + group.width / 2,
                    y: group.positionY + group.height / 2,
                    width: group.width,
                    height: group.height,
                  }}
                  limits={group.kind === "BOX" ? GROUP_LIMITS : ITEM_LIMITS}
                  rect={rect}
                  canvas={resizeCanvas}
                  onResizing={(box) => {
                    setGroupResizing(
                      box
                        ? {
                            id: group.id,
                            rect: {
                              positionX: box.x - box.width / 2,
                              positionY: box.y - box.height / 2,
                              width: box.width,
                              height: box.height,
                            },
                          }
                        : null,
                    );
                  }}
                  onCommit={(box) => {
                    updateGroup.mutate({
                      id: group.id,
                      body: {
                        positionX: box.x - box.width / 2,
                        positionY: box.y - box.height / 2,
                        width: box.width,
                        height: box.height,
                      },
                    });
                  }}
                />
                {!groupResizing && (
                  <GroupToolbar
                    key={group.id}
                    rect={rect}
                    kind={group.kind}
                    title={group.title}
                    body={group.body}
                    color={group.color}
                    defaultColor={
                      group.kind === "BOX"
                        ? NODE_STYLES[data.canvas.nodeStyle].text
                        : group.kind === "NOTE"
                          ? NOTE_COLOR
                          : readableTextColor(
                              data.canvas.backgroundColor ?? CANVAS_DEFAULTS.background,
                            )
                    }
                    onBodyChange={(body) => {
                      updateGroup.mutate({ id: group.id, body: { body } });
                    }}
                    disabled={isTempGroup(group.id)}
                    onRename={(title) => {
                      updateGroup.mutate({ id: group.id, body: { title } });
                    }}
                    onColorChange={(color) => {
                      updateGroup.mutate({ id: group.id, body: { color } });
                    }}
                    onDelete={() => {
                      setSelectedGroupId(null);
                      deleteGroup.mutate(group.id);
                    }}
                  />
                )}
              </>
            )
          }
          onConnectionSelect={(connectionId) => {
            if (drag.consumeClick()) return;
            setConnectingFrom(null);
            setSelectedId(null);
            setSelectedBranchId(null);
            setSelectedConnectionId(connectionId);
          }}
          renderConnectionOverlay={(connectionId, point) =>
            drag.isDragging ? null : (
              <ConnectionToolbar
                key={connectionId}
                point={point}
                color={data.connections.find((c) => c.id === connectionId)?.color ?? null}
                defaultColor={CONNECTION_COLOR}
                kind={data.connections.find((c) => c.id === connectionId)?.kind ?? "RELATED"}
                arrow={data.connections.find((c) => c.id === connectionId)?.arrow ?? null}
                disabled={isTempConnection(connectionId)}
                onColorChange={(color) => {
                  updateConnection.mutate({ id: connectionId, body: { color } });
                }}
                onKindChange={(kind, arrow) => {
                  updateConnection.mutate({ id: connectionId, body: { kind, arrow } });
                }}
                onSwap={() => {
                  const current = data.connections.find((c) => c.id === connectionId)?.arrow;
                  updateConnection.mutate({
                    id: connectionId,
                    body: { arrow: current === "A_TO_B" ? "B_TO_A" : "A_TO_B" },
                  });
                }}
                onRemove={removeSelectedConnection}
              />
            )
          }
          onBranchSelect={(nodeId) => {
            if (drag.consumeClick()) return;
            if (connectingFrom) {
              // つなぐ相手を選んでいる間に線を押したら、背景と同じく取り消す
              setConnectingFrom(null);
              return;
            }
            setSelectedId(null);
            setSelectedConnectionId(null);
            setSelectedBranchId(nodeId);
          }}
          renderBranchOverlay={(node, point) =>
            drag.isDragging ? null : (
              <BranchToolbar
                key={node.id}
                point={point}
                color={nodes.find((n) => n.id === node.id)?.lineColor ?? null}
                inheritedColor={inheritedColorFor(node.id)}
                lineLabel={nodes.find((n) => n.id === node.id)?.lineLabel ?? null}
                disabled={node.id.startsWith(TEMP_ID_PREFIX)}
                onColorChange={(color) => {
                  updateNode.mutate({ id: node.id, body: { lineColor: color } });
                }}
                onLabelChange={(lineLabel) => {
                  updateNode.mutate({ id: node.id, body: { lineLabel } });
                }}
              />
            )
          }
          onNodeOpen={(nodeId) => void openEditor(nodeId)}
          renderSelectedOverlay={(node, rect, level) =>
            drag.isDragging || connectingFrom ? null : (
              <>
                {/* つまみはカードとして描いている倍率のときだけ（点表示では大きさが分からないため） */}
                {level !== "dot" && !node.id.startsWith(TEMP_ID_PREFIX) && (
                  <ResizeHandles
                    key={node.id}
                    box={{ x: node.x, y: node.y, ...cardSize(node) }}
                    rect={rect}
                    canvas={resizeCanvas}
                    onResizing={(box) => {
                      setResizing(box ? { id: node.id, box } : null);
                    }}
                    onCommit={(box) => {
                      commitResize(node.id, box);
                    }}
                  />
                )}
                {!resizing && (
                  <NodeToolbar
                    treeId={treeId}
                    node={node}
                    rect={rect}
                    nodeCount={nodes.length}
                    onAdd={() => {
                      setAddingTo(node.id);
                    }}
                    onEdit={() => void openEditor(node.id)}
                    onDelete={() => {
                      setDeletingId(node.id);
                    }}
                    onView={() => void openMedia(node.id)}
                    onConnect={() => {
                      setConnectingFrom(node.id);
                    }}
                  />
                )}
              </>
            )
          }
        />
        {canvasPanelOpen && (
          <CanvasPanel
            treeId={treeId}
            canvas={data.canvas}
            onClose={() => {
              setCanvasPanelOpen(false);
            }}
          />
        )}
        {placing && (
          <>
            <PlacementLayer
              allowDraw={placing.kind === "item" && placing.item === "BOX"}
              onPlace={place}
            />
            <PlaceBanner
              text={
                placing.kind === "item" && placing.item === "BOX"
                  ? "Click, or drag to draw the box"
                  : "Click on the canvas to place it"
              }
              onCancel={() => {
                setPlacing(null);
              }}
            />
          </>
        )}
        {connectingNode && (
          <ConnectBanner
            title={connectingNode.title}
            onCancel={() => {
              setConnectingFrom(null);
            }}
          />
        )}
      </div>

      <AddBranchModal
        open={Boolean(addingParent) || placedIdea !== null}
        parentTitle={
          placedIdea
            ? (layout.nodes.find((n) => n.isRoot)?.title ?? "")
            : (addingParent?.title ?? "")
        }
        initialType={placedIdea?.type}
        onClose={() => {
          setAddingTo(null);
          setPlacedIdea(null);
        }}
        onSubmit={(values) => {
          if (placedIdea) {
            const root = layout.nodes.find((n) => n.isRoot);
            setPlacedIdea(null);
            if (root) addBranch(root.id, values, { x: placedIdea.x, y: placedIdea.y });
            return;
          }
          if (addingTo) addBranch(addingTo, values);
        }}
      />
      <NodeEditorModal
        treeId={treeId}
        node={editingNode}
        details={editing ? cachedDetails(editing.id) : undefined}
        initialType={editing?.initialType}
        inheritedLineColor={inheritedColorFor(editing?.id)}
        onClose={() => {
          setEditing(null);
        }}
      />
      <DeleteNodeModal
        node={deletingNode}
        descendantCount={deletingId ? countDescendants(nodes, deletingId) : 0}
        onClose={() => {
          setDeletingId(null);
        }}
        onConfirm={(nodeId) => {
          setSelectedId(null);
          deleteNode.mutate(nodeId);
        }}
      />
      <MediaViewerModal
        node={media}
        onClose={() => {
          setMedia(null);
        }}
      />
      <TreeSettingsModal
        tree={settingsOpen ? data.tree : null}
        onClose={() => {
          setSettingsOpen(false);
        }}
        onMoveToTrash={() => {
          setSettingsOpen(false);
          setTrashing(true);
        }}
      />
      <MoveToTrashModal
        tree={trashing ? data.tree : null}
        onClose={() => {
          setTrashing(false);
        }}
        onDone={() => void navigate("/me")}
      />
    </div>
  );
}
