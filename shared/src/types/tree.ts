// ツリーのレスポンス型（manifests/trees.md）。一覧系は Phase 2、作成・詳細・ゴミ箱の型は Phase 5 で定義。

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

/** 作成・更新（POST / PATCH /api/trees）で返すツリー。一覧の項目から nodeCount を除いたもの */
export type TreeSummary = Omit<OwnTreeItem, "nodeCount">;

/** ツリー作成時に一緒に作られるルートノード（POST /api/trees の data.rootNode） */
export type RootNodeItem = {
  id: string;
  treeId: string;
  parentId: null;
  type: "TEXT";
  title: string;
  body: string | null;
  positionX: number;
  positionY: number;
  sortOrder: number;
  lineColor: null;
  cardColor: null;
  createdAt: string;
  updatedAt: string;
};

/** POST /api/trees の data */
export type CreateTreeResponse = { tree: TreeSummary; rootNode: RootNodeItem };

/**
 * キャンバス描画用のノードの骨格（GET /api/trees/:id の data.nodes の1件）。
 * 本文・URL・プレビュー・画像は含めず、表示範囲に入ったノードだけ別APIで遅延取得する。
 */
export type NodeSkeleton = {
  id: string;
  parentId: string | null;
  type: "TEXT" | "LINK" | "VIDEO" | "IMAGE";
  title: string;
  positionX: number;
  positionY: number;
  sortOrder: number;
  /** 枝の線の色（#RRGGBB）。null は最も近い祖先の色を受け継ぐ */
  lineColor: string | null;
  /** カードの色（#RRGGBB）。null は既定（白、中心のアイデアはブランドの緑）。受け継がない */
  cardColor: string | null;
  updatedAt: string;
};

/** GET /api/trees/:id の data。tree.removedAt / removalReason は所有者以外には常に null */
export type TreeDetailResponse = {
  tree: TreeSummary;
  owner: TreeOwnerRef;
  isOwner: boolean;
  nodes: NodeSkeleton[];
};

/** ゴミ箱（GET /api/trash）の1件。purgeAt は完全削除される予定日時（deletedAt + 10日） */
export type TrashItem = {
  id: string;
  title: string;
  description: string | null;
  visibility: TreeVisibility;
  categories: TreeCategoryRef[];
  nodeCount: number;
  removedAt: string | null;
  deletedAt: string;
  purgeAt: string;
};

/** POST /api/admin/trees/:id/remove の data.tree */
export type RemovedTreeResponse = {
  id: string;
  title: string;
  visibility: TreeVisibility;
  removedAt: string;
  removalReason: string;
};
