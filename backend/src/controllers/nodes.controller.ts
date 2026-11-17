import {
  createNodeSchema,
  idParamSchema,
  nodeDetailsQuerySchema,
  positionsSchema,
  updateNodeSchema,
} from "@highdea/shared";
import type { RequestHandler } from "express";

import { currentUser } from "../middleware/auth.js";
import { getValidated } from "../middleware/validate.js";
import * as nodeService from "../services/node.service.js";

/** GET /api/trees/:id/nodes: ノード詳細の一括取得。ログイン任意でゲストは undefined として扱う */
export const details: RequestHandler = async (req, res) => {
  const { id } = getValidated(req, "params", idParamSchema);
  const { ids } = getValidated(req, "query", nodeDetailsQuerySchema);
  const data = await nodeService.getDetails(req.user?.id, id, ids);
  res.status(200).json({ data });
};

/** POST /api/trees/:id/nodes */
export const create: RequestHandler = async (req, res) => {
  const { id } = getValidated(req, "params", idParamSchema);
  const node = await nodeService.create(
    currentUser(req).id,
    id,
    getValidated(req, "body", createNodeSchema),
  );
  res.status(201).json({ data: { node } });
};

/** PATCH /api/nodes/:id */
export const update: RequestHandler = async (req, res) => {
  const { id } = getValidated(req, "params", idParamSchema);
  const node = await nodeService.update(
    currentUser(req).id,
    id,
    getValidated(req, "body", updateNodeSchema),
  );
  res.status(200).json({ data: { node } });
};

/** PATCH /api/trees/:id/nodes/positions */
export const savePositions: RequestHandler = async (req, res) => {
  const { id } = getValidated(req, "params", idParamSchema);
  const { nodes, groups } = getValidated(req, "body", positionsSchema);
  const data = await nodeService.savePositions(currentUser(req).id, id, nodes, groups);
  res.status(200).json({ data });
};

/** DELETE /api/nodes/:id: 枝ごと完全に削除する */
export const remove: RequestHandler = async (req, res) => {
  const { id } = getValidated(req, "params", idParamSchema);
  const data = await nodeService.remove(currentUser(req).id, id);
  res.status(200).json({ data });
};
