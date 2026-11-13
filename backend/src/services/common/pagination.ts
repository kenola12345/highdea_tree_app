import type { Pagination } from "@highdea/shared";

/** page / limit（1始まり）を Prisma の skip / take に変換する */
export function toSkipTake(page: number, limit: number): { skip: number; take: number } {
  return { skip: (page - 1) * limit, take: limit };
}

/** レスポンスの data.pagination を作る（manifests/common.md「Pagination」） */
export function toPagination(page: number, limit: number, total: number): Pagination {
  return { page, limit, total };
}
