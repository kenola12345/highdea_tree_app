// nodes のリクエストスキーマ（manifests/nodes.md GET・POST /api/trees/:id/nodes、PATCH /api/nodes/:id、PATCH /api/trees/:id/nodes/positions）。
import { z } from "zod";

import {
  MAX_GROUPS_PER_TREE,
  MAX_NODES_PER_TREE,
  NODE_BODY_MAX,
  NODE_DETAILS_BATCH_MAX,
  NODE_FONT_SIZE_MAX,
  NODE_FONT_SIZE_MIN,
  NODE_HEIGHT_MAX,
  NODE_HEIGHT_MIN,
  NODE_TITLE_MAX,
  NODE_URL_MAX,
  NODE_WIDTH_MAX,
  NODE_WIDTH_MIN,
} from "../constants.js";
import { groupHeightSchema, groupWidthSchema } from "./groups.js";

/** 埋め込みを許可する動画サイトのホスト（サブドメインを含む）。manifests/nodes.md「VIDEO: YouTube or Vimeo」 */
const VIDEO_HOST_PATTERN = /^(?:[a-z0-9-]+\.)*(?:youtube\.com|youtu\.be|vimeo\.com)$/i;

export const nodeTypeSchema = z.enum(["TEXT", "LINK", "VIDEO", "IMAGE"]);

const nodeTitleSchema = z
  .string()
  .trim()
  .min(1, "Enter a title")
  .max(NODE_TITLE_MAX, `Use ${String(NODE_TITLE_MAX)} characters or fewer`);
const nodeBodySchema = z
  .string()
  .max(NODE_BODY_MAX, `Use ${NODE_BODY_MAX.toLocaleString("en")} characters or fewer`)
  .nullable();
const positionSchema = z.number();
const sortOrderSchema = z.int32();
/** 色（#RRGGBB）または null（既定・祖先から受け継ぐ）。線の色とカードの色で使う（manifests/nodes.md §3.5） */
export const lineColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #3B82F6")
  .nullable();
export const cardColorSchema = lineColorSchema;

/** カードの形（manifests/nodes.md §3.5 Card shape and size） */
export const nodeShapeSchema = z.enum(["ROUNDED", "RECTANGLE", "PILL", "ELLIPSE"]);
/** カードの幅・高さ（整数）。null は既定の大きさ */
export const nodeWidthSchema = z
  .int(`Enter a whole number`)
  .min(NODE_WIDTH_MIN, `Use ${String(NODE_WIDTH_MIN)}–${String(NODE_WIDTH_MAX)}`)
  .max(NODE_WIDTH_MAX, `Use ${String(NODE_WIDTH_MIN)}–${String(NODE_WIDTH_MAX)}`)
  .nullable();
/** 文字の大きさ（px、整数）。null は既定 */
export const nodeFontSizeSchema = z
  .int("Enter a whole number")
  .min(NODE_FONT_SIZE_MIN, `Use ${String(NODE_FONT_SIZE_MIN)}–${String(NODE_FONT_SIZE_MAX)}`)
  .max(NODE_FONT_SIZE_MAX, `Use ${String(NODE_FONT_SIZE_MIN)}–${String(NODE_FONT_SIZE_MAX)}`)
  .nullable();
/** 文字の色（#RRGGBB）。null は自動（カードの色に対して読みやすい方） */
export const textColorSchema = lineColorSchema;
/** アイデアの種類（見た目の強弱）。null は種類なし。中心のアイデアには付けられない（サービスで確認） */
export const nodeRoleSchema = z
  .enum(["CORE", "SUPPORTING", "IMPORTANT", "EXAMPLE", "QUESTION"])
  .nullable();
export const nodeHeightSchema = z
  .int(`Enter a whole number`)
  .min(NODE_HEIGHT_MIN, `Use ${String(NODE_HEIGHT_MIN)}–${String(NODE_HEIGHT_MAX)}`)
  .max(NODE_HEIGHT_MAX, `Use ${String(NODE_HEIGHT_MIN)}–${String(NODE_HEIGHT_MAX)}`)
  .nullable();

/** LINK・VIDEO の URL。http/https、2,048文字まで */
export const nodeUrlSchema = z
  .string()
  .trim()
  .max(NODE_URL_MAX, "Use 2,048 characters or fewer")
  .pipe(z.url({ protocol: /^https?$/, message: "Enter an http or https URL" }));

/** VIDEO の URL。埋め込みできるのは YouTube と Vimeo だけ */
export const videoUrlSchema = z
  .string()
  .trim()
  .max(NODE_URL_MAX, "Use 2,048 characters or fewer")
  .pipe(
    z.url({
      protocol: /^https?$/,
      hostname: VIDEO_HOST_PATTERN,
      message: "Enter a YouTube or Vimeo URL",
    }),
  );

/** URL が YouTube か Vimeo のものか（type を送らない編集で、現在の型が VIDEO の時にサービスが使う） */
export function isVideoProviderUrl(value: string): boolean {
  return videoUrlSchema.safeParse(value).success;
}

const createCommon = {
  parentId: z.string().min(1),
  title: nodeTitleSchema,
  body: nodeBodySchema.optional(),
  positionX: positionSchema.optional(),
  positionY: positionSchema.optional(),
  sortOrder: sortOrderSchema.optional(),
  lineColor: lineColorSchema.optional(),
  cardColor: cardColorSchema.optional(),
  shape: nodeShapeSchema.optional(),
  width: nodeWidthSchema.optional(),
  height: nodeHeightSchema.optional(),
  fontSize: nodeFontSizeSchema.optional(),
  textColor: textColorSchema.optional(),
  role: nodeRoleSchema.optional(),
};

/**
 * POST /api/trees/:id/nodes の body。type ごとに必須・不可の項目が違うため discriminated union にする。
 * strictObject なので、型に合わない項目やプレビュー項目（サーバーだけが設定する）は 400 になる。
 */
export const createNodeSchema = z.discriminatedUnion("type", [
  z.strictObject({ ...createCommon, type: z.literal("TEXT") }),
  z.strictObject({ ...createCommon, type: z.literal("LINK"), url: nodeUrlSchema }),
  z.strictObject({ ...createCommon, type: z.literal("VIDEO"), url: videoUrlSchema }),
  z.strictObject({ ...createCommon, type: z.literal("IMAGE"), imageUploadId: z.string().min(1) }),
]);
export type CreateNodeBody = z.infer<typeof createNodeSchema>;

/**
 * PATCH /api/nodes/:id の body。変更する項目だけを送り、最低1つは必須。
 * type が送られた場合だけ、その型に合わない項目をここで拒否する（送られていない場合は現在の型に依存するためサービスで確認）。
 * 位置と並び順は付け替え（parentId）と一緒の時だけ受け付ける。通常のドラッグ移動は positions API で保存する（manifests/nodes.md）。
 */
export const updateNodeSchema = z
  .strictObject({
    type: nodeTypeSchema.optional(),
    title: nodeTitleSchema.optional(),
    body: nodeBodySchema.optional(),
    url: nodeUrlSchema.optional(),
    imageUploadId: z.string().min(1).optional(),
    parentId: z.string().min(1).optional(),
    positionX: positionSchema.optional(),
    positionY: positionSchema.optional(),
    sortOrder: sortOrderSchema.optional(),
    lineColor: lineColorSchema.optional(),
    cardColor: cardColorSchema.optional(),
    shape: nodeShapeSchema.optional(),
    width: nodeWidthSchema.optional(),
    height: nodeHeightSchema.optional(),
    fontSize: nodeFontSizeSchema.optional(),
    textColor: textColorSchema.optional(),
    role: nodeRoleSchema.optional(),
  })
  .superRefine((body, ctx) => {
    if (Object.keys(body).length === 0) {
      ctx.addIssue({ code: "custom", message: "Send at least one field to change" });
    }
    if (body.parentId === undefined) {
      for (const field of ["positionX", "positionY", "sortOrder"] as const) {
        if (body[field] !== undefined) {
          ctx.addIssue({
            code: "custom",
            path: [field],
            message: "Only allowed together with parentId",
          });
        }
      }
    }
    if (body.type === undefined) return;
    if (body.url !== undefined && body.type !== "LINK" && body.type !== "VIDEO") {
      ctx.addIssue({ code: "custom", path: ["url"], message: "Not allowed for this type" });
    }
    if (body.type === "VIDEO" && body.url !== undefined && !isVideoProviderUrl(body.url)) {
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message: "Only YouTube or Vimeo URLs are supported",
      });
    }
    if (body.imageUploadId !== undefined && body.type !== "IMAGE") {
      ctx.addIssue({
        code: "custom",
        path: ["imageUploadId"],
        message: "Not allowed for this type",
      });
    }
  });
export type UpdateNodeBody = z.infer<typeof updateNodeSchema>;

const positionItemSchema = z.strictObject({
  id: z.string().min(1),
  positionX: positionSchema,
  positionY: positionSchema,
  sortOrder: sortOrderSchema.optional(),
});

const groupPositionSchema = z.strictObject({
  id: z.string().min(1),
  positionX: positionSchema,
  positionY: positionSchema,
  width: groupWidthSchema.optional(),
  height: groupHeightSchema.optional(),
});

/**
 * PATCH /api/trees/:id/nodes/positions の body。ノード 0〜2,000件とボックス 0〜100件（両方は空にできない）。
 * 同じIDは1回だけ。ボックスを動かすと中のアイデアも同じリクエストで動かす（manifests/nodes.md §3.5 Boxes）。
 */
export const positionsSchema = z
  .strictObject({
    nodes: z
      .array(positionItemSchema)
      .max(MAX_NODES_PER_TREE)
      .refine((items) => new Set(items.map((item) => item.id)).size === items.length, {
        message: "Each node ID may appear only once",
      })
      .default([]),
    groups: z
      .array(groupPositionSchema)
      .max(MAX_GROUPS_PER_TREE)
      .refine((items) => new Set(items.map((item) => item.id)).size === items.length, {
        message: "Each box ID may appear only once",
      })
      .default([]),
  })
  .refine((body) => body.nodes.length + body.groups.length > 0, {
    message: "Send at least one node or box",
  });
export type PositionsBody = z.infer<typeof positionsSchema>;

/** GET /api/trees/:id/nodes のクエリ。ids はカンマ区切りで、重複を除いてから 1〜100件 */
export const nodeDetailsQuerySchema = z.strictObject({
  ids: z
    .string()
    .transform((value) => [
      ...new Set(
        value
          .split(",")
          .map((id) => id.trim())
          .filter((id) => id !== ""),
      ),
    ])
    .pipe(z.array(z.string()).min(1).max(NODE_DETAILS_BATCH_MAX)),
});
export type NodeDetailsQuery = z.infer<typeof nodeDetailsQuerySchema>;
