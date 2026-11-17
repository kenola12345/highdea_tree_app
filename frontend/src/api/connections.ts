import {
  type CreateConnectionBody,
  MAX_CONNECTIONS_PER_TREE,
  type NodeConnection,
  type TreeDetailResponse,
  type UpdateConnectionBody,
} from "@highdea/shared";
import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";

import { useToast } from "../components/Toast";
import { saveStatus } from "../features/canvas/saveStatusStore";
import { type HistoryStep, recordStep } from "../features/history/historyStore";
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
      setConnections(queryClient, treeId, (list) => [
        ...list,
        {
          id: tempId,
          nodeAId,
          nodeBId,
          color: null,
          kind: body.kind ?? "RELATED",
          // サーバーと同じく、向きのある種類はつなぎ始めたアイデアから相手へ向ける
          arrow:
            body.kind === "SEQUENCE" || body.kind === "DEPENDENCY"
              ? body.nodeAId === nodeAId
                ? "A_TO_B"
                : "B_TO_A"
              : null,
        },
      ]);
      return { ...ctx, tempId };
    },
    onSuccess: ({ connection }, _body, ctx) => {
      setConnections(queryClient, treeId, (list) =>
        list.map((c) => (c.id === ctx.tempId ? connection : c)),
      );
      // 履歴: 元に戻す = つながりを消す、やり直す = もう一度つなぐ
      recordStep(treeId, {
        label: "Connect ideas",
        undo: [{ kind: "deleteConnection", id: connection.id }],
        redo: [{ kind: "createConnection", connection }],
      });
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

/**
 * つながりの色・種類・向きを変える（manifests/nodes.md PATCH /api/connections/:id）。先に線を変え、失敗したら戻す。
 * 同じつながりへの変更は scope で順番に送り、古い色があとから保存されないようにする。
 */
export function useUpdateConnection(treeId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    scope: { id: `connection-color-${treeId}` },
    mutationFn: ({ id, body }: { id: string; body: UpdateConnectionBody }) =>
      apiFetch<{ connection: NodeConnection }>(`/connections/${id}`, {
        method: "PATCH",
        ...jsonBody(body),
      }),
    onMutate: async ({ id, body }) => {
      saveStatus.start(treeId);
      const ctx = await snapshot(queryClient, treeId);
      const before = ctx.previous?.connections.find((c) => c.id === id);
      setConnections(queryClient, treeId, (list) =>
        list.map((c) => (c.id === id ? { ...c, ...body } : c)),
      );
      // 履歴: 元に戻す = 変えた項目を前の値に
      const undoBody: UpdateConnectionBody = {};
      if (before) {
        if (body.color !== undefined) undoBody.color = before.color;
        if (body.kind !== undefined) undoBody.kind = before.kind;
        if (body.arrow !== undefined) undoBody.arrow = before.arrow;
      }
      const historyStep: HistoryStep | null = before
        ? {
            label:
              body.kind !== undefined
                ? "Change relationship type"
                : body.arrow !== undefined
                  ? "Swap direction"
                  : "Change connection color",
            undo: [{ kind: "connectionUpdate", id, body: undoBody }],
            redo: [{ kind: "connectionUpdate", id, body }],
          }
        : null;
      return { ...ctx, historyStep };
    },
    onSuccess: (_data, _vars, ctx) => {
      if (ctx.historyStep) recordStep(treeId, ctx.historyStep);
    },
    onSettled: () => {
      saveStatus.succeed(treeId);
    },
    onError: (err, _vars, ctx) => {
      if (err instanceof ApiError && err.code === "CONNECTION_NOT_FOUND") {
        // ノードと一緒に消えていた。最新の状態を取り直す
        void queryClient.invalidateQueries({ queryKey: queryKeys.tree(treeId) });
        return;
      }
      rollback(queryClient, treeId, ctx);
      toast("Couldn't change the connection.", "error");
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
      const before = ctx.previous?.connections.find((c) => c.id === id);
      setConnections(queryClient, treeId, (list) => list.filter((c) => c.id !== id));
      const historyStep: HistoryStep | null = before
        ? {
            label: "Remove connection",
            undo: [{ kind: "createConnection", connection: before }],
            redo: [{ kind: "deleteConnection", id }],
          }
        : null;
      return { ...ctx, historyStep };
    },
    onSuccess: (_data, _id, ctx) => {
      if (ctx.historyStep) recordStep(treeId, ctx.historyStep);
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
