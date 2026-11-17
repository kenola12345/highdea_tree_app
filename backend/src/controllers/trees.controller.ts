import {
  createTreeSchema,
  idParamSchema,
  listTreesQuerySchema,
  updateTreeCanvasSchema,
  updateTreeSchema,
} from "@highdea/shared";
import type { RequestHandler } from "express";

import { currentUser } from "../middleware/auth.js";
import { getValidated } from "../middleware/validate.js";
import * as treeService from "../services/tree.service.js";

/** GET /api/trees: マイツリー一覧 */
export const list: RequestHandler = async (req, res) => {
  const data = await treeService.listMine(
    currentUser(req).id,
    getValidated(req, "query", listTreesQuerySchema),
  );
  res.status(200).json({ data });
};

/** POST /api/trees: ツリーとルートノードを作る */
export const create: RequestHandler = async (req, res) => {
  const data = await treeService.create(
    currentUser(req).id,
    getValidated(req, "body", createTreeSchema),
  );
  res.status(201).json({ data });
};

/** GET /api/trees/:id: ログイン任意。ゲストは undefined として扱う */
export const detail: RequestHandler = async (req, res) => {
  const { id } = getValidated(req, "params", idParamSchema);
  const data = await treeService.getDetail(req.user?.id, id);
  res.status(200).json({ data });
};

/** PATCH /api/trees/:id */
export const update: RequestHandler = async (req, res) => {
  const { id } = getValidated(req, "params", idParamSchema);
  const tree = await treeService.update(
    currentUser(req).id,
    id,
    getValidated(req, "body", updateTreeSchema),
  );
  res.status(200).json({ data: { tree } });
};

/** PATCH /api/trees/:id/canvas: キャンバスの見た目 */
export const updateCanvas: RequestHandler = async (req, res) => {
  const { id } = getValidated(req, "params", idParamSchema);
  const canvas = await treeService.updateCanvas(
    currentUser(req).id,
    id,
    getValidated(req, "body", updateTreeCanvasSchema),
  );
  res.status(200).json({ data: { canvas } });
};

/** DELETE /api/trees/:id: ゴミ箱に移す */
export const remove: RequestHandler = async (req, res) => {
  const { id } = getValidated(req, "params", idParamSchema);
  await treeService.moveToTrash(currentUser(req).id, id);
  res.status(200).json({ data: null });
};
