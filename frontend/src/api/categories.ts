import type { CategoryResponse, CreateCategoryBody, UpdateCategoryBody } from "@highdea/shared";
import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch, jsonBody } from "./client";
import { queryKeys } from "./queryKeys";

/** 自分のカテゴリ一覧（名前順・ゴミ箱以外のツリー数付き） */
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: async () =>
      (await apiFetch<{ categories: CategoryResponse[] }>("/categories")).categories,
  });
}

/**
 * カテゴリの名前・色・存在が変わったときに古くなるキャッシュをまとめて無効化する。
 * カテゴリのラベルはツリーカード・詳細・Explore にも表示されるため（manifests/common.md §4 Cache invalidation）。
 */
async function invalidateCategoryViews(queryClient: QueryClient): Promise<void> {
  await Promise.all(
    ["categories", "trees", "tree", "trash", "explore", "exploreCategories", "user"].map((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    ),
  );
}

/** カテゴリ作成。作成したカテゴリを返す（ツリーのカテゴリ選択でそのまま選択するため） */
export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateCategoryBody) =>
      (
        await apiFetch<{ category: CategoryResponse }>("/categories", {
          method: "POST",
          ...jsonBody(body),
        })
      ).category,
    onSuccess: () => invalidateCategoryViews(queryClient),
  });
}

/** カテゴリの名前・色の変更 */
export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateCategoryBody }) =>
      (
        await apiFetch<{ category: CategoryResponse }>(`/categories/${id}`, {
          method: "PATCH",
          ...jsonBody(body),
        })
      ).category,
    onSuccess: () => invalidateCategoryViews(queryClient),
  });
}

/** カテゴリ削除。ツリー自体は残り、付いていたラベルだけ外れる */
export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateCategoryViews(queryClient),
  });
}
