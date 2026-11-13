import { Router } from "express";

import * as uploads from "../controllers/uploads.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { uploadLimiter } from "../middleware/rateLimits.js";
import { upload } from "../middleware/upload.js";

export const uploadsRouter = Router();

// 制限を Multer より先に置く: 上限超過のリクエストの本文（最大 5 MB）をメモリに読み込まないため
uploadsRouter.post("/uploads", requireAuth, uploadLimiter, upload, uploads.create);
