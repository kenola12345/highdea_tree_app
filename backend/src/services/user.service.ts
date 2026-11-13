import type {
  ChangePasswordBody,
  MeResponse,
  PublicProfileResponse,
  UpdateAccountBody,
  UpdateProfileBody,
} from "@highdea/shared";

import { AppError } from "../errors/AppError.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";
import { assertEmailAndUsernameFree, isReservedUsername, toTakenError } from "./auth.service.js";
import { toPagination, toSkipTake } from "./common/pagination.js";
import { publicTreeWhere } from "./common/treeAccess.js";
import { toPublicTreeItem, treeListSelect } from "./common/treeMapper.js";
import { meSelect, toMeResponse, toPublicUserResponse } from "./common/userMapper.js";

/**
 * 公開プロフィールと公開ツリーの一覧。閲覧者が本人・管理者でも公開情報だけを返す。
 * 退会済みユーザーは存在しないものとして 404 にする（manifests/users.md GET /api/users/:username）。
 */
export async function getPublicProfile(
  username: string,
  page: number,
  limit: number,
): Promise<PublicProfileResponse> {
  const user = await prisma.user.findFirst({
    where: { username: username.toLowerCase(), deletedAt: null },
    select: { id: true, username: true, displayName: true, avatarUrl: true, createdAt: true },
  });
  if (!user) throw new AppError("USER_NOT_FOUND");

  const where = { ...publicTreeWhere, ownerId: user.id };
  const [rows, total] = await prisma.$transaction([
    prisma.tree.findMany({
      where,
      select: treeListSelect,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      ...toSkipTake(page, limit),
    }),
    prisma.tree.count({ where }),
  ]);
  return {
    user: toPublicUserResponse(user),
    trees: rows.map(toPublicTreeItem),
    pagination: toPagination(page, limit, total),
  };
}

/** 表示名・アバターURLを変更する。スキーマで許可した2項目だけを書き込む（role 等の一括代入を防ぐ） */
export async function updateProfile(userId: string, body: UpdateProfileBody): Promise<MeResponse> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { displayName: body.displayName, avatarUrl: body.avatarUrl },
    select: meSelect,
  });
  return toMeResponse(user);
}

/**
 * 現在のパスワードを確認する。違えば 403 WRONG_PASSWORD。
 * 401 にしないのはフロントが 401 を「ログアウト状態」と扱うため。403 は passwordCheckLimiter が数える（manifests/users.md）。
 */
export async function checkCurrentPassword(userId: string, password: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!(await verifyPassword(password, user.passwordHash))) throw new AppError("WRONG_PASSWORD");
}

/**
 * メール・ユーザー名を変更する。
 * 旧ユーザー名は予約もリダイレクトもせず即座に解放する（manifests/users.md PATCH /api/users/me/account）。
 */
export async function updateAccount(userId: string, body: UpdateAccountBody): Promise<MeResponse> {
  await checkCurrentPassword(userId, body.currentPassword);
  if (body.username !== undefined && isReservedUsername(body.username)) {
    throw new AppError("USERNAME_RESERVED");
  }
  const values = { email: body.email, username: body.username };
  // 退会済みアカウントのメール・ユーザー名も使用中として扱う（manifests/common.md §5.3）
  await assertEmailAndUsernameFree(values, userId);
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: values,
      select: meSelect,
    });
    return toMeResponse(user);
  } catch (err) {
    throw await toTakenError(err, values, userId);
  }
}

/** パスワードを変更する。トークンは取り消せないため、この端末も他の端末もログイン状態のまま */
export async function changePassword(userId: string, body: ChangePasswordBody): Promise<void> {
  await checkCurrentPassword(userId, body.currentPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(body.newPassword) },
    select: { id: true },
  });
}

/**
 * 退会（deletedAt を設定）。ツリー等のデータは残して非表示にし、メール・ユーザー名は確保したままにする（manifests/common.md §5.3）。
 * 他の端末のトークンは認証ミドルウェアが退会済みを毎回拒否するため、すぐに使えなくなる。
 */
export async function deactivate(userId: string, password: string): Promise<void> {
  await checkCurrentPassword(userId, password);
  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
    select: { id: true },
  });
}
