import bcrypt from "bcrypt";

import { env } from "../config/env.js";

// 本番・開発はコスト12（standards/security.md §9.2）。テストだけは速度のため最小に下げる
const BCRYPT_COST = env.NODE_ENV === "test" ? 4 : 12;

/** パスワードを bcrypt でハッシュ化する */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

/** パスワードが保存済みハッシュと一致するか調べる */
export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

// 存在しないメールでのログインでも bcrypt の比較を1回行い、応答時間からアカウントの有無を推測させないためのハッシュ
const dummyHashPromise = bcrypt.hash("dummy-password-for-timing", BCRYPT_COST);

/** 比較対象がないときに同じだけ時間をかける（結果は常に false） */
export async function verifyAgainstDummy(password: string): Promise<false> {
  await bcrypt.compare(password, await dummyHashPromise);
  return false;
}
