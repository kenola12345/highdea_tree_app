import {
  createTreeSchema,
  idParamSchema,
  listTreesQuerySchema,
  updateTreeSchema,
} from "@highdea/shared";
import { Router } from "express";

import * as trees from "../controllers/trees.controller.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

// trees のルート（app.ts で /api 配下にマウント済み）。復元は trash.routes.ts に置く
export const treesRouter = Router();

treesRouter.get("/trees", requireAuth, validate({ query: listTreesQuerySchema }), trees.list);
treesRouter.post("/trees", requireAuth, validate({ body: createTreeSchema }), trees.create);
// 公開ツリーはゲストも見られるためログイン任意
treesRouter.get("/trees/:id", optionalAuth, validate({ params: idParamSchema }), trees.detail);
treesRouter.patch(
  "/trees/:id",
  requireAuth,
  validate({ params: idParamSchema, body: updateTreeSchema }),
  trees.update,
);
treesRouter.delete("/trees/:id", requireAuth, validate({ params: idParamSchema }), trees.remove);
