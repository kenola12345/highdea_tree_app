import {
  type CreateConnectionBody,
  MAX_CONNECTIONS_PER_TREE,
  type NodeConnection,
  type TreeDetailResponse,
} from "@highdea/shared";
import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";

import { useToast } from "../components/Toast";
import { saveStatus } from "../features/canvas/saveStatusStore";
import { ApiError, apiFetch, jsonBody } from "./client";
import { queryKeys } from "./queryKeys";

/** 作成中のつながりの一時ID */
const TEMP_CONNECTION_PREFIX = "temp-connection-";
let tempSeq = 0;

type Snapshot = { previous: TreeDetailResponse | undefined };

/** キャッシュ上のツリーのつながり一覧を書き換える */
export function setConnections(
  queryClient: QueryClient,
  treeId: string,
  change: (connections: NodeConnection[]) => NodeConnection[],
) {
  queryClient.setQueryData<TreeDetailResponse>(queryKeys.tree(treeId), (old) =>
    old ? { ...old, connections: change(old.connections) } : old,
  );
}

async function snapshot(queryClient: QueryClient, treeId: string): Promise<Snapshot> {
  await queryClient.cancelQueries({ queryKey: queryKeys.tree(treeId) });
  return { previous: queryClient.getQueryData<TreeDetailResponse>(queryKeys.tree(treeId)) };
}

function rollback(queryClient: QueryClient, treeId: string, ctx: Snapshot | undefined) {
  if (ctx?.previous) queryClient.setQueryData(queryKeys.tree(treeId), ctx.previous);
}

/** 保存する順（小さいIDが先）。サーバーと同じ並べ方にして、キャッシュでも同じ組を同じ形で持つ */
export function sortPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** 一時IDのつながり（保存待ち）かどうか。保存前は消せない */
export const isTempConnection = (id: string) => id.startsWith(TEMP_CONNECTION_PREFIX);

/**
 * 2つのアイデアをつなぐ。先に画面に線を出し、失敗したら消して知らせる（manifests/nodes.md SPA points）。
 */
export function useCreateConnection(treeId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (body: CreateConnectionBody) =>
      apiFetch<{ connection: NodeConnection }>(`/trees/${treeId}/connections`, {
        method: "POST",
        ...jsonBody(body),
      }),
    onMutate: async (body) => {
      saveStatus.start(treeId);
      const ctx = await snapshot(queryClient, treeId);
      const tempId = `${TEMP_CONNECTION_PREFIX}${String(++tempSeq)}`;
      const [nodeAId, nodeBId] = sortPair(body.nodeAId, body.nodeBId);
      setConnections(queryClient, treeId, (list) => [...list, { id: tempId, nodeAId, nodeBId }]);
      return { ...ctx, tempId };
    },
    onSuccess: ({ connection }, _body, ctx) => {
      setConnections(queryClient, treeId, (list) =>
        list.map((c) => (c.id === ctx.tempId ? connection : c)),
      );
    },
    onSettled: () => {
      saveStatus.succeed(treeId);
    },
    onError: (err, _body, ctx) => {
      setConnections(queryClient, treeId, (list) => list.filter((c) => c.id !== ctx?.tempId));
      const code = err instanceof ApiError ? err.code : null;
      toast(
        code === "INVALID_CONNECTION"
          ? "These ideas can't be connected."
          : code === "CONNECTION_LIMIT_REACHED"
            ? `This tree has the most connections allowed (${String(MAX_CONNECTIONS_PER_TREE)}).`
            : "Couldn't connect the ideas.",
        "error",
      );
    },
  });
}

/** つながりを消す。先に線を消し、失敗したら戻す */
export function useDeleteConnection(treeId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/connections/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      saveStatus.start(treeId);
      const ctx = await snapshot(queryClient, treeId);
      setConnections(queryClient, treeId, (list) => list.filter((c) => c.id !== id));
      return ctx;
    },
    onSettled: () => {
      saveStatus.succeed(treeId);
    },
    onError: (err, _id, ctx) => {
      // すでに消えている（ノードと一緒に消えた等）なら戻さない
      if (err instanceof ApiError && err.code === "CONNECTION_NOT_FOUND") return;
      rollback(queryClient, treeId, ctx);
      toast("Couldn't remove the connection.", "error");
    },
  });
}
