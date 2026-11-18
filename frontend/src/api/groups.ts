// ボックス（アイデアをまとめる枠）の作成・変更・削除（manifests/nodes.md §3.5 Boxes）。
// どれも先にキャッシュ（画面）を変え、失敗したら戻す。成功したら履歴（元に戻す・やり直す）に記録する。
import {
  type CreateGroupBody,
  type GroupKind,
  MAX_GROUPS_PER_TREE,
  type NodeGroup,
  type TreeDetailResponse,
  type UpdateGroupBody,
} from "@highdea/shared";
import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";

import { useToast } from "../components/Toast";
import { saveStatus } from "../features/canvas/saveStatusStore";
import { type HistoryStep, recordStep } from "../features/history/historyStore";
import { ApiError, apiFetch, jsonBody } from "./client";
import { queryKeys } from "./queryKeys";

const TEMP_GROUP_PREFIX = "temp-group-";

/** 種類ごとの既定の題名（サーバーと同じ）と、履歴に出す名前 */
const DEFAULT_TITLE: Record<GroupKind, string> = { BOX: "Group", NOTE: "Note", LABEL: "Text" };
export const ITEM_NAME: Record<GroupKind, string> = { BOX: "box", NOTE: "note", LABEL: "text" };
let tempSeq = 0;

/** 保存待ち（一時ID）のボックスか。保存前は動かしたり消したりできない */
export const isTempGroup = (id: string) => id.startsWith(TEMP_GROUP_PREFIX);

/** キャッシュ上のツリーのボックス一覧を書き換える */
export function setGroups(
  queryClient: QueryClient,
  treeId: string,
  change: (groups: NodeGroup[]) => NodeGroup[],
) {
  queryClient.setQueryData<TreeDetailResponse>(queryKeys.tree(treeId), (old) =>
    old ? { ...old, groups: change(old.groups) } : old,
  );
}

async function snapshot(queryClient: QueryClient, treeId: string) {
  await queryClient.cancelQueries({ queryKey: queryKeys.tree(treeId) });
  return { previous: queryClient.getQueryData<TreeDetailResponse>(queryKeys.tree(treeId)) };
}

function rollback(
  queryClient: QueryClient,
  treeId: string,
  ctx: { previous: TreeDetailResponse | undefined } | undefined,
) {
  if (ctx?.previous) queryClient.setQueryData(queryKeys.tree(treeId), ctx.previous);
}

/** ボックスの中身（作り直す・やり直す用の本文） */
export function groupBody(group: NodeGroup): CreateGroupBody {
  return {
    kind: group.kind,
    title: group.title,
    // 付箋の文とボックスのラベル（文字の項目は文を持たない）
    body: group.kind === "LABEL" ? undefined : group.body,
    color: group.color,
    positionX: group.positionX,
    positionY: group.positionY,
    width: group.width,
    height: group.height,
  };
}

/** ボックスを足す */
export function useCreateGroup(treeId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (body: CreateGroupBody) =>
      apiFetch<{ group: NodeGroup }>(`/trees/${treeId}/groups`, {
        method: "POST",
        ...jsonBody(body),
      }),
    onMutate: async (body) => {
      saveStatus.start(treeId);
      const ctx = await snapshot(queryClient, treeId);
      const tempId = `${TEMP_GROUP_PREFIX}${String(++tempSeq)}`;
      setGroups(queryClient, treeId, (list) => [
        ...list,
        {
          id: tempId,
          kind: body.kind ?? "BOX",
          title: body.title ?? DEFAULT_TITLE[body.kind ?? "BOX"],
          body: body.body ?? null,
          color: body.color ?? null,
          ...rect(body),
        },
      ]);
      return { ...ctx, tempId };
    },
    onSuccess: ({ group }, _body, ctx) => {
      setGroups(queryClient, treeId, (list) => list.map((g) => (g.id === ctx.tempId ? group : g)));
      recordStep(treeId, {
        label: `Add ${ITEM_NAME[group.kind]}`,
        undo: [{ kind: "deleteGroup", id: group.id }],
        redo: [{ kind: "createGroup", group }],
      });
    },
    onSettled: () => {
      saveStatus.succeed(treeId);
    },
    onError: (err, _body, ctx) => {
      setGroups(queryClient, treeId, (list) => list.filter((g) => g.id !== ctx?.tempId));
      toast(
        err instanceof ApiError && err.code === "GROUP_LIMIT_REACHED"
          ? `This tree has the most canvas items allowed (${String(MAX_GROUPS_PER_TREE)}).`
          : "Couldn't add it.",
        "error",
      );
    },
  });
}

function rect(body: CreateGroupBody) {
  return {
    positionX: body.positionX,
    positionY: body.positionY,
    width: body.width,
    height: body.height,
  };
}

/** ボックスの題名・色・位置・大きさを変える */
export function useUpdateGroup(treeId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    scope: { id: `group-${treeId}` },
    mutationFn: ({ id, body }: { id: string; body: UpdateGroupBody }) =>
      apiFetch<{ group: NodeGroup }>(`/groups/${id}`, { method: "PATCH", ...jsonBody(body) }),
    onMutate: async ({ id, body }) => {
      saveStatus.start(treeId);
      const ctx = await snapshot(queryClient, treeId);
      const before = ctx.previous?.groups.find((g) => g.id === id);
      setGroups(queryClient, treeId, (list) =>
        list.map((g) => (g.id === id ? { ...g, ...body } : g)),
      );
      let historyStep: HistoryStep | null = null;
      if (before) {
        const undo: UpdateGroupBody = {};
        for (const key of Object.keys(body) as (keyof UpdateGroupBody)[]) {
          Object.assign(undo, { [key]: before[key] });
        }
        const keys = Object.keys(body);
        const name = ITEM_NAME[before.kind];
        historyStep = {
          label:
            keys.includes("title") || keys.includes("body")
              ? `Edit ${name}`
              : keys.includes("color")
                ? `Change ${name} color`
                : keys.includes("width") || keys.includes("height")
                  ? `Resize ${name}`
                  : `Move ${name}`,
          undo: [{ kind: "groupUpdate", id, body: undo }],
          redo: [{ kind: "groupUpdate", id, body }],
        };
      }
      return { ...ctx, historyStep };
    },
    onSuccess: (_data, _vars, ctx) => {
      if (ctx.historyStep) recordStep(treeId, ctx.historyStep);
    },
    onSettled: () => {
      saveStatus.succeed(treeId);
    },
    onError: (err, _vars, ctx) => {
      if (err instanceof ApiError && err.code === "GROUP_NOT_FOUND") {
        void queryClient.invalidateQueries({ queryKey: queryKeys.tree(treeId) });
        return;
      }
      rollback(queryClient, treeId, ctx);
      toast("Couldn't save the change.", "error");
    },
  });
}

/** ボックスを消す（中のアイデアはそのまま） */
export function useDeleteGroup(treeId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/groups/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      saveStatus.start(treeId);
      const ctx = await snapshot(queryClient, treeId);
      const before = ctx.previous?.groups.find((g) => g.id === id);
      setGroups(queryClient, treeId, (list) => list.filter((g) => g.id !== id));
      const historyStep: HistoryStep | null = before
        ? {
            label: `Delete ${ITEM_NAME[before.kind]}`,
            undo: [{ kind: "createGroup", group: before }],
            redo: [{ kind: "deleteGroup", id }],
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
      if (err instanceof ApiError && err.code === "GROUP_NOT_FOUND") return;
      rollback(queryClient, treeId, ctx);
      toast("Couldn't delete it.", "error");
    },
  });
}
