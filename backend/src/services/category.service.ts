import {
  type CategoryResponse,
  type CreateCategoryBody,
  MAX_CATEGORIES_PER_USER,
  type UpdateCategoryBody,
} from "@highdea/shared";
import { Prisma } from "@prisma/client";

import { AppError } from "../errors/AppError.js";
import { prisma } from "../lib/prisma.js";

/**
 * レスポンスに必要な列と treeCount を1クエリで取る select（N+1回避）。
 * treeCount は自分のツリーのうちゴミ箱にないものだけ数える（manifests/trees.md GET /api/categories）。
 */
function categorySelect(userId: string) {
  return {
    id: true,
    name: true,
    color: true,
    createdAt: true,
    updatedAt: true,
    _count: { select: { trees: { where: { tree: { ownerId: userId, deletedAt: null } } } } },
  } satisfies Prisma.CategorySelect;
}

type CategoryRow = Prisma.CategoryGetPayload<{ select: ReturnType<typeof categorySelect> }>;

/** DB の行をレスポンス形式に変換する */
function toCategoryResponse(row: CategoryRow): CategoryResponse {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    treeCount: row._count.trees,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** 大文字小文字を区別せず一意にするための比較キー。サーバーだけが設定する（manifests/trees.md categories） */
function toNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Prisma の既知エラーかどうか（コード指定） */
function isPrismaError(err: unknown, code: string): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;
}

/**
 * UNIQUE(user_id, name_key) 違反（P2002）を 409 CATEGORY_NAME_TAKEN に変換する。
 * categories の一意制約はこれだけなので、P2002 ならば名前の重複と判断できる。
 */
function toNameTakenError(err: unknown): unknown {
  return isPrismaError(err, "P2002") ? new AppError("CATEGORY_NAME_TAKEN") : err;
}

/** 自分のカテゴリ一覧を名前順（A–Z、大文字小文字を区別しない）で返す */
export async function list(userId: string): Promise<CategoryResponse[]> {
  const rows = await prisma.category.findMany({
    where: { userId },
    select: categorySelect(userId),
    // nameKey は小文字化済みなので、これで大文字小文字を区別しない名前順になる
    orderBy: [{ nameKey: "asc" }, { id: "asc" }],
  });
  return rows.map(toCategoryResponse);
}

/**
 * カテゴリを作る。上限確認と作成は1トランザクションで行う（standards/database.md §4.5）。
 * ユーザー行をロックし、同時リクエストでも 100件上限（manifests/trees.md §3.7）を超えさせない。
 */
export async function create(userId: string, body: CreateCategoryBody): Promise<CategoryResponse> {
  try {
    const row = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
      const count = await tx.category.count({ where: { userId } });
      if (count >= MAX_CATEGORIES_PER_USER) throw new AppError("CATEGORY_LIMIT_REACHED");
      return tx.category.create({
        data: { userId, name: body.name, nameKey: toNameKey(body.name), color: body.color },
        select: categorySelect(userId),
      });
    });
    return toCategoryResponse(row);
  } catch (err) {
    throw toNameTakenError(err);
  }
}

/**
 * カテゴリの名前・色を変更する。名前を変えたら nameKey も更新する。
 * 同じカテゴリの大文字小文字だけの変更（work → Work）は nameKey が変わらないので一意制約に掛からず許可される。
 * 他人のカテゴリは存在を明かさず 404（manifests/trees.md PATCH /api/categories/:id）。
 */
export async function update(
  userId: string,
  id: string,
  body: UpdateCategoryBody,
): Promise<CategoryResponse> {
  try {
    const row = await prisma.category.update({
      where: { id, userId },
      data: {
        ...(body.name !== undefined && { name: body.name, nameKey: toNameKey(body.name) }),
        ...(body.color !== undefined && { color: body.color }),
      },
      select: categorySelect(userId),
    });
    return toCategoryResponse(row);
  } catch (err) {
    // where に一致しない（存在しない・他人のもの）と P2025
    if (isPrismaError(err, "P2025")) throw new AppError("CATEGORY_NOT_FOUND");
    throw toNameTakenError(err);
  }
}

/**
 * カテゴリを削除する。ツリーは残し、タグ（tree_categories）は DB の ON DELETE CASCADE で消える
 * （ゴミ箱内のツリーも含む: manifests/trees.md DELETE /api/categories/:id）。
 */
export async function remove(userId: string, id: string): Promise<void> {
  const { count } = await prisma.category.deleteMany({ where: { id, userId } });
  if (count === 0) throw new AppError("CATEGORY_NOT_FOUND");
}
