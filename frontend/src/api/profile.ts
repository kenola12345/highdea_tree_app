import type { PublicProfileResponse } from "@highdea/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ApiError, apiFetch } from "./client";
import { queryKeys } from "./queryKeys";

/** 公開プロフィールと、そのユーザーの公開ツリー。存在しない・退会済みは notFound（P-11 を表示） */
export function useUserProfile(username: string, page: number) {
  const query = useQuery({
    queryKey: queryKeys.user(username, page),
    queryFn: () =>
      apiFetch<PublicProfileResponse>(
        `/users/${encodeURIComponent(username)}?page=${String(page)}`,
      ),
    placeholderData: keepPreviousData,
  });
  const notFound = query.error instanceof ApiError && query.error.status === 404;
  return { ...query, notFound };
}
