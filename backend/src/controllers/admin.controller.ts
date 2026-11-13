import { idParamSchema, removeTreeSchema } from "@highdea/shared";
import type { RequestHandler } from "express";

import { currentUser } from "../middleware/auth.js";
import { getValidated } from "../middleware/validate.js";
import * as adminService from "../services/admin.service.js";

/** POST /api/admin/trees/:id/remove */
export const removeTree: RequestHandler = async (req, res) => {
  const { id } = getValidated(req, "params", idParamSchema);
  const { reason } = getValidated(req, "body", removeTreeSchema);
  const tree = await adminService.removeTree(currentUser(req).id, id, reason);
  res.status(200).json({ data: { tree } });
};
