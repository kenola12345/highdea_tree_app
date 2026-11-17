// ボックス（アイデアをまとめる枠）のリクエストスキーマ（manifests/nodes.md §3.5 Boxes）。
import { z } from "zod";

import {
  GROUP_HEIGHT_MIN,
  GROUP_SIZE_MAX,
  GROUP_TITLE_MAX,
  GROUP_WIDTH_MIN,
  NOTE_BODY_MAX,
} from "../constants.js";

// nodes.ts がこのファイルを読み込むので、循環しないよう色のスキーマはここで定義する
const lineColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #3B82F6")
  .nullable();

const titleSchema = z
  .string()
  .trim()
  .min(1, "Enter a title")
  .max(GROUP_TITLE_MAX, `Use ${String(GROUP_TITLE_MAX)} characters or fewer`);
export const groupWidthSchema = z.int().min(GROUP_WIDTH_MIN).max(GROUP_SIZE_MAX);
export const groupHeightSchema = z.int().min(GROUP_HEIGHT_MIN).max(GROUP_SIZE_MAX);

/** キャンバスの項目の種類: ボックス・付箋・文字（manifests/nodes.md §3.5 Add menu and canvas items） */
export const groupKindSchema = z.enum(["BOX", "NOTE", "LABEL"]);
const bodySchema = z
  .string()
  .max(NOTE_BODY_MAX, `Use ${NOTE_BODY_MAX.toLocaleString("en")} characters or fewer`)
  .nullable();

/** POST /api/trees/:id/groups */
export const createGroupSchema = z.strictObject({
  kind: groupKindSchema.optional(),
  title: titleSchema.optional(),
  body: bodySchema.optional(),
  color: lineColorSchema.optional(),
  positionX: z.number(),
  positionY: z.number(),
  width: groupWidthSchema,
  height: groupHeightSchema,
});
export type CreateGroupBody = z.infer<typeof createGroupSchema>;

/** PATCH /api/groups/:id。変えるものだけ（最低1つ） */
export const updateGroupSchema = z
  .strictObject({
    title: titleSchema.optional(),
    body: bodySchema.optional(),
    color: lineColorSchema.optional(),
    positionX: z.number().optional(),
    positionY: z.number().optional(),
    width: groupWidthSchema.optional(),
    height: groupHeightSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: "Send at least one field to change" });
export type UpdateGroupBody = z.infer<typeof updateGroupSchema>;
