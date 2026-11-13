import type {
  ExploreCategoriesQuery,
  ExploreCategoriesResponse,
  ExploreCategoryItem,
  ExploreListResponse,
  ExploreQuery,
} from "@highdea/shared";
import type { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { toPagination, toSkipTake } from "./common/pagination.js";
import { publicTreeWhere } from "./common/treeAccess.js";
import { toExploreTreeItem, treeListSelect } from "./common/treeMapper.js";

/** LIKE のワイルドカード（% _ \）を文字そのものとして扱うためにエスケープする */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * 公開ツリーの一覧（検索・カテゴリ絞り込み・ページング）。
 * 呼び出し元が管理者でも公開ツリーだけを返す（非公開ツリーは管理者にも見せない: CLAUDE.md 認可ルール）。
 */
export async function list(query: ExploreQuery): Promise<ExploreListResponse> {
  // Prisma の contains は % _ をエスケープしないため、入力した文字そのものとして検索できるようにする
  const q = query.q === undefined ? undefined : escapeLike(query.q);
  const where: Prisma.TreeWhereInput = {
    ...publicTreeWhere,
    ...(q && {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    }),
    // カテゴリはユーザーごとに持つため、name_key で全ユーザーの同名カテゴリをまとめて探す（manifests/explore.md）
    ...(query.category && {
      categories: { some: { category: { nameKey: query.category } } },
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
    trees: rows.map(toExploreTreeItem),
    pagination: toPagination(query.page, query.limit, total),
  };
}

/**
 * 公開ツリーで使われているカテゴリ名を、使われているツリー数の多い順に返す。
 * ユーザーをまたいで name_key でまとめ、表示名は最も多い表記を使う。N+1 を避けるため1回の集計クエリで取る。
 * 公開ツリーの条件は publicTreeWhere と同じ（manifests/common.md「Authorization Rules」）。
 */
export async function categories(
  query: ExploreCategoriesQuery,
): Promise<ExploreCategoriesResponse> {
  const prefix = query.q === undefined ? null : `${escapeLike(query.q)}%`;
  const rows = await prisma.$queryRaw<ExploreCategoryItem[]>`
    WITH tagged AS (
      SELECT c.name_key, c.name, tc.tree_id
      FROM tree_categories tc
      JOIN categories c ON c.id = tc.category_id
      JOIN trees t ON t.id = tc.tree_id
      JOIN users u ON u.id = t.owner_id
      WHERE t.visibility = 'PUBLIC'
        AND t.removed_at IS NULL
        AND t.deleted_at IS NULL
        AND u.deleted_at IS NULL
        AND (${prefix}::text IS NULL OR c.name_key LIKE ${prefix}::text)
    ),
    spellings AS (
      SELECT name_key, name, COUNT(*) AS uses
      FROM tagged
      GROUP BY name_key, name
    )
    SELECT
      k.name_key AS "key",
      (
        SELECT s.name FROM spellings s
        WHERE s.name_key = k.name_key
        -- 最も多い表記を採用し、同数なら大文字で始まる表記（"Work" > "work"）、それでも同じならコード順で1つに決める
        ORDER BY s.uses DESC,
          (left(s.name, 1) <> lower(left(s.name, 1))) DESC,
          s.name COLLATE "C" ASC
        LIMIT 1
      ) AS "name",
      COUNT(DISTINCT k.tree_id)::int AS "treeCount"
    FROM tagged k
    GROUP BY k.name_key
    ORDER BY "treeCount" DESC, "key" ASC
    LIMIT ${query.limit}`;
  return { categories: rows };
}
