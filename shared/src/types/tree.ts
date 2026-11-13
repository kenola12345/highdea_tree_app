// ツリーのレスポンス型。一覧系（Phase 2）を先に定義し、詳細・ゴミ箱の型は backend-tasks.md Phase 5 で追加する。

export type TreeVisibility = "PRIVATE" | "PUBLIC";

/** ツリーに付いたカテゴリ（一覧・詳細で共通） */
export type TreeCategoryRef = { id: string; name: string; color: string };

/** ツリーの所有者として公開してよい情報だけ */
export type TreeOwnerRef = { username: string; displayName: string; avatarUrl: string | null };

/** マイツリー一覧（GET /api/trees）・復元結果の1件。日時は UTC の ISO 文字列 */
export type OwnTreeItem = {
  id: string;
  title: string;
  description: string | null;
  visibility: TreeVisibility;
  categories: TreeCategoryRef[];
  nodeCount: number;
  removedAt: string | null;
  removalReason: string | null;
  createdAt: string;
  updatedAt: string;
};

/** 公開プロフィール（GET /api/users/:username）の1件 */
export type PublicTreeItem = {
  id: string;
  title: string;
  description: string | null;
  categories: TreeCategoryRef[];
  nodeCount: number;
  updatedAt: string;
};

/** Explore（GET /api/explore）の1件。公開プロフィールの項目に所有者を加えたもの */
export type ExploreTreeItem = PublicTreeItem & { owner: TreeOwnerRef };
