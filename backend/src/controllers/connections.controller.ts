import { createConnectionSchema, idParamSchema } from "@highdea/shared";
import type { RequestHandler } from "express";

import { currentUser } from "../middleware/auth.js";
import { getValidated } from "../middleware/validate.js";
import * as connectionService from "../services/connection.service.js";

/** POST /api/trees/:id/connections */
export const create: RequestHandler = async (req, res) => {
  const { id } = getValidated(req, "params", idParamSchema);
  const connection = await connectionService.create(
    currentUser(req).id,
    id,
    getValidated(req, "body", createConnectionSchema),
  );
  res.status(201).json({ data: { connection } });
};

/** DELETE /api/connections/:id */
export const remove: RequestHandler = async (req, res) => {
  const { id } = getValidated(req, "params", idParamSchema);
  await connectionService.remove(currentUser(req).id, id);
  res.status(200).json({ data: null });
};
