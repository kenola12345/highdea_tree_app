import type { UserRole } from "@prisma/client";
import type { Request, RequestHandler } from "express";

import { AppError } from "../errors/AppError.js";
import { AUTH_COOKIE, clearAuthCookie, verifyToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";

type TokenResult =
  | { kind: "none" } // Cookie なし・不正・期限切れ
  | { kind: "inactive" } // トークンは有効だがユーザーが存在しない、または退会済み
  | { kind: "active"; user: { id: string; role: UserRole } };

/**
 * Cookie の JWT を検証し、ユーザーを DB から読み込む。
 * ロールと退会状態は毎回 DB から読む（manifests/common.md §6 認証ミドルウェア）。トークンは取り消せないため。
 */
async function readToken(req: Request): Promise<TokenResult> {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const token = cookies?.[AUTH_COOKIE];
  if (typeof token !== "string") return { kind: "none" };
  const userId = verifyToken(token);
  if (!userId) return { kind: "none" };
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, deletedAt: true },
  });
  if (!user || user.deletedAt) return { kind: "inactive" };
  return { kind: "active", user: { id: user.id, role: user.role } };
}

/** ログイン必須。未ログイン・退会済みは 401 UNAUTHENTICATED（退会済みなどは Cookie も消す） */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const result = await readToken(req);
  if (result.kind === "inactive") clearAuthCookie(res);
  if (result.kind !== "active") throw new AppError("UNAUTHENTICATED");
  req.user = result.user;
  next();
};

/** ログイン任意。有効なユーザーなら req.user を設定し、それ以外はゲストとして続行する */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const result = await readToken(req);
  if (result.kind === "active") req.user = result.user;
  next();
};

/** 未ログイン専用（新規登録・ログイン）。有効なユーザーの Cookie があれば 403 ALREADY_AUTHENTICATED */
export const guestOnly: RequestHandler = async (req, _res, next) => {
  const result = await readToken(req);
  if (result.kind === "active") throw new AppError("ALREADY_AUTHENTICATED");
  next();
};

/** requireAuth の後に使い、req.user を必ず存在する値として取り出す */
export function currentUser(req: Request): { id: string; role: UserRole } {
  if (!req.user) throw new Error("requireAuth is missing on this route");
  return req.user;
}
