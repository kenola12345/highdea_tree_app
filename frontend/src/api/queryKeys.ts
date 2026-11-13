// TanStack Query のキーはすべてここで作る。画面ごとに配列を直書きしない（standards/frontend.md §2.3）。
// 先頭要素（"trees" など）は manifests/common.md §4 のキャッシュ無効化ルールと一致させる。

export type TreeListParams = { page: number; categoryId?: string };
export type ExploreParams = { page: number; q?: string; category?: string };

export const queryKeys = {
  me: ["me"] as const,
  trees: (params?: TreeListParams) => ["trees", params ?? {}] as const,
  tree: (id: string) => ["tree", id] as const,
  nodeDetails: (treeId: string, nodeId: string) => ["nodeDetails", treeId, nodeId] as const,
  trash: (page = 1) => ["trash", page] as const,
  categories: ["categories"] as const,
  explore: (params: ExploreParams) => ["explore", params] as const,
  exploreCategories: (q?: string) => ["exploreCategories", q ?? ""] as const,
  user: (username: string, page = 1) => ["user", username.toLowerCase(), page] as const,
};
