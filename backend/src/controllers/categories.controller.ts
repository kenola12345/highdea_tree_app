import { createCategorySchema, idParamSchema, updateCategorySchema } from "@highdea/shared";
import type { RequestHandler } from "express";

import { currentUser } from "../middleware/auth.js";
import { getValidated } from "../middleware/validate.js";
import * as categoryService from "../services/category.service.js";

/** GET /api/categories */
export const list: RequestHandler = async (req, res) => {
  const categories = await categoryService.list(currentUser(req).id);
  res.status(200).json({ data: { categories } });
};

/** POST /api/categories */
export const create: RequestHandler = async (req, res) => {
  const category = await categoryService.create(
    currentUser(req).id,
    getValidated(req, "body", createCategorySchema),
  );
  res.status(201).json({ data: { category } });
};

/** PATCH /api/categories/:id */
export const update: RequestHandler = async (req, res) => {
  const { id } = getValidated(req, "params", idParamSchema);
  const category = await categoryService.update(
    currentUser(req).id,
    id,
    getValidated(req, "body", updateCategorySchema),
  );
  res.status(200).json({ data: { category } });
};

/** DELETE /api/categories/:id */
export const remove: RequestHandler = async (req, res) => {
  const { id } = getValidated(req, "params", idParamSchema);
  await categoryService.remove(currentUser(req).id, id);
  res.status(200).json({ data: null });
};
