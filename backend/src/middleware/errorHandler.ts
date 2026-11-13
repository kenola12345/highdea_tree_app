import type { ApiErrorBody } from "@highdea/shared";
import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";

import { AppError } from "../errors/AppError.js";
import { logger } from "../lib/logger.js";

/** どのエンドポイントにも一致しない /api のリクエストを 404 ROUTE_NOT_FOUND にする */
export const apiNotFound: RequestHandler = () => {
  throw new AppError("ROUTE_NOT_FOUND");
};

/**
 * すべてのエラーを共通エラー形式 { error: { code, message, details? } } に変換する。
 * 想定外のエラーは中身をログにだけ残し、利用者には 500 の汎用メッセージを返す（内部情報を漏らさないため）。
 */
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  const appError = toAppError(err);
  if (!appError) {
    logger.error("unhandled error", {
      err,
      method: req.method,
      path: req.path,
      userId: req.user?.id,
    });
  }
  const { code, message, details, status } = appError ?? new AppError("INTERNAL_ERROR");
  const body: ApiErrorBody = { error: { code, message, ...(details && { details }) } };
  res.status(status).json(body);
};

/** 既知のエラー（AppError・Multer・JSON 解析失敗）を AppError に変換する。未知なら null */
function toAppError(err: unknown): AppError | null {
  if (err instanceof AppError) return err;
  if (err instanceof multer.MulterError) {
    // 5 MB 超（manifests/nodes.md POST /api/uploads）。それ以外のMulterエラーはファイル指定の誤り
    return err.code === "LIMIT_FILE_SIZE"
      ? new AppError("FILE_TOO_LARGE")
      : new AppError("VALIDATION_ERROR", 'Send exactly one image file in the "file" field');
  }
  if (isBodyParserError(err)) {
    return new AppError(
      "VALIDATION_ERROR",
      err.type === "entity.too.large"
        ? "The request body is too large"
        : "The request body isn't valid JSON",
    );
  }
  return null;
}

/** express.json() が投げるエラーかどうか（type プロパティで判別できる） */
function isBodyParserError(err: unknown): err is { type: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "type" in err &&
    (err.type === "entity.parse.failed" || err.type === "entity.too.large")
  );
}
