import type { RemovedTreeResponse, RemoveTreeBody } from "@highdea/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiFetch, jsonBody } from "./client";
import { queryKeys } from "./queryKeys";

/**
 * 管理者による公開ツリーの非公開化（POST /api/admin/trees/:id/remove）。
 * 成功するとツリーは非公開になり Explore・所有者のプロフィールから消えるので、それらとツリー自体のキャッシュを更新する。
 */
export function useRemoveTree(treeId: string, ownerUsername: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RemoveTreeBody) =>
      apiFetch<{ tree: RemovedTreeResponse }>(`/admin/trees/${treeId}/remove`, {
        method: "POST",
        ...jsonBody(body),
      }),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.all.explore }),
        queryClient.invalidateQueries({ queryKey: queryKeys.all.exploreCategories }),
        queryClient.invalidateQueries({ queryKey: queryKeys.userAllPages(ownerUsername) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tree(treeId) }),
      ]);
    },
  });
}
