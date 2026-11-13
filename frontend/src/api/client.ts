import type { ApiErrorBody, ErrorCode, FieldError } from "@highdea/shared";

/** API が { error } を返したときの例外。code で分岐し、details はフォームの各項目に表示する */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: FieldError[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type UnauthenticatedHandler = () => void;
let onUnauthenticated: UnauthenticatedHandler = () => undefined;

/** 利用中に 401 を受けたときの処理を登録する（App で「ログイン画面へ戻す」を設定） */
export function setUnauthenticatedHandler(handler: UnauthenticatedHandler): void {
  onUnauthenticated = handler;
}

// /auth/me の 401 は「ゲスト」という通常の答えなので、ログイン画面へは飛ばさない（manifests/common.md §4 SPA points）
const PATHS_WITHOUT_401_REDIRECT = new Set(["/auth/me", "/auth/login", "/auth/signup"]);

/**
 * 共通の fetch。/api を付け、成功時は { data } の中身を返し、失敗時は ApiError を投げる。
 * 認証は httpOnly Cookie なので credentials: "same-origin" で自動的に送られる。
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  // FormData（画像アップロード）は境界文字列付きの Content-Type をブラウザに任せる
  if (init.body !== undefined && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`/api${path}`, { credentials: "same-origin", ...init, headers });

  if (res.ok) {
    const body = (await res.json()) as { data: T };
    return body.data;
  }

  const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
  const error = new ApiError(
    res.status,
    body?.error.code ?? "INTERNAL_ERROR",
    body?.error.message ?? "Something went wrong. Please try again.",
    body?.error.details,
  );
  // 7日の有効期限切れなど、利用中にセッションが切れた場合はログイン画面へ戻す
  if (res.status === 401 && !PATHS_WITHOUT_401_REDIRECT.has(path)) onUnauthenticated();
  throw error;
}

/** JSON 本文付きのリクエスト用の短縮形 */
export function jsonBody(value: unknown): Pick<RequestInit, "body"> {
  return { body: JSON.stringify(value) };
}
