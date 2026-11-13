import { z } from "zod";

import { CATEGORY_NAME_MAX } from "../constants.js";

/** カテゴリ名。前後の空白を除いて 1〜50文字（manifests/trees.md POST /api/categories） */
export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name")
  .max(CATEGORY_NAME_MAX, `Use ${String(CATEGORY_NAME_MAX)} characters or fewer`);

/** 色は #RRGGBB の16進表記のみ（manifests/trees.md categories） */
export const categoryColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Use a hex color like #FF8800");

/**
 * POST /api/categories の body。
 * strictObject にして nameKey・userId などを拒否する（nameKey はサーバーだけが設定し、所有者は常にログインユーザー）。
 * color を省略した場合は DB の既定値 #6B7280 になる。
 */
export const createCategorySchema = z.strictObject({
  name: categoryNameSchema,
  color: categoryColorSchema.optional(),
});
export type CreateCategoryBody = z.infer<typeof createCategorySchema>;

/** PATCH /api/categories/:id の body。変更する項目だけを送り、最低1つは必須（manifests/trees.md PATCH /api/categories/:id） */
export const updateCategorySchema = z
  .strictObject({
    name: categoryNameSchema.optional(),
    color: categoryColorSchema.optional(),
  })
  .refine((body) => body.name !== undefined || body.color !== undefined, {
    message: "Send at least one field to change",
  });
export type UpdateCategoryBody = z.infer<typeof updateCategorySchema>;
