import {
  type LoginBody,
  type MeResponse,
  RESERVED_USERNAMES,
  type SignupBody,
} from "@highdea/shared";
import { Prisma } from "@prisma/client";

import { AppError } from "../errors/AppError.js";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";
import { meSelect, toMeResponse } from "./common/userMapper.js";

/** 予約語かどうか（URL /u/:username 等と衝突するため登録不可: manifests/users.md §3.1） */
export function isReservedUsername(username: string): boolean {
  return (RESERVED_USERNAMES as readonly string[]).includes(username);
}

/**
 * メールとユーザー名が他のアカウントで使われていないか確認する。
 * 退会済みアカウントのものも使用中として扱う（退会後もメール・ユーザー名は確保される: manifests/common.md §5.3）。
 */
export async function assertEmailAndUsernameFree(
  values: { email?: string; username?: string },
  exceptUserId?: string,
): Promise<void> {
  const notMe = exceptUserId ? { id: { not: exceptUserId } } : {};
  if (values.email && (await prisma.user.findFirst({ where: { email: values.email, ...notMe } }))) {
    throw new AppError("EMAIL_TAKEN");
  }
  if (
    values.username &&
    (await prisma.user.findFirst({ where: { username: values.username, ...notMe } }))
  ) {
    throw new AppError("USERNAME_TAKEN");
  }
}

/**
 * 一意制約違反（P2002）を EMAIL_TAKEN / USERNAME_TAKEN に変換する。
 * 事前確認の後に同時リクエストで先に登録された場合に備え、どちらが重複したかを調べ直す。
 */
export async function toTakenError(
  err: unknown,
  values: { email?: string; username?: string },
  exceptUserId?: string,
): Promise<unknown> {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") return err;
  try {
    await assertEmailAndUsernameFree(values, exceptUserId);
  } catch (taken) {
    return taken;
  }
  return err;
}

/** 新規登録。予約語・重複を確認し、パスワードをハッシュ化してユーザーを作る */
export async function signup(body: SignupBody): Promise<MeResponse> {
  if (isReservedUsername(body.username)) throw new AppError("USERNAME_RESERVED");
  await assertEmailAndUsernameFree(body);
  try {
    const user = await prisma.user.create({
      data: {
        email: body.email,
        username: body.username,
        displayName: body.displayName,
        passwordHash: await hashPassword(body.password),
      },
      select: meSelect,
    });
    return toMeResponse(user);
  } catch (err) {
    throw await toTakenError(err, body);
  }
}

/**
 * ログイン。未登録・パスワード違い・退会済みはすべて同じ 401 INVALID_CREDENTIALS にする
 * （どのメールが登録済みか分からないようにするため: manifests/users.md POST /api/auth/login）。
 */
export async function login(body: LoginBody): Promise<MeResponse> {
  const user = await prisma.user.findUnique({
    where: { email: body.email },
    select: { ...meSelect, passwordHash: true, deletedAt: true },
  });
  const ok = user
    ? await verifyPassword(body.password, user.passwordHash)
    : await verifyAgainstDummy(body.password);
  if (!user || !ok || user.deletedAt) throw new AppError("INVALID_CREDENTIALS");
  return toMeResponse(user);
}

/** ログイン中のユーザー本人の情報（requireAuth で有効性は確認済み） */
export async function me(userId: string): Promise<MeResponse> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: meSelect });
  return toMeResponse(user);
}
