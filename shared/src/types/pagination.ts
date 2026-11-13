/** ページング付き一覧の data.pagination（manifests/common.md「Pagination」）。ページ数は ceil(total / limit) */
export type Pagination = { page: number; limit: number; total: number };
