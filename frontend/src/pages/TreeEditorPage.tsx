// P-05 Tree Editor
import { MAX_CONNECTIONS_PER_TREE, type NodeDetails } from "@highdea/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";

import {
  isTempConnection,
  sortPair,
  useCreateConnection,
  useDeleteConnection,
  useUpdateConnectionColor,
} from "../api/connections";
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
import { CONNECTION_COLOR } from "../features/canvas/ConnectionLine";
import {
  BranchToolbar,
  ConnectBanner,
  ConnectionToolbar,
} from "../features/canvas/ConnectOverlays";
import { canReparent } from "../features/canvas/dropTarget";
import { EditorToolbar } from "../features/canvas/EditorToolbar";
import { DEFAULT_LINE_COLOR, layoutTree } from "../features/canvas/layout";
import { NodeToolbar } from "../features/canvas/NodeToolbar";
import { type CanvasApi, TreeCanvas } from "../features/canvas/TreeCanvas";
import { countDescendants, newChildPosition } from "../features/canvas/treeOps";
import { useEditorKeys } from "../features/canvas/useEditorKeys";
import { type DropResult, useNodeDrag } from "../features/canvas/useNodeDrag";
import { AddBranchModal } from "../features/nodes/AddBranchModal";
import { DeleteNodeModal } from "../features/nodes/DeleteNodeModal";
import { type MediaNode, MediaViewerModal } from "../features/nodes/MediaViewerModal";
import { NodeEditorModal } from "../features/nodes/NodeEditorModal";
import type { NodeType } from "../features/nodes/nodeForm";
import { MoveToTrashModal } from "../features/trees/MoveToTrashModal";
import { TreeSettingsModal } from "../features/trees/TreeSettingsModal";
import { NotFound } from "./NotFoundPage";

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

  const nodes = data.nodes;
  const layout = useMemo(() => layoutTree(nodes), [nodes]);
  const createNode = useCreateNode(treeId);
  const updateNode = useUpdateNode(treeId);
  const deleteNode = useDeleteNode(treeId);
  const savePositions = useSavePositions(treeId);
  const createConnection = useCreateConnection(treeId);
  const deleteConnection = useDeleteConnection(treeId);
  const updateConnectionColor = useUpdateConnectionColor(treeId);
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
        updateNode.mutate({
          id: dragged.id,
          body: { parentId: target.id, positionX: pos.x, positionY: pos.y },
        });
        // 枝の子孫も同じだけ動かして、形を保ったまま新しい親の横へ移す
        const rest = [...branch].filter((bid) => bid !== dragged.id);
        if (rest.length > 0) {
          savePositions.mutate(
            rest.flatMap((bid) => {
              const n = layout.byId.get(bid);
              return n
                ? [{ id: bid, positionX: Math.round(n.x + dx), positionY: Math.round(n.y + dy) }]
                : [];
            }),
          );
        }
        return;
      }
      savePositions.mutate(moved.map((m) => ({ id: m.id, positionX: m.x, positionY: m.y })));
    },
    [layout, savePositions, toast, updateNode],
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
  function addBranch(parentId: string, { type, title }: { type: NodeType; title: string }) {
    const pos = newChildPosition(layout, parentId);
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

  const selected = selectedId ? layout.byId.get(selectedId) : undefined;
  const connectingNode = connectingFrom ? layout.byId.get(connectingFrom) : undefined;
  const modalOpen = Boolean(addingTo ?? editing ?? deletingId ?? media) || settingsOpen || trashing;

  // つなぐ相手を選んでいる間・つながりを選んでいる間のキー操作: Esc で取り消し、Delete/Backspace で選んだつながりを消す
  const connectKeysRef = useRef({
    connecting: false,
    connectionSelected: false,
    branchSelected: false,
    remove: () => {},
  });
  useEffect(() => {
    connectKeysRef.current = {
      connecting: Boolean(connectingFrom) && !modalOpen,
      connectionSelected: Boolean(selectedConnectionId) && !modalOpen,
      branchSelected: Boolean(selectedBranchId) && !modalOpen,
      remove: removeSelectedConnection,
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
    <div className="flex h-[calc(100dvh-3.5rem)] w-full flex-col">
      <EditorToolbar
        treeId={treeId}
        tree={data.tree}
        onOpenSettings={() => {
          setSettingsOpen(true);
        }}
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
          positionOverrides={drag.view?.overrides}
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
            setSelectedId(nodeId);
          }}
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
                disabled={isTempConnection(connectionId)}
                onColorChange={(color) => {
                  updateConnectionColor.mutate({ id: connectionId, body: { color } });
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
                disabled={node.id.startsWith(TEMP_ID_PREFIX)}
                onColorChange={(color) => {
                  updateNode.mutate({ id: node.id, body: { lineColor: color } });
                }}
              />
            )
          }
          onNodeOpen={(nodeId) => void openEditor(nodeId)}
          renderSelectedOverlay={(node, rect) =>
            drag.isDragging || connectingFrom ? null : (
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
            )
          }
        />
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
        open={Boolean(addingParent)}
        parentTitle={addingParent?.title ?? ""}
        onClose={() => {
          setAddingTo(null);
        }}
        onSubmit={(values) => {
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
