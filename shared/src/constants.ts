// 業務上の上限値・固定値。フロントエンドとバックエンドで同じ値を使うため、数値をコードに直接書かずここから参照する。

/** 1ツリーあたりのノード上限（manifests/nodes.md §3.5） */
export const MAX_NODES_PER_TREE = 2000;
/** 1ユーザーあたりのカテゴリ上限（manifests/trees.md §3.7） */
export const MAX_CATEGORIES_PER_USER = 100;
/** 1ツリーに付けられるカテゴリ数の上限（manifests/trees.md §3.3） */
export const MAX_CATEGORIES_PER_TREE = 10;
/** ゴミ箱の保持日数。経過後に日次ジョブで完全削除（manifests/common.md §3.10） */
export const TRASH_RETENTION_DAYS = 10;
/** アップロード画像の最大サイズ（manifests/nodes.md §3.6） */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const TREE_TITLE_MAX = 100;
export const TREE_DESCRIPTION_MAX = 500;
export const NODE_TITLE_MAX = 200;
export const NODE_BODY_MAX = 10_000;
export const NODE_URL_MAX = 2048;
export const CATEGORY_NAME_MAX = 50;
export const REMOVAL_REASON_MAX = 500;
export const DISPLAY_NAME_MAX = 50;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
/** bcrypt は72バイトまでしか使わないため、それ以上の入力は受け付けない */
export const PASSWORD_MAX = 72;
export const PASSWORD_MIN = 8;

/** ノード詳細の一括取得で指定できるIDの最大数（GET /api/trees/:id/nodes?ids=） */
export const NODE_DETAILS_BATCH_MAX = 100;

export const PAGE_DEFAULT = 1;
export const PAGE_LIMIT_DEFAULT = 20;
export const PAGE_LIMIT_MAX = 50;

/** URL（/u/:username など）と衝突するため登録できないユーザー名 */
export const RESERVED_USERNAMES = ["admin", "explore", "settings"] as const;

/** アップロードを許可する画像形式。SVG はスクリプトを含められるため除外 */
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];
