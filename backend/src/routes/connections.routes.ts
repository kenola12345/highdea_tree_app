import { createConnectionSchema, idParamSchema, updateConnectionSchema } from "@highdea/shared";
import { Router } from "express";

import * as connections from "../controllers/connections.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

// アイデア同士のつながりのルート（app.ts で /api 配下にマウント済み）
export const connectionsRouter = Router();

connectionsRouter.post(
  "/trees/:id/connections",
  requireAuth,
  validate({ params: idParamSchema, body: createConnectionSchema }),
  connections.create,
);
connectionsRouter.patch(
  "/connections/:id",
  requireAuth,
  validate({ params: idParamSchema, body: updateConnectionSchema }),
  connections.update,
);
connectionsRouter.delete(
  "/connections/:id",
  requireAuth,
  validate({ params: idParamSchema }),
  connections.remove,
);
