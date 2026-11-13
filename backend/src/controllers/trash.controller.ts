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
