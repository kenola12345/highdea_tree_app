import type {
  ChangePasswordBody,
  DeactivateBody,
  MeResponse,
  UpdateAccountBody,
  UpdateProfileBody,
} from "@highdea/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import { apiFetch, jsonBody } from "./client";
import { queryKeys } from "./queryKeys";

/** 自分の情報が変わったら、ログイン状態のキャッシュと公開プロフィールを更新する */
function useOnMeChanged() {
  const queryClient = useQueryClient();
  return async (user: MeResponse) => {
    queryClient.setQueryData(queryKeys.me, user);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.all.users }),
      queryClient.invalidateQueries({ queryKey: queryKeys.all.explore }),
    ]);
  };
}

/** 表示名・アバターURLの変更（PATCH /api/users/me） */
export function useUpdateProfile() {
  const onChanged = useOnMeChanged();
  return useMutation({
    mutationFn: async (body: UpdateProfileBody) =>
      (await apiFetch<{ user: MeResponse }>("/users/me", { method: "PATCH", ...jsonBody(body) }))
        .user,
    onSuccess: onChanged,
  });
}

/** メール・ユーザー名の変更（現在のパスワードが必要） */
export function useUpdateAccount() {
  const onChanged = useOnMeChanged();
  return useMutation({
    mutationFn: async (body: UpdateAccountBody) =>
      (
        await apiFetch<{ user: MeResponse }>("/users/me/account", {
          method: "PATCH",
          ...jsonBody(body),
        })
      ).user,
    onSuccess: onChanged,
  });
}

/** パスワード変更。このブラウザはログインしたまま（manifests/users.md PATCH /api/users/me/password） */
export function useChangePassword() {
  return useMutation({
    mutationFn: (body: ChangePasswordBody) =>
      apiFetch<{ user: MeResponse }>("/users/me/password", { method: "PATCH", ...jsonBody(body) }),
  });
}

/**
 * 退会。成功したらゲストとしてトップページへ移り、ログイン情報と残りのキャッシュを捨てる。
 * 先に公開ページへ移動してからログイン情報を消す: 逆にすると設定ページのログイン必須ガードが先に反応し、
 * /login?next=/settings へ飛ばされてしまう（manifests/users.md M-11 は「トップページへゲストとして」）。
 */
export function useDeactivate() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (body: DeactivateBody) =>
      apiFetch<null>("/users/me/deactivate", { method: "POST", ...jsonBody(body) }),
    onSuccess: async () => {
      await navigate("/", { replace: true });
      // 移動後の画面が描画されるのを待ってからログイン情報を消す（設定ページのガードが先に反応しないように）
      await new Promise((resolve) => setTimeout(resolve, 0));
      queryClient.setQueryData(queryKeys.me, null);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== queryKeys.me[0] });
    },
  });
}
