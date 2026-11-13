import { exploreCategoriesQuerySchema, exploreQuerySchema } from "@highdea/shared";
import { Router } from "express";

import * as explore from "../controllers/explore.controller.js";
import { validate } from "../middleware/validate.js";

// ログイン不要。返すのは常に公開ツリーだけなので、閲覧者を区別する認証は付けない（manifests/explore.md）
export const exploreRouter = Router();

exploreRouter.get("/explore", validate({ query: exploreQuerySchema }), explore.list);
exploreRouter.get(
  "/explore/categories",
  validate({ query: exploreCategoriesQuerySchema }),
  explore.categories,
);
