import { idParamSchema, paginationQuerySchema } from "@highdea/shared";
import type { RequestHandler } from "express";

import { currentUser } from "../middleware/auth.js";
import { getValidated } from "../middleware/validate.js";
import * as trashService from "../services/trash.service.js";

/** GET /api/trash: 自分のゴミ箱 */
export const list: RequestHandler = async (req, res) => {
  const { page, limit } = getValidated(req, "query", paginationQuerySchema);
  const data = await trashService.list(currentUser(req).id, page, limit);
  res.status(200).json({ data });
};

/** POST /api/trees/:id/restore */
export const restore: RequestHandler = async (req, res) => {
  const { id } = getValidated(req, "params", idParamSchema);
  const tree = await trashService.restore(currentUser(req).id, id);
  res.status(200).json({ data: { tree } });
};

/** DELETE /api/trash/:id: ゴミ箱のツリーを完全削除 */
export const deleteForever: RequestHandler = async (req, res) => {
  const { id } = getValidated(req, "params", idParamSchema);
  await trashService.deleteForever(currentUser(req).id, id);
  res.status(200).json({ data: null });
};

/** DELETE /api/trash: ゴミ箱を空にする */
export const empty: RequestHandler = async (req, res) => {
  const deletedCount = await trashService.empty(currentUser(req).id);
  res.status(200).json({ data: { deletedCount } });
};
