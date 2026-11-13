import type { TreeDetailResponse } from "@highdea/shared";
import { useQuery } from "@tanstack/react-query";

import { ApiError, apiFetch } from "./client";
import { queryKeys } from "./queryKeys";

/**
 * ツリーの詳細と全ノードの骨格（id・親・種類・題名・位置）を1回で取得する。
 * キャンバスはこれで配置と線をすべて描き、重い内容だけ後から見えている分を取りに行く（manifests/nodes.md §3.5）。
 * 404（存在しない・非公開・ゴミ箱）は notFound として返し、画面は P-11 を表示する。
 */
export function useTree(id: string) {
  const query = useQuery({
    queryKey: queryKeys.tree(id),
    queryFn: () => apiFetch<TreeDetailResponse>(`/trees/${id}`),
  });
  const notFound = query.error instanceof ApiError && query.error.status === 404;
  return { ...query, notFound };
}
