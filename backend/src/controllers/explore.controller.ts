import { exploreCategoriesQuerySchema, exploreQuerySchema } from "@highdea/shared";
import type { RequestHandler } from "express";

import { getValidated } from "../middleware/validate.js";
import * as exploreService from "../services/explore.service.js";

/** GET /api/explore */
export const list: RequestHandler = async (req, res) => {
  const data = await exploreService.list(getValidated(req, "query", exploreQuerySchema));
  res.status(200).json({ data });
};

/** GET /api/explore/categories */
export const categories: RequestHandler = async (req, res) => {
  const data = await exploreService.categories(
    getValidated(req, "query", exploreCategoriesQuerySchema),
  );
  res.status(200).json({ data });
};
