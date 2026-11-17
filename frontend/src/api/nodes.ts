import type {
  CreateNodeBody,
  DeleteNodeResponse,
  NodeDetails,
  NodePositionResponse,
  NodeResponse,
  NodeSkeleton,
  TreeDetailResponse,
  UpdateNodeBody,
} from "@highdea/shared";
import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useToast } from "../components/Toast";
import { saveStatus } from "../features/canvas/saveStatusStore";
import { branchIds } from "../features/canvas/treeOps";
import {
  type GroupRect,
  type HistoryStep,
  labelForUpdate,
  recordStep,
  type RestorableNode,
  toRestorable,
  undoBodyFor,
} from "../features/history/historyStore";
import { ApiError, apiFetch, jsonBody } from "./client";
import { setConnections, sortPair } from "./connections";
import { setGroups } from "./groups";
import { fetchNodeDetails } from "./nodeDetails";
import { queryKeys } from "./queryKeys";

const neverIgnore = () => false;

/** 2,000件の上限は再試行しても変わらないので「retry」を出さない */
const isNodeLimit = (err: unknown) => err instanceof ApiError && err.code === "NODE_LIMIT_REACHED";

/** 一時ID（作成中のノード）。サーバーの ID と衝突しない接頭辞にする */
export const TEMP_ID_PREFIX = "temp-";
let tempSeq = 0;

type Snapshot = { previous: TreeDetailResponse | undefined };

/** キャッシュ上のツリーのノード一覧を書き換える */
function setNodes(
  queryClient: QueryClient,
  treeId: string,
  change: (nodes: NodeSkeleton[]) => NodeSkeleton[],
) {
  queryClient.setQueryData<TreeDetailResponse>(queryKeys.tree(treeId), (old) =>
    old ? { ...old, nodes: change(old.nodes) } : old,
  );
}

/** 失敗したときに元へ戻すため、変更前のツリーを保存する */
async function snapshot(queryClient: QueryClient, treeId: string): Promise<Snapshot> {
  await queryClient.cancelQueries({ queryKey: queryKeys.tree(treeId) });
  return { previous: queryClient.getQueryData<TreeDetailResponse>(queryKeys.tree(treeId)) };
}

function rollback(queryClient: QueryClient, treeId: string, ctx: Snapshot | undefined) {
  if (ctx?.previous) queryClient.setQueryData(queryKeys.tree(treeId), ctx.previous);
}

/** API のノード（骨格＋詳細）を骨格と詳細に分けてキャッシュする */
function cacheNode(queryClient: QueryClient, treeId: string, node: NodeResponse): NodeSkeleton {
  const skeleton: NodeSkeleton = {
    id: node.id,
    parentId: node.parentId,
    type: node.type,
    title: node.title,
    positionX: node.positionX,
    positionY: node.positionY,
    sortOrder: node.sortOrder,
    lineColor: node.lineColor,
    cardColor: node.cardColor,
    shape: node.shape,
    width: node.width,
    height: node.height,
    fontSize: node.fontSize,
    textColor: node.textColor,
    role: node.role,
    updatedAt: node.updatedAt,
  };
  const details: NodeDetails = {
    id: node.id,
    body: node.body,
    url: node.url,
    previewTitle: node.previewTitle,
    previewDescription: node.previewDescription,
    previewImageUrl: node.previewImageUrl,
    imageUrl: node.imageUrl,
    imageUploadId: node.imageUploadId,
    updatedAt: node.updatedAt,
  };
  queryClient.setQueryData(queryKeys.nodeDetails(treeId, node.id), details);
  return skeleton;
}

/** ノード数（マイツリーのカード）や更新日時が変わるので一覧を古い扱いにする */
function invalidateLists(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.all.trees });
  void queryClient.invalidateQueries({ queryKey: queryKeys.all.explore });
  void queryClient.invalidateQueries({ queryKey: queryKeys.all.users });
}

/**
 * 保存に失敗した操作を保存状態に「Couldn't save – retry」として出す。retry で同じ内容をもう一度送る。
 * 描画後（エフェクト）で登録するので、描画中にコールバックを書き換えない。
 * ignore が true を返すエラー（2,000件の上限など、再試行しても変わらないもの）は出さない。
 */
function useReportFailure<V>(
  treeId: string,
  mutation: { isError: boolean; error: unknown; variables: V | undefined; mutate: (v: V) => void },
  message: string,
  ignore: (err: unknown) => boolean = neverIgnore,
): void {
  const { isError, error, variables, mutate } = mutation;
  useEffect(() => {
    if (!isError || variables === undefined || ignore(error)) return;
    saveStatus.fail(treeId, message, () => {
      mutate(variables);
    });
  }, [isError, error, variables, mutate, treeId, message, ignore]);
}

/**
 * ノード追加。仮のIDで先に画面へ出し、保存できたら本物に差し替える（manifests/nodes.md SPA points「Optimistic node edits」）。
 * 2,000件の上限（409 NODE_LIMIT_REACHED）なら仮のノードを消して知らせる。
 */
export function useCreateNode(treeId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: (body: CreateNodeBody) =>
      apiFetch<{ node: NodeResponse }>(`/trees/${treeId}/nodes`, {
        method: "POST",
        ...jsonBody(body),
      }),
    onMutate: async (body) => {
      saveStatus.start(treeId);
      const ctx = await snapshot(queryClient, treeId);
      const tempId = `${TEMP_ID_PREFIX}${String(++tempSeq)}`;
      setNodes(queryClient, treeId, (nodes) => [
        ...nodes,
        {
          id: tempId,
          parentId: body.parentId,
          type: body.type,
          title: body.title,
          positionX: body.positionX ?? 0,
          positionY: body.positionY ?? 0,
          sortOrder: body.sortOrder ?? Number.MAX_SAFE_INTEGER,
          lineColor: body.lineColor ?? null,
          cardColor: body.cardColor ?? null,
          shape: body.shape ?? "ROUNDED",
          width: body.width ?? null,
          height: body.height ?? null,
          fontSize: body.fontSize ?? null,
          textColor: body.textColor ?? null,
          role: body.role ?? null,
          updatedAt: new Date().toISOString(),
        },
      ]);
      return { ...ctx, tempId };
    },
    onSuccess: ({ node }, body, ctx) => {
      const skeleton = cacheNode(queryClient, treeId, node);
      setNodes(queryClient, treeId, (nodes) =>
        nodes.map((n) => (n.id === ctx.tempId ? skeleton : n)),
      );
      invalidateLists(queryClient);
      // 履歴: 元に戻す = 消す、やり直す = 同じ内容でもう一度作る（manifests/nodes.md §3.5 Undo and redo）
      const restorable: RestorableNode = {
        ...skeleton,
        parentId: body.parentId,
        body: node.body,
        url: node.url,
        imageUploadId: body.type === "IMAGE" ? body.imageUploadId : null,
      };
      recordStep(treeId, {
        label: "Add idea",
        undo: [{ kind: "deleteNode", id: node.id }],
        redo: [{ kind: "createNodes", nodes: [restorable], connections: [] }],
      });
    },
    onSettled: () => {
      saveStatus.succeed(treeId);
    },
    onError: (err, _body, ctx) => {
      setNodes(queryClient, treeId, (nodes) => nodes.filter((n) => n.id !== ctx?.tempId));
      if (err instanceof ApiError && err.code === "NODE_LIMIT_REACHED") {
        toast("This tree is full (2,000 ideas).", "error");
        return;
      }
      toast("Couldn't add the idea.", "error");
    },
  });
  useReportFailure(treeId, mutation, "Couldn't add the idea", isNodeLimit);
  return mutation;
}

/** ノードの編集（内容・種類・付け替え）。先に画面を変え、失敗したら戻す */
export function useUpdateNode(treeId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateNodeBody }) =>
      apiFetch<{ node: NodeResponse }>(`/nodes/${id}`, { method: "PATCH", ...jsonBody(body) }),
    onMutate: async ({ id, body }) => {
      saveStatus.start(treeId);
      const ctx = await snapshot(queryClient, treeId);
      const historyStep = updateStep(queryClient, treeId, ctx.previous, id, body);
      setNodes(queryClient, treeId, (nodes) =>
        nodes.map((n) =>
          n.id === id
            ? {
                ...n,
                ...(body.title !== undefined && { title: body.title }),
                ...(body.type !== undefined && { type: body.type }),
                ...(body.parentId !== undefined && { parentId: body.parentId }),
                ...(body.positionX !== undefined && { positionX: body.positionX }),
                ...(body.positionY !== undefined && { positionY: body.positionY }),
                ...(body.lineColor !== undefined && { lineColor: body.lineColor }),
                ...(body.cardColor !== undefined && { cardColor: body.cardColor }),
                ...(body.shape !== undefined && { shape: body.shape }),
                ...(body.width !== undefined && { width: body.width }),
                ...(body.height !== undefined && { height: body.height }),
                ...(body.fontSize !== undefined && { fontSize: body.fontSize }),
                ...(body.textColor !== undefined && { textColor: body.textColor }),
                ...(body.role !== undefined && { role: body.role }),
              }
            : n,
        ),
      );
      const newParentId = body.parentId;
      if (newParentId !== undefined) {
        // 新しい親とのつながりは枝の線と重なるので消える（サーバーも同じ処理をする）
        const [nodeAId, nodeBId] = sortPair(id, newParentId);
        setConnections(queryClient, treeId, (list) =>
          list.filter((c) => c.nodeAId !== nodeAId || c.nodeBId !== nodeBId),
        );
      }
      return { ...ctx, historyStep };
    },
    onSuccess: ({ node }, _vars, ctx) => {
      const skeleton = cacheNode(queryClient, treeId, node);
      setNodes(queryClient, treeId, (nodes) => nodes.map((n) => (n.id === node.id ? skeleton : n)));
      invalidateLists(queryClient);
      if (ctx.historyStep) recordStep(treeId, ctx.historyStep);
    },
    onSettled: () => {
      saveStatus.succeed(treeId);
    },
    onError: (err, _variables, ctx) => {
      rollback(queryClient, treeId, ctx);
      toast(
        err instanceof ApiError && err.code === "INVALID_MOVE"
          ? "An idea can't be moved there."
          : "Couldn't save the idea.",
        "error",
      );
    },
  });
  useReportFailure(treeId, mutation, "Couldn't save the idea");
  return mutation;
}

/** ノード削除。枝ごと先に消し、失敗したら戻す（manifests/nodes.md M-06） */
export function useDeleteNode(treeId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: (id: string) => apiFetch<DeleteNodeResponse>(`/nodes/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      saveStatus.start(treeId);
      const ctx = await snapshot(queryClient, treeId);
      const removed = branchIds(ctx.previous?.nodes ?? [], id);
      setNodes(queryClient, treeId, (nodes) => nodes.filter((n) => !removed.has(n.id)));
      // 消えるアイデアのつながりも一緒に消える（DB の ON DELETE CASCADE と同じ）
      setConnections(queryClient, treeId, (list) =>
        list.filter((c) => !removed.has(c.nodeAId) && !removed.has(c.nodeBId)),
      );
      // 履歴: 元に戻すときに枝ごと作り直せるよう、消す前に中身（メモ・URL・画像）をそろえておく
      const historyStep = await deleteStep(queryClient, treeId, ctx.previous, id, removed);
      return { ...ctx, historyStep };
    },
    onSuccess: ({ deletedNodeIds }, _id, ctx) => {
      if (ctx.historyStep) recordStep(treeId, ctx.historyStep);
      deletedNodeIds.forEach((id) => {
        queryClient.removeQueries({ queryKey: queryKeys.nodeDetails(treeId, id) });
      });
      invalidateLists(queryClient);
    },
    onSettled: () => {
      saveStatus.succeed(treeId);
    },
    onError: (err, _id, ctx) => {
      rollback(queryClient, treeId, ctx);
      toast(
        err instanceof ApiError && err.code === "CANNOT_DELETE_ROOT"
          ? "The center idea can't be deleted."
          : "Couldn't delete the idea.",
        "error",
      );
    },
  });
  useReportFailure(treeId, mutation, "Couldn't delete the idea");
  return mutation;
}

export type PositionUpdate = {
  id: string;
  positionX: number;
  positionY: number;
  sortOrder?: number;
};

/**
 * ドラッグ移動の位置を1回のリクエストでまとめて保存する（ドロップした時だけ）。
 * 失敗したら元の位置に戻し「Couldn't save the move」と知らせる（manifests/nodes.md SPA points）。
 */
/** 位置の一括保存の入力: ノードだけの配列か、ノードとボックス（manifests/nodes.md §3.5 Boxes） */
export type LayoutUpdate = { nodes: PositionUpdate[]; groups?: GroupRect[] };

function asLayout(input: PositionUpdate[] | LayoutUpdate): Required<LayoutUpdate> {
  return Array.isArray(input)
    ? { nodes: input, groups: [] }
    : { nodes: input.nodes, groups: input.groups ?? [] };
}

export function useSavePositions(treeId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: (input: PositionUpdate[] | LayoutUpdate) =>
      apiFetch<{ nodes: NodePositionResponse[] }>(`/trees/${treeId}/nodes/positions`, {
        method: "PATCH",
        ...jsonBody(asLayout(input)),
      }),
    onMutate: async (input) => {
      const { nodes: updates, groups } = asLayout(input);
      saveStatus.start(treeId);
      const ctx = await snapshot(queryClient, treeId);
      const byId = new Map(updates.map((u) => [u.id, u]));
      setNodes(queryClient, treeId, (nodes) =>
        nodes.map((n) => {
          const u = byId.get(n.id);
          return u
            ? {
                ...n,
                positionX: u.positionX,
                positionY: u.positionY,
                sortOrder: u.sortOrder ?? n.sortOrder,
              }
            : n;
        }),
      );
      const groupById = new Map(groups.map((g) => [g.id, g]));
      if (groups.length > 0) {
        setGroups(queryClient, treeId, (list) =>
          list.map((g) => {
            const u = groupById.get(g.id);
            return u ? { ...g, ...u } : g;
          }),
        );
      }
      // 履歴: 元に戻す = 前の位置（ボックスは前の位置と大きさ）に戻す
      const before = new Map((ctx.previous?.nodes ?? []).map((n) => [n.id, n]));
      const undoItems = updates.flatMap((u) => {
        const prev = before.get(u.id);
        return prev
          ? [
              {
                id: u.id,
                positionX: prev.positionX,
                positionY: prev.positionY,
                sortOrder: prev.sortOrder,
              },
            ]
          : [];
      });
      const groupsBefore = new Map((ctx.previous?.groups ?? []).map((g) => [g.id, g]));
      const undoGroups = groups.flatMap((g) => {
        const prev = groupsBefore.get(g.id);
        return prev
          ? [
              {
                id: g.id,
                positionX: prev.positionX,
                positionY: prev.positionY,
                width: prev.width,
                height: prev.height,
              },
            ]
          : [];
      });
      const historyStep: HistoryStep | null =
        undoItems.length + undoGroups.length > 0
          ? {
              label:
                groups.length > 0 ? "Move box" : updates.length === 1 ? "Move idea" : "Move ideas",
              undo: [{ kind: "positions", items: undoItems, groups: undoGroups }],
              redo: [{ kind: "positions", items: updates, groups }],
            }
          : null;
      return { ...ctx, historyStep };
    },
    onSuccess: (_data, _updates, ctx) => {
      if (ctx.historyStep) recordStep(treeId, ctx.historyStep);
    },
    onSettled: () => {
      saveStatus.succeed(treeId);
    },
    onError: (_err, _updates, ctx) => {
      rollback(queryClient, treeId, ctx);
      toast("Couldn't save the move.", "error");
    },
  });
  useReportFailure(treeId, mutation, "Couldn't save the move");
  return mutation;
}

/**
 * ノードの編集の履歴の1手（元に戻す = 変えた項目を前の値に、やり直す = 同じ編集をもう一度）。
 * 付け替えで新しい親とのつながりが消えるときは、元に戻すときに作り直す。前の値が分からなければ記録しない。
 */
function updateStep(
  queryClient: QueryClient,
  treeId: string,
  previous: TreeDetailResponse | undefined,
  id: string,
  body: UpdateNodeBody,
): HistoryStep | null {
  const before = previous?.nodes.find((n) => n.id === id);
  if (!before) return null;
  const details = queryClient.getQueryData<NodeDetails>(queryKeys.nodeDetails(treeId, id));
  const undoBody = undoBodyFor(before, details, body);
  if (!undoBody) return null;
  const step: HistoryStep = {
    label: labelForUpdate(body),
    undo: [{ kind: "updateNode", id, body: undoBody }],
    redo: [{ kind: "updateNode", id, body }],
  };
  if (body.parentId !== undefined) {
    const [nodeAId, nodeBId] = sortPair(id, body.parentId);
    const lost = previous?.connections.find((c) => c.nodeAId === nodeAId && c.nodeBId === nodeBId);
    if (lost) step.undo.push({ kind: "createConnection", connection: lost });
  }
  return step;
}

/**
 * 枝を消す履歴の1手。元に戻すときに親から順に作り直せるよう、消える全ノードの中身（キャッシュになければ取得）と、
 * 枝に触れるつながりを集める。中身がそろわなければ記録しない（消すこと自体は続ける）。
 */
async function deleteStep(
  queryClient: QueryClient,
  treeId: string,
  previous: TreeDetailResponse | undefined,
  id: string,
  removed: Set<string>,
): Promise<HistoryStep | null> {
  if (!previous) return null;
  const byId = new Map(previous.nodes.map((n) => [n.id, n]));
  const details = new Map<string, NodeDetails>();
  const missing: string[] = [];
  for (const nodeId of removed) {
    const cached = queryClient.getQueryData<NodeDetails>(queryKeys.nodeDetails(treeId, nodeId));
    if (cached) details.set(nodeId, cached);
    else missing.push(nodeId);
  }
  try {
    for (let i = 0; i < missing.length; i += 100) {
      for (const d of await fetchNodeDetails(treeId, missing.slice(i, i + 100))) {
        details.set(d.id, d);
      }
    }
  } catch {
    return null;
  }
  // 親が先に来る順（作り直すときに親の新しい ID が分かっているように）
  const ordered: RestorableNode[] = [];
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    const node = byId.get(current);
    if (!node) continue;
    const restorable = toRestorable(node, details.get(current));
    if (!restorable) return null;
    ordered.push(restorable);
    for (const child of previous.nodes) if (child.parentId === current) queue.push(child.id);
  }
  const connections = previous.connections.filter(
    (c) => removed.has(c.nodeAId) || removed.has(c.nodeBId),
  );
  return {
    label: removed.size > 1 ? "Delete branch" : "Delete idea",
    undo: [{ kind: "createNodes", nodes: ordered, connections }],
    redo: [{ kind: "deleteNode", id }],
  };
}
