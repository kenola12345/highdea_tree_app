import { linkPreviewSchema } from "@highdea/shared";
import { Router } from "express";

import * as linkPreview from "../controllers/linkPreview.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { linkPreviewLimiter } from "../middleware/rateLimits.js";
import { validate } from "../middleware/validate.js";

export const linkPreviewRouter = Router();

// ゲストには使わせない: 匿名でサーバーに外部ページを取得させないため（manifests/nodes.md）
linkPreviewRouter.post(
  "/link-preview",
  requireAuth,
  linkPreviewLimiter,
  validate({ body: linkPreviewSchema }),
  linkPreview.preview,
);
