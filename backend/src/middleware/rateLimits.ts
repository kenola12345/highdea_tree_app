import type { Request, RequestHandler } from "express";
import { MemoryStore, type Options, rateLimit } from "express-rate-limit";

import { AppError } from "../errors/AppError.js";
import { currentUser } from "./auth.js";

const MINUTE = 60 * 1000;
const stores: MemoryStore[] = [];

/** 共通設定で制限を作る。超過時は共通エラー形式の 429 RATE_LIMITED を返す */
function createLimiter(options: Partial<Options>): RequestHandler {
  const store = new MemoryStore();
  stores.push(store);
  return rateLimit({
    standardHeaders: "draft-8",
    legacyHeaders: false,
    store,
    handler: (_req, _res, next) => {
      next(new AppError("RATE_LIMITED"));
    },
    ...options,
  });
}

/** ユーザー単位の制限のキー。requireAuth の後に置くこと */
const byUser = (req: Request): string => currentUser(req).id;

/** 新規登録: 同じIPから15分に5回まで（manifests/users.md POST /api/auth/signup） */
export const signupLimiter = createLimiter({ windowMs: 15 * MINUTE, limit: 5 });

/** ログイン: 同じIPから15分に失敗5回まで。成功したログインは数えない（manifests/users.md POST /api/auth/login） */
export const loginLimiter = createLimiter({
  windowMs: 15 * MINUTE,
  limit: 5,
  skipSuccessfulRequests: true,
});

/**
 * 現在のパスワード確認: 1ユーザーあたり15分に誤り5回まで。
 * メール・ユーザー名変更、パスワード変更、退会の3つで同じカウントを共有する（manifests/users.md）。
 * 403 WRONG_PASSWORD の応答だけを数える。
 */
export const passwordCheckLimiter = createLimiter({
  windowMs: 15 * MINUTE,
  limit: 5,
  keyGenerator: byUser,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (_req, res) => res.statusCode !== 403,
});

/** リンクプレビュー: 1ユーザーあたり1分に30回まで（manifests/nodes.md POST /api/link-preview） */
export const linkPreviewLimiter = createLimiter({
  windowMs: MINUTE,
  limit: 30,
  keyGenerator: byUser,
});

/** 画像アップロード: 1ユーザーあたり1時間に60回まで（manifests/nodes.md POST /api/uploads） */
export const uploadLimiter = createLimiter({
  windowMs: 60 * MINUTE,
  limit: 60,
  keyGenerator: byUser,
});

/** テスト専用: すべての制限カウンターを初期化する */
export async function resetRateLimits(): Promise<void> {
  await Promise.all(stores.map((store) => store.resetAll()));
}
