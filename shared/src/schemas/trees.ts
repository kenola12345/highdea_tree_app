// trees のリクエストスキーマ（manifests/trees.md GET・POST・PATCH /api/trees）。
import { z } from "zod";

import {
  MAX_CATEGORIES_PER_TREE,
  NODE_TITLE_MAX,
  TREE_DESCRIPTION_MAX,
  TREE_TITLE_MAX,
} from "../constants.js";
import { paginationQueryShape } from "./common.js";

const treeTitleSchema = z
  .string()
  .trim()
  .min(1, "Enter a title")
  .max(TREE_TITLE_MAX, `Use ${String(TREE_TITLE_MAX)} characters or fewer`);

/** 説明文。空文字は「説明なし」として null に揃える */
const treeDescriptionSchema = z
  .string()
  .trim()
  .max(TREE_DESCRIPTION_MAX, `Use ${String(TREE_DESCRIPTION_MAX)} characters or fewer`)
  .transform((value) => (value === "" ? null : value))
  .nullable();

export const treeVisibilitySchema = z.enum(["PRIVATE", "PUBLIC"]);

/** カテゴリID。重複は無視してから 10件上限を確認する（manifests/trees.md「Duplicates are ignored. Up to 10」） */
const categoryIdsSchema = z
  .array(z.string().min(1))
  .transform((ids) => [...new Set(ids)])
  .pipe(
    z
      .array(z.string())
      .max(MAX_CATEGORIES_PER_TREE, `Pick up to ${String(MAX_CATEGORIES_PER_TREE)} categories`),
  );

export const listTreesQuerySchema = z.strictObject({
  ...paginationQueryShape,
  categoryId: z.string().min(1).optional(),
});
export type ListTreesQuery = z.infer<typeof listTreesQuerySchema>;

/** ツリー作成。rootTitle を省略したら title を中心のアイデアに使う */
export const createTreeSchema = z
  .strictObject({
    title: treeTitleSchema,
    description: treeDescriptionSchema.optional(),
    visibility: treeVisibilitySchema.default("PRIVATE"),
    categoryIds: categoryIdsSchema.default([]),
    rootTitle: z
      .string()
      .trim()
      .min(1, "Enter the center idea")
      .max(NODE_TITLE_MAX, `Use ${String(NODE_TITLE_MAX)} characters or fewer`)
      .optional(),
  })
  .transform((body) => ({ ...body, rootTitle: body.rootTitle ?? body.title }));
export type CreateTreeBody = z.infer<typeof createTreeSchema>;

/** ツリー設定の更新。変更する項目だけを送り、最低1つは必要 */
export const updateTreeSchema = z
  .strictObject({
    title: treeTitleSchema.optional(),
    description: treeDescriptionSchema.optional(),
    visibility: treeVisibilitySchema.optional(),
    categoryIds: categoryIdsSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Send at least one field to update",
  });
export type UpdateTreeBody = z.infer<typeof updateTreeSchema>;
