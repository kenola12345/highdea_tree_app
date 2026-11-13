import { randomUUID } from "node:crypto";

import type { TreeVisibility, UserRole } from "@prisma/client";

import { AUTH_COOKIE, signToken } from "../../src/lib/jwt.js";
import { hashPassword } from "../../src/lib/password.js";
import { prisma } from "../../src/lib/prisma.js";

/** factory で作るユーザーの共通パスワード */
export const TEST_PASSWORD = "correct horse battery";

let seq = 0;
const next = (): number => ++seq;

type UserOptions = {
  email?: string;
  username?: string;
  displayName?: string;
  password?: string;
  role?: UserRole;
  deactivated?: boolean;
};

/** ユーザーを作る（API を通さず DB に直接作る） */
export async function createUser(options: UserOptions = {}) {
  const n = next();
  return prisma.user.create({
    data: {
      email: options.email ?? `user${String(n)}@example.com`,
      username: options.username ?? `user${String(n)}`,
      displayName: options.displayName ?? `User ${String(n)}`,
      passwordHash: await hashPassword(options.password ?? TEST_PASSWORD),
      role: options.role ?? "USER",
      deletedAt: options.deactivated ? new Date() : null,
    },
  });
}

/** そのユーザーとしてリクエストするための Cookie ヘッダー値 */
export function authCookie(userId: string): string {
  return `${AUTH_COOKIE}=${signToken(userId)}`;
}

/** ログイン済みユーザーと Cookie を作る */
export async function createLoggedInUser(options: UserOptions = {}) {
  const user = await createUser(options);
  return { user, cookie: authCookie(user.id) };
}

/** ログイン済みの管理者と Cookie を作る */
export function createAdmin(options: Omit<UserOptions, "role"> = {}) {
  return createLoggedInUser({ ...options, role: "ADMIN" });
}

type TreeOptions = {
  title?: string;
  visibility?: TreeVisibility;
  /** 管理者による非公開化を済ませた状態にする */
  removed?: { byId: string; reason?: string };
  /** ゴミ箱に入れた日時 */
  deletedAt?: Date;
  categoryIds?: string[];
};

/** ツリーをルートノード付きで作る（API と同じく必ずルートが1つある状態） */
export async function createTree(ownerId: string, options: TreeOptions = {}) {
  const title = options.title ?? `Tree ${String(next())}`;
  const tree = await prisma.tree.create({
    data: {
      ownerId,
      title,
      visibility: options.removed ? "PRIVATE" : (options.visibility ?? "PRIVATE"),
      removedAt: options.removed ? new Date() : null,
      removedById: options.removed?.byId ?? null,
      removalReason: options.removed ? (options.removed.reason ?? "Spam") : null,
      deletedAt: options.deletedAt ?? null,
      nodes: { create: { title } },
      categories: options.categoryIds
        ? { create: options.categoryIds.map((categoryId) => ({ categoryId })) }
        : undefined,
    },
    include: { nodes: true },
  });
  const root = tree.nodes[0];
  if (!root) throw new Error("root node was not created");
  return { ...tree, rootId: root.id };
}

/** カテゴリを作る */
export function createCategory(
  userId: string,
  name = `Category ${String(next())}`,
  color = "#6B7280",
) {
  return prisma.category.create({
    data: { userId, name, nameKey: name.trim().toLowerCase(), color },
  });
}

/**
 * ルートの子として TEXT ノードを count 個まとめて作る（ノード上限のテスト用）。
 * 合計ノード数はルートを含めて count + 1 になる。
 */
export async function createNodes(treeId: string, parentId: string, count: number): Promise<void> {
  await prisma.node.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      treeId,
      parentId,
      title: `Idea ${String(i + 1)}`,
      sortOrder: i,
    })),
  });
}

/** アップロード済み画像のレコードを作る（ファイルは作らない） */
export function createUpload(ownerId: string) {
  return prisma.upload.create({
    data: {
      ownerId,
      storageKey: `${randomUUID()}.png`,
      originalName: "photo.png",
      mimeType: "image/png",
      sizeBytes: 1024,
    },
  });
}
