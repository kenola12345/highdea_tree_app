import { MAX_UPLOAD_BYTES, UPLOAD_FIELD_NAME } from "@highdea/shared";
import type { RequestHandler } from "express";
import multer from "multer";

import { AppError } from "../errors/AppError.js";

// ディスクではなくメモリに受け取る: 保存前に中身で形式を確認し、保存名もサーバー側で決めるため（standards/security.md §9.4）
const single = multer({
  storage: multer.memoryStorage(),
  // 5 MB 超は Multer が LIMIT_FILE_SIZE を投げ、errorHandler が 413 FILE_TOO_LARGE にする（manifests/nodes.md）
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 0 },
  // 日本語などのファイル名を文字化けさせないため（Multer の既定は latin1）
  defParamCharset: "utf8",
}).single(UPLOAD_FIELD_NAME);

/**
 * "file" フィールドの画像を1つだけ受け取る。
 * ファイルなし・multipart 以外は 400 VALIDATION_ERROR（複数ファイル・別フィールドは Multer のエラーで 400 になる）。
 */
export const upload: RequestHandler = (req, res, next) => {
  single(req, res, (err: unknown) => {
    if (err) {
      next(err);
      return;
    }
    if (!req.file) {
      next(new AppError("VALIDATION_ERROR", 'Send exactly one image file in the "file" field'));
      return;
    }
    next();
  });
};
