import { createCategorySchema, idParamSchema, updateCategorySchema } from "@highdea/shared";
import { Router } from "express";

import * as categories from "../controllers/categories.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

// カテゴリはすべてログイン必須で、本人のものだけを扱う（manifests/trees.md Authorization）
export const categoriesRouter = Router();

categoriesRouter.get("/categories", requireAuth, categories.list);
categoriesRouter.post(
  "/categories",
  requireAuth,
  validate({ body: createCategorySchema }),
  categories.create,
);
categoriesRouter.patch(
  "/categories/:id",
  requireAuth,
  validate({ params: idParamSchema, body: updateCategorySchema }),
  categories.update,
);
categoriesRouter.delete(
  "/categories/:id",
  requireAuth,
  validate({ params: idParamSchema }),
  categories.remove,
);
