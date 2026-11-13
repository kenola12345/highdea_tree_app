import type {
  CreateTreeBody,
  CreateTreeResponse,
  ListTreesQuery,
  OwnTreeItem,
  Pagination,
  TreeDetailResponse,
  TreeSummary,
  UpdateTreeBody,
} from "@highdea/shared";
import type { Prisma } from "@prisma/client";

import { AppError } from "../errors/AppError.js";
import { prisma } from "../lib/prisma.js";
import { toPagination, toSkipTake } from "./common/pagination.js";
import { visibleTreeWhere } from "./common/treeAccess.js";
import { toOwnTreeItem, treeListSelect } from "./common/treeMapper.js";

type Db = Prisma.TransactionClient | typeof prisma;

/** キャンバス用の骨格だけを取る列。本文・URL・プレビュー・画像は詳細APIで遅延取得する（manifests/trees.md GET /api/trees/:id） */
const nodeSkeletonSelect = {
  id: true,
  parentId: true,
  type: true,
  title: true,
  positionX: true,
  positionY: true,
  sortOrder: true,
  lineColor: true,
  updatedAt: true,
} satisfies Prisma.NodeSelect;

const rootNodeSelect = {
  id: true,
  treeId: true,
  title: true,
  body: true,
  positionX: true,
  positionY: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NodeSelect;

/** 一覧の項目から nodeCount を除いた、作成・更新・詳細用のツリー */
function toTreeSummary(item: OwnTreeItem): TreeSummary {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    visibility: item.visibility,
    categories: item.categories,
    removedAt: item.removedAt,
    removalReason: item.removalReason,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

/** 自分のツリー（ゴミ箱以外）を1件読み込み、作成・更新結果として返す */
async function loadSummary(db: Db, treeId: string): Promise<TreeSummary> {
  const row = await db.tree.findUniqueOrThrow({ where: { id: treeId }, select: treeListSelect });
  return toTreeSummary(toOwnTreeItem(row));
}

/**
 * 指定カテゴリがすべて自分のものか確認する。
 * ツリーには所有者自身のカテゴリしか付けられないため、存在しない・他人のIDが1つでもあれば 404（manifests/trees.md tree_categories）。
 */
export async function assertOwnCategories(
  db: Db,
  userId: string,
  categoryIds: string[],
): Promise<void> {
  if (categoryIds.length === 0) return;
  const count = await db.category.count({ where: { id: { in: categoryIds }, userId } });
  if (count !== categoryIds.length) throw new AppError("CATEGORY_NOT_FOUND");
}

/** マイツリー一覧。管理者でも自分のツリーだけを返す（manifests/trees.md GET /api/trees） */
export async function listMine(
  userId: string,
  query: ListTreesQuery,
): Promise<{ trees: OwnTreeItem[]; pagination: Pagination }> {
  if (query.categoryId !== undefined) {
    await assertOwnCategories(prisma, userId, [query.categoryId]);
  }
  const where: Prisma.TreeWhereInput = {
    ownerId: userId,
    deletedAt: null,
    ...(query.categoryId !== undefined && {
      categories: { some: { categoryId: query.categoryId } },
    }),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.tree.findMany({
      where,
      select: treeListSelect,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      ...toSkipTake(query.page, query.limit),
    }),
    prisma.tree.count({ where }),
  ]);
  return {
    trees: rows.map(toOwnTreeItem),
    pagination: toPagination(query.page, query.limit, total),
  };
}

/**
 * ツリーを作る。ツリー・ルートノード・カテゴリタグを1トランザクションで作り、
 * ルートのないツリーやカテゴリエラー時の作りかけを残さない（manifests/trees.md POST /api/trees）。
 */
export async function create(userId: string, body: CreateTreeBody): Promise<CreateTreeResponse> {
  return prisma.$transaction(async (tx) => {
    await assertOwnCategories(tx, userId, body.categoryIds);
    const created = await tx.tree.create({
      data: {
        ownerId: userId,
        title: body.title,
        description: body.description ?? null,
        visibility: body.visibility,
        nodes: { create: { type: "TEXT", title: body.rootTitle, positionX: 0, positionY: 0 } },
        categories: { create: body.categoryIds.map((categoryId) => ({ categoryId })) },
      },
      select: { id: true, nodes: { select: rootNodeSelect } },
    });
    const root = created.nodes[0];
    if (!root) throw new Error("root node was not created");
    return {
      tree: await loadSummary(tx, created.id),
      rootNode: {
        ...root,
        parentId: null,
        type: "TEXT",
        lineColor: null,
        createdAt: root.createdAt.toISOString(),
        updatedAt: root.updatedAt.toISOString(),
      },
    };
  });
}

/**
 * ツリー詳細（全ノードの骨格つき）。所有者はゴミ箱以外の自分のツリーを、それ以外の人は公開ツリーだけ見られる。
 * 見てはいけないツリーは存在を明かさないよう 404（非公開ツリーは管理者にも見せない: CLAUDE.md）。
 */
export async function getDetail(
  viewerId: string | undefined,
  treeId: string,
): Promise<TreeDetailResponse> {
  const row = await prisma.tree.findFirst({
    where: { AND: [{ id: treeId }, visibleTreeWhere(viewerId)] },
    select: {
      ...treeListSelect,
      ownerId: true,
      nodes: {
        select: nodeSkeletonSelect,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!row) throw new AppError("TREE_NOT_FOUND");

  const isOwner = viewerId !== undefined && row.ownerId === viewerId;
  const tree = toTreeSummary(toOwnTreeItem(row));
  return {
    // 管理者による非公開化の情報は所有者にだけ見せる（manifests/trees.md GET /api/trees/:id）
    tree: isOwner ? tree : { ...tree, removedAt: null, removalReason: null },
    owner: row.owner,
    isOwner,
    nodes: row.nodes.map((node) => ({ ...node, updatedAt: node.updatedAt.toISOString() })),
  };
}

/**
 * ツリー行をロックして非公開化の状態を読む。自分のものでない・ゴミ箱内は存在を隠して 404。
 * ロックするのは、確認と更新の間に管理者が非公開化しても「公開」に戻されないようにするため。
 */
async function lockOwnedActiveTree(
  tx: Prisma.TransactionClient,
  userId: string,
  treeId: string,
): Promise<{ removedAt: Date | null }> {
  const rows = await tx.$queryRaw<{ removed_at: Date | null }[]>`
    SELECT removed_at FROM trees
    WHERE id = ${treeId} AND owner_id = ${userId} AND deleted_at IS NULL
    FOR UPDATE`;
  const row = rows[0];
  if (!row) throw new AppError("TREE_NOT_FOUND");
  return { removedAt: row.removed_at };
}

/** ツリー設定を更新する。カテゴリの総入れ替えと他の項目の変更を1トランザクションで行う */
export async function update(
  userId: string,
  treeId: string,
  body: UpdateTreeBody,
): Promise<TreeSummary> {
  return prisma.$transaction(async (tx) => {
    const { removedAt } = await lockOwnedActiveTree(tx, userId, treeId);
    // 管理者に非公開化されたツリーは公開に戻せない（manifests/trees.md）
    if (body.visibility === "PUBLIC" && removedAt) throw new AppError("TREE_REMOVED");

    if (body.categoryIds !== undefined) {
      await assertOwnCategories(tx, userId, body.categoryIds);
      await tx.treeCategory.deleteMany({ where: { treeId } });
      await tx.treeCategory.createMany({
        data: body.categoryIds.map((categoryId) => ({ treeId, categoryId })),
      });
    }
    // カテゴリだけの変更でも更新日時を進める（マイツリーの並び順に反映するため）
    await tx.tree.update({
      where: { id: treeId },
      data: {
        title: body.title,
        description: body.description,
        visibility: body.visibility,
        updatedAt: new Date(),
      },
    });
    return loadSummary(tx, treeId);
  });
}

/**
 * ツリーをゴミ箱に移す（論理削除）。ノード・カテゴリタグ・非公開化の記録はそのまま残し、復元できるようにする。
 * 自分のものでない・既にゴミ箱内は 404（manifests/trees.md DELETE /api/trees/:id）。
 */
export async function moveToTrash(userId: string, treeId: string): Promise<void> {
  const { count } = await prisma.tree.updateMany({
    where: { id: treeId, ownerId: userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (count === 0) throw new AppError("TREE_NOT_FOUND");
}
