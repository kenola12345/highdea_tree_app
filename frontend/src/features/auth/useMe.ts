import type { MeResponse } from "@highdea/shared";

import { useMeQuery } from "../../api/auth";

export type Session = {
  user: MeResponse | null;
  isGuest: boolean;
  /** 管理者ボタンの表示切り替えにだけ使う。権限の確認は毎回 API 側で行われる */
  isAdmin: boolean;
  isLoading: boolean;
};

/** 現在のログイン状態 */
export function useMe(): Session {
  const { data, isPending } = useMeQuery();
  const user = data ?? null;
  return {
    user,
    isGuest: !isPending && !user,
    isAdmin: user?.role === "ADMIN",
    isLoading: isPending,
  };
}
