import { idParamSchema, paginationQuerySchema } from "@highdea/shared";
import { Router } from "express";

import * as trash from "../controllers/trash.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

// trash のルート（app.ts で /api 配下にマウント済み）
export const trashRouter = Router();

trashRouter.get("/trash", requireAuth, validate({ query: paginationQuerySchema }), trash.list);
trashRouter.delete("/trash", requireAuth, trash.empty);
trashRouter.delete(
  "/trash/:id",
  requireAuth,
  validate({ params: idParamSchema }),
  trash.deleteForever,
);
trashRouter.post(
  "/trees/:id/restore",
  requireAuth,
  validate({ params: idParamSchema }),
  trash.restore,
);
