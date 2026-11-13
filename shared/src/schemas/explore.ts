import { z } from "zod";

import { CATEGORY_NAME_MAX, PAGE_LIMIT_DEFAULT, PAGE_LIMIT_MAX } from "../constants.js";
import { paginationQueryShape } from "./common.js";

/** Explore の検索文字列の上限（manifests/explore.md GET /api/explore） */
export const EXPLORE_QUERY_MAX = 100;

/**
 * GET /api/explore のクエリ。
 * category はカテゴリの name_key と照合するため小文字化する（他ユーザーの同名カテゴリも大文字小文字を無視して一致させる）。
 */
export const exploreQuerySchema = z.strictObject({
  q: z.string().trim().min(1).max(EXPLORE_QUERY_MAX).optional(),
  category: z.string().trim().toLowerCase().min(1).max(CATEGORY_NAME_MAX).optional(),
  ...paginationQueryShape,
});
export type ExploreQuery = z.infer<typeof exploreQuerySchema>;

/** GET /api/explore/categories のクエリ。q は name_key の前方一致に使うため小文字化する */
export const exploreCategoriesQuerySchema = z.strictObject({
  q: z.string().trim().toLowerCase().min(1).max(CATEGORY_NAME_MAX).optional(),
  limit: z.coerce.number().int().min(1).max(PAGE_LIMIT_MAX).default(PAGE_LIMIT_DEFAULT),
});
export type ExploreCategoriesQuery = z.infer<typeof exploreCategoriesQuerySchema>;
