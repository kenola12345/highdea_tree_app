import { createGroupSchema, idParamSchema, updateGroupSchema } from "@highdea/shared";
import type { RequestHandler } from "express";

import { currentUser } from "../middleware/auth.js";
import { getValidated } from "../middleware/validate.js";
import * as groupService from "../services/group.service.js";

/** POST /api/trees/:id/groups */
export const create: RequestHandler = async (req, res) => {
  const { id } = getValidated(req, "params", idParamSchema);
  const group = await groupService.create(
    currentUser(req).id,
    id,
    getValidated(req, "body", createGroupSchema),
  );
  res.status(201).json({ data: { group } });
};

/** PATCH /api/groups/:id */
export const update: RequestHandler = async (req, res) => {
  const { id } = getValidated(req, "params", idParamSchema);
  const group = await groupService.update(
    currentUser(req).id,
    id,
    getValidated(req, "body", updateGroupSchema),
  );
  res.status(200).json({ data: { group } });
};

/** DELETE /api/groups/:id */
export const remove: RequestHandler = async (req, res) => {
  const { id } = getValidated(req, "params", idParamSchema);
  await groupService.remove(currentUser(req).id, id);
  res.status(200).json({ data: null });
};
