import { createGroupSchema, idParamSchema, updateGroupSchema } from "@highdea/shared";
import { Router } from "express";

import * as groups from "../controllers/groups.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

// ボックスのルート（app.ts で /api 配下にマウント済み）
export const groupsRouter = Router();

groupsRouter.post(
  "/trees/:id/groups",
  requireAuth,
  validate({ params: idParamSchema, body: createGroupSchema }),
  groups.create,
);
groupsRouter.patch(
  "/groups/:id",
  requireAuth,
  validate({ params: idParamSchema, body: updateGroupSchema }),
  groups.update,
);
groupsRouter.delete("/groups/:id", requireAuth, validate({ params: idParamSchema }), groups.remove);
