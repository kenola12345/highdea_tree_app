import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import { logout } from "../../api/auth";
import { queryKeys } from "../../api/queryKeys";

/** ログアウトしてキャッシュを捨て、トップページへ戻る（他人の画面にデータが残らないように） */
export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: logout,
    onSettled: async () => {
      // ログイン状態のクエリは画面が監視しているので消さずに null（ゲスト）にし、それ以外のデータはすべて捨てる。
      // clear() で消すと監視中の画面が古いユーザーのまま更新されないため
      queryClient.setQueryData(queryKeys.me, null);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== queryKeys.me[0] });
      await navigate("/");
    },
  });
}
