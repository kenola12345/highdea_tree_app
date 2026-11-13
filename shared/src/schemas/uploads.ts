// 画像アップロード（POST /api/uploads）の入力定義。本文は multipart/form-data のため Zod ではなく Multer で検証する。

/** 画像ファイルを入れる multipart のフィールド名（manifests/nodes.md POST /api/uploads） */
export const UPLOAD_FIELD_NAME = "file";
