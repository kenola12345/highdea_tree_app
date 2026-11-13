import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { ALLOWED_IMAGE_TYPES, type UploadResponse } from "@highdea/shared";
import type { Upload } from "@prisma/client";
import { fileTypeFromBuffer } from "file-type";

import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";

/** 受け取ったファイル（Multer のメモリ保存の結果のうち使う項目だけ） */
export type IncomingFile = { buffer: Buffer; originalname: string; size: number };

/** uploads.original_name の列の長さ */
const ORIGINAL_NAME_MAX = 255;

/** 保存先ディレクトリの絶対パス */
export function uploadDir(): string {
  return path.resolve(env.UPLOAD_DIR);
}

/** アップロード画像の公開URL（app.ts が /uploads で配信している） */
export function uploadUrl(storageKey: string): string {
  return `/uploads/${storageKey}`;
}

/** DB の行を API のレスポンス形式にする */
export function toUploadResponse(upload: Upload): UploadResponse {
  return {
    id: upload.id,
    url: uploadUrl(upload.storageKey),
    originalName: upload.originalName,
    mimeType: upload.mimeType,
    sizeBytes: upload.sizeBytes,
    createdAt: upload.createdAt.toISOString(),
  };
}

/**
 * ファイルの先頭バイトから実際の形式を判定する。PNG・JPEG・WebP・GIF 以外は 415 UNSUPPORTED_FILE_TYPE。
 * ファイル名やブラウザが送った Content-Type は偽装できるため使わない（manifests/nodes.md POST /api/uploads）。
 */
async function detectImageType(buffer: Buffer): Promise<{ mime: string; ext: string }> {
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected) throw new AppError("UNSUPPORTED_FILE_TYPE");
  // アニメーション PNG は PNG としてそのまま表示できるため、PNG として扱う
  if (detected.mime === "image/apng") return { mime: "image/png", ext: "png" };
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(detected.mime)) {
    throw new AppError("UNSUPPORTED_FILE_TYPE");
  }
  return { mime: detected.mime, ext: detected.ext };
}

/**
 * 画像を保存し、uploads の行を作る。
 * 保存名は推測できない randomUUID + 拡張子（公開URLになるため。manifests/nodes.md uploads テーブル）。
 * 行の作成に失敗したら書き込んだファイルを消す。
 */
export async function save(userId: string, file: IncomingFile): Promise<UploadResponse> {
  const { mime, ext } = await detectImageType(file.buffer);
  const storageKey = `${randomUUID()}.${ext}`;
  const dir = uploadDir();
  const filePath = path.join(dir, storageKey);

  await mkdir(dir, { recursive: true });
  await writeFile(filePath, file.buffer, { flag: "wx" });
  try {
    const upload = await prisma.upload.create({
      data: {
        ownerId: userId,
        storageKey,
        // 元のファイル名はデータとして保存するだけで、パスには使わない
        originalName: Array.from(file.originalname).slice(0, ORIGINAL_NAME_MAX).join(""),
        mimeType: mime,
        sizeBytes: file.size,
      },
    });
    return toUploadResponse(upload);
  } catch (err) {
    await unlink(filePath).catch((unlinkErr: unknown) => {
      logger.error("failed to remove upload file after a DB error", { err: unlinkErr, storageKey });
    });
    throw err;
  }
}
