import type { OwnTreeItem, Pagination, TrashItem } from "@highdea/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useMe } from "../features/auth/useMe";
import { apiFetch } from "./client";
import { invalidateAfterTreeChange } from "./invalidate";
import { queryKeys } from "./queryKeys";

/** ゴミ箱の一覧（削除日の新しい順、完全削除日 purgeAt 付き） */
export function useTrash(page: number) {
  return useQuery({
    queryKey: queryKeys.trash(page),
    queryFn: () =>
      apiFetch<{ trees: TrashItem[]; pagination: Pagination }>(`/trash?page=${String(page)}`),
    placeholderData: keepPreviousData,
  });
}

/** ゴミ箱から復元する。公開状態・カテゴリは削除前のまま戻る */
export function useRestoreTree() {
  const queryClient = useQueryClient();
  const { user } = useMe();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ tree: OwnTreeItem }>(`/trees/${id}/restore`, { method: "POST" }),
    // 失敗（すでに完全削除・復元済み）でも一覧を最新にする
    onSettled: (data) =>
      invalidateAfterTreeChange(queryClient, {
        visibility: data?.tree.visibility,
        ownerUsername: user?.username,
      }),
  });
}

/**
 * ゴミ箱のツリーを完全削除する（取り消し不可）。ゴミ箱のツリーはマイツリー・Explore には出ないが、
 * カテゴリのツリー数などをそろえるため、ほかのツリー変更と同じキャッシュを無効化する。
 */
export function useDeleteTreeForever() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/trash/${id}`, { method: "DELETE" }),
    // 失敗（すでに完全削除・復元済み）でも一覧を最新にする
    onSettled: () => invalidateAfterTreeChange(queryClient, { visibility: "PRIVATE" }),
  });
}

/** ゴミ箱を空にする（自分のゴミ箱のツリーをすべて完全削除、取り消し不可） */
export function useEmptyTrash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ deletedCount: number }>("/trash", { method: "DELETE" }),
    onSettled: () => invalidateAfterTreeChange(queryClient, { visibility: "PRIVATE" }),
  });
}
