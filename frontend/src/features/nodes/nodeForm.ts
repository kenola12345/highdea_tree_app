import type { NodeShape, NodeSkeleton, UpdateNodeBody } from "@highdea/shared";

export type NodeType = NodeSkeleton["type"];

/** ノード編集フォーム（M-04）の入力値 */
export type NodeFormValues = {
  type: NodeType;
  title: string;
  body: string;
  url: string;
  /** 新しくアップロードした画像（未変更なら null） */
  newUploadId: string | null;
  /** 枝の線の色（null は祖先の色を受け継ぐ） */
  lineColor: string | null;
  /** カードの色（null は既定の色） */
  cardColor: string | null;
  /** カードの形 */
  shape: NodeShape;
  /** カードの幅・高さ（null は既定の大きさ） */
  width: number | null;
  height: number | null;
  /** メモの文字の大きさ（null は既定） */
  fontSize: number | null;
  /** 文字の色（null は自動） */
  textColor: string | null;
  /** アイデアの種類（null は種類なし） */
  role: NodeSkeleton["role"];
};

export type BuildResult =
  { ok: true; body: UpdateNodeBody } | { ok: false; field: "url" | "image"; message: string };

/**
 * M-04 の入力から PATCH /api/nodes/:id の本文を組み立てる純粋関数。
 * 種類を変えても題名とメモは残す（manifests/nodes.md §3.5）。古い種類だけの項目（URL・画像）は送らず、サーバーが消す。
 * 新しい種類に必要な項目（LINK/VIDEO の URL、IMAGE の画像）が無ければエラーにする。
 */
export function buildUpdateBody(
  original: {
    type: NodeType;
    url: string | null;
    lineColor: string | null;
    cardColor: string | null;
    shape: NodeShape;
    width: number | null;
    height: number | null;
    fontSize: number | null;
    textColor: string | null;
    role: NodeSkeleton["role"];
  },
  values: NodeFormValues,
): BuildResult {
  const typeChanged = values.type !== original.type;
  const body: UpdateNodeBody = {
    title: values.title,
    body: values.body.trim() === "" ? null : values.body,
    ...(typeChanged && { type: values.type }),
    // 線の色は変えたときだけ送る
    ...(values.lineColor !== original.lineColor && { lineColor: values.lineColor }),
    ...(values.cardColor !== original.cardColor && { cardColor: values.cardColor }),
    // 形と大きさも変えたときだけ送る
    ...(values.shape !== original.shape && { shape: values.shape }),
    ...(values.width !== original.width && { width: values.width }),
    ...(values.height !== original.height && { height: values.height }),
    ...(values.fontSize !== original.fontSize && { fontSize: values.fontSize }),
    ...(values.textColor !== original.textColor && { textColor: values.textColor }),
    ...(values.role !== original.role && { role: values.role }),
  };
  if (values.type === "LINK" || values.type === "VIDEO") {
    const url = values.url.trim();
    if (!url) return { ok: false, field: "url", message: "Enter a URL" };
    if (typeChanged || url !== (original.url ?? "")) body.url = url;
  }
  if (values.type === "IMAGE") {
    if (values.newUploadId) body.imageUploadId = values.newUploadId;
    else if (typeChanged) return { ok: false, field: "image", message: "Upload an image" };
  }
  return { ok: true, body };
}
