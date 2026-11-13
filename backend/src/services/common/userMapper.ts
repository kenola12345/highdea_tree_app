import type { MeResponse, PublicUserResponse } from "@highdea/shared";
import type { Prisma } from "@prisma/client";

/** 本人向けレスポンスに必要な列。passwordHash は選ばない */
export const meSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  role: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

type MeRow = Prisma.UserGetPayload<{ select: typeof meSelect }>;

/** 本人向け（signup・login・me など） */
export function toMeResponse(user: MeRow): MeResponse {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

/** 公開プロフィール向け。メール・ロールは含めない */
export function toPublicUserResponse(user: Omit<MeRow, "email" | "role">): PublicUserResponse {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  };
}
