import type { MeResponse } from "@highdea/shared";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "./client";
import { queryKeys } from "./queryKeys";

/** ログイン中のユーザーを取得する。401 は「ゲスト」の通常の答えなので null を返す（エラーにしない） */
export async function fetchMe(): Promise<MeResponse | null> {
  try {
    const { user } = await apiFetch<{ user: MeResponse }>("/auth/me");
    return user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

/** アプリ起動時にログイン状態を判定するクエリ（manifests/common.md §4 Session handling） */
export function useMeQuery(): UseQueryResult<MeResponse | null> {
  return useQuery({ queryKey: queryKeys.me, queryFn: fetchMe, staleTime: 5 * 60_000 });
}

/** ログアウト（Cookie を消すだけ。サーバー側にセッションはない） */
export function logout(): Promise<null> {
  return apiFetch<null>("/auth/logout", { method: "POST" });
}
