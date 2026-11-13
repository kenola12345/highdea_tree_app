import type { Pagination } from "./pagination.js";
import type { PublicTreeItem } from "./tree.js";

// ユーザーのレスポンス型。passwordHash は決して含めない。

export type UserRole = "USER" | "ADMIN";

/** 本人向け（signup・login・me・設定変更の結果） */
export type MeResponse = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  createdAt: string;
};

/** 他人にも見せてよい項目だけ（公開プロフィール） */
export type PublicUserResponse = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
};

/** GET /api/users/:username の data（公開ツリーのみ） */
export type PublicProfileResponse = {
  user: PublicUserResponse;
  trees: PublicTreeItem[];
  pagination: Pagination;
};
