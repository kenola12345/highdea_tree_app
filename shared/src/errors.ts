// エラーコードと HTTP ステータスの対応表（manifests/common.md「Error Codes」）。
// 同じコードは常に同じステータスで返すため、ステータスはここからのみ決める。

export const ERROR_STATUS = {
  URL_NOT_ALLOWED: 400,
  USERNAME_RESERVED: 400,
  VALIDATION_ERROR: 400,
  INVALID_CREDENTIALS: 401,
  UNAUTHENTICATED: 401,
  ALREADY_AUTHENTICATED: 403,
  FORBIDDEN: 403,
  WRONG_PASSWORD: 403,
  CATEGORY_NOT_FOUND: 404,
  CONNECTION_NOT_FOUND: 404,
  NODE_NOT_FOUND: 404,
  PARENT_NOT_FOUND: 404,
  ROUTE_NOT_FOUND: 404,
  TREE_NOT_FOUND: 404,
  UPLOAD_NOT_FOUND: 404,
  USER_NOT_FOUND: 404,
  CANNOT_DELETE_ROOT: 409,
  CATEGORY_LIMIT_REACHED: 409,
  CATEGORY_NAME_TAKEN: 409,
  CONNECTION_LIMIT_REACHED: 409,
  EMAIL_TAKEN: 409,
  INVALID_CONNECTION: 409,
  INVALID_MOVE: 409,
  NODE_LIMIT_REACHED: 409,
  TREE_ALREADY_REMOVED: 409,
  TREE_NOT_IN_TRASH: 409,
  TREE_REMOVED: 409,
  USERNAME_TAKEN: 409,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_FILE_TYPE: 415,
  PREVIEW_UNAVAILABLE: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

/** VALIDATION_ERROR の details に入るフィールド単位のエラー */
export type FieldError = { field: string; message: string };

/** 失敗時のレスポンス本体 */
export type ApiErrorBody = {
  error: { code: ErrorCode; message: string; details?: FieldError[] };
};

/** 成功時のレスポンス本体 */
export type ApiSuccessBody<T> = { data: T };
