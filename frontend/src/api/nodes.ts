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
import { ApiError, apiFetch, jsonBody } from "./client";
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
          updatedAt: new Date().toISOString(),
        },
      ]);
      return { ...ctx, tempId };
    },
    onSuccess: ({ node }, _body, ctx) => {
      const skeleton = cacheNode(queryClient, treeId, node);
      setNodes(queryClient, treeId, (nodes) =>
        nodes.map((n) => (n.id === ctx.tempId ? skeleton : n)),
      );
      invalidateLists(queryClient);
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
              }
            : n,
        ),
      );
      return ctx;
    },
    onSuccess: ({ node }) => {
      const skeleton = cacheNode(queryClient, treeId, node);
      setNodes(queryClient, treeId, (nodes) => nodes.map((n) => (n.id === node.id ? skeleton : n)));
      invalidateLists(queryClient);
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
      setNodes(queryClient, treeId, (nodes) => {
        const removed = branchIds(nodes, id);
        return nodes.filter((n) => !removed.has(n.id));
      });
      return ctx;
    },
    onSuccess: ({ deletedNodeIds }) => {
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
export function useSavePositions(treeId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: (nodes: PositionUpdate[]) =>
      apiFetch<{ nodes: NodePositionResponse[] }>(`/trees/${treeId}/nodes/positions`, {
        method: "PATCH",
        ...jsonBody({ nodes }),
      }),
    onMutate: async (updates) => {
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
      return ctx;
    },
    onSuccess: () => {},
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
