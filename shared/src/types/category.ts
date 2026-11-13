// カテゴリのレスポンス型。

/** カテゴリ1件（GET/POST/PATCH /api/categories）。日時は UTC の ISO 文字列 */
export type CategoryResponse = {
  id: string;
  name: string;
  color: string;
  /** このカテゴリが付いた自分のツリーのうち、ゴミ箱に入っていないものの数 */
  treeCount: number;
  createdAt: string;
  updatedAt: string;
};
