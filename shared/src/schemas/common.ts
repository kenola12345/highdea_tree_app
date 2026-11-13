import { z } from "zod";

import { PAGE_DEFAULT, PAGE_LIMIT_DEFAULT, PAGE_LIMIT_MAX } from "../constants.js";

/**
 * パスパラメータ :id。
 * 形式チェックはしない: 仕様上、存在しないIDは 400 ではなく 404（〜_NOT_FOUND）で返すため、
 * 不正な文字列もそのまま検索させて「見つからない」として扱う。
 */
export const idParamSchema = z.strictObject({ id: z.string().min(1) });

/** パスパラメータ :username。小文字化してから検索する（manifests/users.md GET /api/users/:username） */
export const usernameParamSchema = z.strictObject({
  username: z.string().trim().toLowerCase().min(1),
});

/** ページング用クエリ（manifests/common.md「Pagination」）。各一覧のクエリスキーマに展開して使う */
export const paginationQueryShape = {
  page: z.coerce.number().int().min(1).default(PAGE_DEFAULT),
  limit: z.coerce.number().int().min(1).max(PAGE_LIMIT_MAX).default(PAGE_LIMIT_DEFAULT),
};

export const paginationQuerySchema = z.strictObject(paginationQueryShape);
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
