import type { CookieOptions, Response } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";

export const AUTH_COOKIE = "access_token";
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

// Cookie の設定（manifests/users.md POST /api/auth/signup）。削除時も同じ属性でないとブラウザが消さない
const cookieBase: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.NODE_ENV === "production",
  path: "/",
};

/**
 * ユーザーIDだけを載せた JWT を発行する（有効期限7日）。
 * ロールはトークンに入れない: 認証ミドルウェアが毎回DBから読むので、ロール変更や退会がすぐ反映される。
 */
export function signToken(userId: string): string {
  return jwt.sign({}, env.JWT_SECRET, {
    subject: userId,
    expiresIn: TOKEN_TTL_SECONDS,
    algorithm: "HS256",
  });
}

/** JWT を検証してユーザーIDを返す。署名不正・期限切れ・形式不正なら null */
export function verifyToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    return typeof payload === "object" && typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/** ログイン用 Cookie を設定する */
export function setAuthCookie(res: Response, userId: string): void {
  res.cookie(AUTH_COOKIE, signToken(userId), { ...cookieBase, maxAge: TOKEN_TTL_SECONDS * 1000 });
}

/** ログイン用 Cookie を削除する */
export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE, cookieBase);
}
