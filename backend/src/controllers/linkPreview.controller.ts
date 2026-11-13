import { linkPreviewSchema } from "@highdea/shared";
import type { RequestHandler } from "express";

import { getValidated } from "../middleware/validate.js";
import * as linkPreviewService from "../services/linkPreview.service.js";

/** POST /api/link-preview: ページのタイトル・説明・画像を返す（保存はしない） */
export const preview: RequestHandler = async (req, res) => {
  const { url } = getValidated(req, "body", linkPreviewSchema);
  const preview = await linkPreviewService.getPreview(url);
  res.status(200).json({ data: { preview } });
};
