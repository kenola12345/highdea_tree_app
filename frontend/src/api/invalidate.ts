import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "./queryKeys";

type ChangedTree = { visibility?: "PRIVATE" | "PUBLIC"; ownerUsername?: string };

/**
 * ツリーの作成・編集・ゴミ箱移動・復元の後に古くなるキャッシュをまとめて無効化する。
 * 対象は manifests/common.md §4「Cache invalidation after changes」のとおり:
 * マイツリー・ゴミ箱・カテゴリ（ツリー数）、公開ツリーなら Explore と所有者のプロフィールも。
 */
export async function invalidateAfterTreeChange(
  queryClient: QueryClient,
  tree: ChangedTree = {},
): Promise<void> {
  const tasks = [
    queryClient.invalidateQueries({ queryKey: queryKeys.all.trees }),
    queryClient.invalidateQueries({ queryKey: queryKeys.all.trash }),
    queryClient.invalidateQueries({ queryKey: queryKeys.categories }),
  ];
  // 公開状態が分からない変更（公開→非公開の切り替えなど）も考え、PRIVATE と確定していなければ公開側も更新する
  if (tree.visibility !== "PRIVATE") {
    tasks.push(queryClient.invalidateQueries({ queryKey: queryKeys.all.explore }));
    tasks.push(queryClient.invalidateQueries({ queryKey: queryKeys.all.exploreCategories }));
    if (tree.ownerUsername) {
      tasks.push(
        queryClient.invalidateQueries({ queryKey: queryKeys.userAllPages(tree.ownerUsername) }),
      );
    }
  }
  await Promise.all(tasks);
}
