import type {
  ExploreTreeItem,
  OwnTreeItem,
  PublicTreeItem,
  TreeCategoryRef,
  TreeOwnerRef,
} from "@highdea/shared";
import type { Prisma } from "@prisma/client";

/** ツリー一覧（マイツリー・公開プロフィール・Explore・ゴミ箱）で取得する列。必要な列だけを1クエリで取る（N+1回避） */
export const treeListSelect = {
  id: true,
  title: true,
  description: true,
  visibility: true,
  removedAt: true,
  removalReason: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  categories: { select: { category: { select: { id: true, name: true, color: true } } } },
  owner: { select: { username: true, displayName: true, avatarUrl: true } },
  _count: { select: { nodes: true } },
} satisfies Prisma.TreeSelect;

export type TreeListRow = Prisma.TreeGetPayload<{ select: typeof treeListSelect }>;

/** カテゴリは名前順（大文字小文字を区別しない）で返す */
function toCategories(row: TreeListRow): TreeCategoryRef[] {
  return row.categories
    .map(({ category }) => category)
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

/** 所有者向け一覧（GET /api/trees、復元結果）の1件 */
export function toOwnTreeItem(row: TreeListRow): OwnTreeItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    categories: toCategories(row),
    nodeCount: row._count.nodes,
    removedAt: row.removedAt?.toISOString() ?? null,
    removalReason: row.removalReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** 公開プロフィール（GET /api/users/:username）の1件。非公開化の情報は所有者以外に見せない */
export function toPublicTreeItem(row: TreeListRow): PublicTreeItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    categories: toCategories(row),
    nodeCount: row._count.nodes,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Explore（GET /api/explore）の1件。所有者は公開してよい項目だけ */
export function toExploreTreeItem(row: TreeListRow): ExploreTreeItem {
  const owner: TreeOwnerRef = {
    username: row.owner.username,
    displayName: row.owner.displayName,
    avatarUrl: row.owner.avatarUrl,
  };
  return { ...toPublicTreeItem(row), owner };
}
