import {
  type OwnTreeItem,
  type Pagination,
  TRASH_RETENTION_DAYS,
  type TrashItem,
} from "@highdea/shared";

import { AppError } from "../errors/AppError.js";
import { prisma } from "../lib/prisma.js";
import { toPagination, toSkipTake } from "./common/pagination.js";
import { toOwnTreeItem, type TreeListRow, treeListSelect } from "./common/treeMapper.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_MS = TRASH_RETENTION_DAYS * DAY_MS;

/**
 * ゴミ箱の保持期限の境目。これより前に削除されたツリーは完全削除の対象（manifests/common.md §3.10）。
 * 日次ジョブが動く前でも、期限切れのツリーは「完全削除済み」として扱い一覧・復元の対象にしない。
 */
export function purgeCutoff(now: Date): Date {
  return new Date(now.getTime() - RETENTION_MS);
}

/** ゴミ箱の1件。purgeAt は deletedAt + 保持日数 */
function toTrashItem(row: TreeListRow & { deletedAt: Date }): TrashItem {
  const item = toOwnTreeItem(row);
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    visibility: item.visibility,
    categories: item.categories,
    nodeCount: item.nodeCount,
    removedAt: item.removedAt,
    deletedAt: row.deletedAt.toISOString(),
    purgeAt: new Date(row.deletedAt.getTime() + RETENTION_MS).toISOString(),
  };
}

/** 自分のゴミ箱の一覧。削除が新しい順。管理者でも他人のゴミ箱は見られない（manifests/trees.md GET /api/trash） */
export async function list(
  userId: string,
  page: number,
  limit: number,
): Promise<{ trees: TrashItem[]; pagination: Pagination }> {
  const where = { ownerId: userId, deletedAt: { not: null, gte: purgeCutoff(new Date()) } };
  const [rows, total] = await prisma.$transaction([
    prisma.tree.findMany({
      where,
      select: treeListSelect,
      orderBy: [{ deletedAt: "desc" }, { id: "desc" }],
      ...toSkipTake(page, limit),
    }),
    prisma.tree.count({ where }),
  ]);
  const trees = rows.flatMap((row) => {
    const { deletedAt } = row;
    return deletedAt ? [toTrashItem({ ...row, deletedAt })] : [];
  });
  return { trees, pagination: toPagination(page, limit, total) };
}

/**
 * ゴミ箱から復元する。公開範囲・カテゴリ・非公開化の状態は削除前のまま戻す（manifests/trees.md）。
 * 存在しない・完全削除済み・他人のものは 404、ゴミ箱に入っていなければ 409。
 */
export async function restore(userId: string, treeId: string): Promise<OwnTreeItem> {
  const cutoff = purgeCutoff(new Date());
  const tree = await prisma.tree.findFirst({
    where: { id: treeId, ownerId: userId },
    select: { deletedAt: true },
  });
  if (!tree || (tree.deletedAt && tree.deletedAt < cutoff)) throw new AppError("TREE_NOT_FOUND");
  if (!tree.deletedAt) throw new AppError("TREE_NOT_IN_TRASH");

  // 確認後に別リクエストで復元・完全削除された場合も、条件付き更新で二重処理を防ぐ
  const { count } = await prisma.tree.updateMany({
    where: { id: treeId, ownerId: userId, deletedAt: { not: null, gte: cutoff } },
    data: { deletedAt: null },
  });
  if (count === 0) throw new AppError("TREE_NOT_FOUND");

  const row = await prisma.tree.findUniqueOrThrow({
    where: { id: treeId },
    select: treeListSelect,
  });
  return toOwnTreeItem(row);
}

/**
 * ゴミ箱のツリーを今すぐ完全削除する（manifests/trees.md DELETE /api/trash/:id）。
 * ノードとカテゴリタグは ON DELETE CASCADE で一緒に消え、使われなくなった画像は画像の掃除ジョブが消す。
 * WHY: ゴミ箱に入っていないツリーは消せない（誤操作で生きているツリーを消さないため、先にゴミ箱へ移す）。
 * 存在しない・完全削除済み・他人のものは 404、ゴミ箱に入っていなければ 409。
 */
export async function deleteForever(userId: string, treeId: string): Promise<void> {
  const cutoff = purgeCutoff(new Date());
  const tree = await prisma.tree.findFirst({
    where: { id: treeId, ownerId: userId },
    select: { deletedAt: true },
  });
  if (!tree || (tree.deletedAt && tree.deletedAt < cutoff)) throw new AppError("TREE_NOT_FOUND");
  if (!tree.deletedAt) throw new AppError("TREE_NOT_IN_TRASH");

  // 確認後に別リクエストで復元された場合に消さないよう、ゴミ箱にあることを条件に削除する
  const { count } = await prisma.tree.deleteMany({
    where: { id: treeId, ownerId: userId, deletedAt: { not: null } },
  });
  if (count === 0) throw new AppError("TREE_NOT_FOUND");
}

/**
 * 自分のゴミ箱を空にし、削除した件数を返す（manifests/trees.md DELETE /api/trash）。
 * 保持期限を過ぎてまだ日次ジョブが消していないツリーも、どうせ消える対象なので一緒に消す。
 */
export async function empty(userId: string): Promise<number> {
  const { count } = await prisma.tree.deleteMany({
    where: { ownerId: userId, deletedAt: { not: null } },
  });
  return count;
}
