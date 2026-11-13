import {
  createNodeSchema,
  idParamSchema,
  nodeDetailsQuerySchema,
  positionsSchema,
  updateNodeSchema,
} from "@highdea/shared";
import { Router } from "express";

import * as nodes from "../controllers/nodes.controller.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

// nodes のルート（app.ts で /api 配下にマウント済み）
export const nodesRouter = Router();

// 公開ツリーのノード詳細はゲストも見られるためログイン任意
nodesRouter.get(
  "/trees/:id/nodes",
  optionalAuth,
  validate({ params: idParamSchema, query: nodeDetailsQuerySchema }),
  nodes.details,
);
nodesRouter.post(
  "/trees/:id/nodes",
  requireAuth,
  validate({ params: idParamSchema, body: createNodeSchema }),
  nodes.create,
);
nodesRouter.patch(
  "/trees/:id/nodes/positions",
  requireAuth,
  validate({ params: idParamSchema, body: positionsSchema }),
  nodes.savePositions,
);
nodesRouter.patch(
  "/nodes/:id",
  requireAuth,
  validate({ params: idParamSchema, body: updateNodeSchema }),
  nodes.update,
);
nodesRouter.delete("/nodes/:id", requireAuth, validate({ params: idParamSchema }), nodes.remove);
