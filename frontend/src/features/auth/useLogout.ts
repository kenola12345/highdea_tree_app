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
      queryClient.clear();
      queryClient.setQueryData(queryKeys.me, null);
      await navigate("/");
    },
  });
}
