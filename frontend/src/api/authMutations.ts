import type { LoginBody, MeResponse, SignupBody } from "@highdea/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiFetch, jsonBody } from "./client";
import { queryKeys } from "./queryKeys";

/** 新規登録。成功するとサーバーが Cookie を設定するので、そのままログイン中ユーザーとしてキャッシュする */
export function useSignup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SignupBody) =>
      apiFetch<{ user: MeResponse }>("/auth/signup", { method: "POST", ...jsonBody(body) }),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(queryKeys.me, user);
    },
  });
}

/** ログイン */
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginBody) =>
      apiFetch<{ user: MeResponse }>("/auth/login", { method: "POST", ...jsonBody(body) }),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(queryKeys.me, user);
    },
  });
}
