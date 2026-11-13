import type { ExploreCategoriesResponse, ExploreListResponse } from "@highdea/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { apiFetch } from "./client";
import { type ExploreParams, queryKeys } from "./queryKeys";

/** Explore のツリー一覧（公開ツリーのみ・検索とカテゴリで絞り込み・更新日の新しい順） */
export function useExplore(params: ExploreParams) {
  return useQuery({
    queryKey: queryKeys.explore(params),
    queryFn: () => {
      const search = new URLSearchParams({ page: String(params.page) });
      if (params.q) search.set("q", params.q);
      if (params.category) search.set("category", params.category);
      return apiFetch<ExploreListResponse>(`/explore?${search.toString()}`);
    },
    placeholderData: keepPreviousData,
  });
}

/** 公開ツリーでよく使われているカテゴリ（Explore のチップ用） */
export function useExploreCategories(limit = 20) {
  return useQuery({
    queryKey: queryKeys.exploreCategories(),
    queryFn: () =>
      apiFetch<ExploreCategoriesResponse>(`/explore/categories?limit=${String(limit)}`),
    staleTime: 5 * 60_000,
  });
}
