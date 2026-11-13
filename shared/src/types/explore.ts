import type { Pagination } from "./pagination.js";
import type { ExploreTreeItem } from "./tree.js";

/** GET /api/explore の data */
export type ExploreListResponse = { trees: ExploreTreeItem[]; pagination: Pagination };

/** GET /api/explore/categories の1件。key は ?category= に渡す小文字の名前、name は表示用 */
export type ExploreCategoryItem = { key: string; name: string; treeCount: number };

/** GET /api/explore/categories の data */
export type ExploreCategoriesResponse = { categories: ExploreCategoryItem[] };
