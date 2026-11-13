import { idParamSchema, removeTreeSchema } from "@highdea/shared";
import { Router } from "express";

import * as admin from "../controllers/admin.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { validate } from "../middleware/validate.js";

export const adminRouter = Router();

adminRouter.post(
  "/admin/trees/:id/remove",
  requireAuth,
  requireAdmin,
  validate({ params: idParamSchema, body: removeTreeSchema }),
  admin.removeTree,
);
