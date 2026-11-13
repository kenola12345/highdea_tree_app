import type {
  CreateTreeBody,
  CreateTreeResponse,
  OwnTreeItem,
  Pagination,
  TreeSummary,
  UpdateTreeBody,
} from "@highdea/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useMe } from "../features/auth/useMe";
import { apiFetch, jsonBody } from "./client";
import { invalidateAfterTreeChange } from "./invalidate";
import { queryKeys, type TreeListParams } from "./queryKeys";

export type MyTreesResponse = { trees: OwnTreeItem[]; pagination: Pagination };

/** 自分のツリー一覧（ゴミ箱以外・更新日の新しい順）。カテゴリで絞り込める */
export function useMyTrees(params: TreeListParams) {
  return useQuery({
    queryKey: queryKeys.trees(params),
    queryFn: () => {
      const search = new URLSearchParams({ page: String(params.page) });
      if (params.categoryId) search.set("categoryId", params.categoryId);
      return apiFetch<MyTreesResponse>(`/trees?${search.toString()}`);
    },
    // ページ切り替え中も前のページを表示したままにしてチラつきを防ぐ
    placeholderData: keepPreviousData,
  });
}

/** ツリーの作成・変更の後にキャッシュを更新するための関数（所有者のプロフィールも対象にする） */
function useAfterTreeChange() {
  const queryClient = useQueryClient();
  const { user } = useMe();
  return (tree: { visibility?: TreeSummary["visibility"] }) =>
    invalidateAfterTreeChange(queryClient, {
      visibility: tree.visibility,
      ownerUsername: user?.username,
    });
}

/** ツリー作成（中心のアイデアのノードも同時に作られる） */
export function useCreateTree() {
  const after = useAfterTreeChange();
  return useMutation({
    mutationFn: (body: CreateTreeBody) =>
      apiFetch<CreateTreeResponse>("/trees", { method: "POST", ...jsonBody(body) }),
    onSuccess: ({ tree }) => after(tree),
  });
}

/** ツリーの題名・説明・公開状態・カテゴリの変更 */
export function useUpdateTree() {
  const queryClient = useQueryClient();
  const after = useAfterTreeChange();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateTreeBody }) =>
      apiFetch<{ tree: TreeSummary }>(`/trees/${id}`, { method: "PATCH", ...jsonBody(body) }),
    onSuccess: async ({ tree }, { body }) => {
      // 公開→非公開の変更でも Explore から消えるよう、変更前が公開だった可能性も考えて公開側も更新する
      await Promise.all([
        after({ visibility: body.visibility !== undefined ? undefined : tree.visibility }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tree(tree.id) }),
      ]);
    },
  });
}

/** ツリーをゴミ箱へ移動（10日後に完全削除: manifests/trees.md §3.4） */
export function useMoveTreeToTrash() {
  const queryClient = useQueryClient();
  const after = useAfterTreeChange();
  return useMutation({
    mutationFn: (tree: { id: string; visibility: TreeSummary["visibility"] }) =>
      apiFetch<null>(`/trees/${tree.id}`, { method: "DELETE" }),
    onSuccess: async (_data, tree) => {
      queryClient.removeQueries({ queryKey: queryKeys.tree(tree.id) });
      await after(tree);
    },
  });
}
