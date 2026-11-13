import { unlink } from "node:fs/promises";
import path from "node:path";

import cron, { type ScheduledTask } from "node-cron";

import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { uploadDir } from "../services/upload.service.js";

/** 毎日 4:30（サーバー時刻）。利用の少ない時間帯に実行する（manifests/common.md §3.10） */
export const CLEANUP_UPLOADS_SCHEDULE = "30 4 * * *";

/**
 * どのノードからも使われていない画像を、行とファイルの両方とも削除する。猶予期間はない（manifests/nodes.md uploads テーブル）。
 * 削除した件数を返す。
 */
export async function cleanupUploads(): Promise<{ deleted: number }> {
  const unused = await prisma.upload.findMany({
    where: { nodes: { none: {} } },
    select: { id: true, storageKey: true },
  });

  let deleted = 0;
  for (const upload of unused) {
    try {
      // 検索後にノードから使われ始めた画像は消さない（条件を付けて削除し、FK の RESTRICT でも守られる）
      const result = await prisma.upload.deleteMany({
        where: { id: upload.id, nodes: { none: {} } },
      });
      if (result.count === 0) continue;
    } catch (err) {
      logger.warn("skipped an upload that is now in use", { err, uploadId: upload.id });
      continue;
    }
    deleted++;
    await removeFile(upload.storageKey);
  }
  logger.info("uploads cleanup finished", { deleted });
  return { deleted };
}

/** 画像ファイルを消す。既に無い場合は何もしない */
async function removeFile(storageKey: string): Promise<void> {
  // storageKey はサーバーが生成した値だが、念のためディレクトリの外を指さないようファイル名部分だけ使う
  const filePath = path.join(uploadDir(), path.basename(storageKey));
  try {
    await unlink(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      logger.error("failed to remove upload file", { err, storageKey });
    }
  }
}

/** 削除ジョブを毎日実行するよう登録する（server.ts から呼ぶ） */
export function scheduleCleanupUploads(): ScheduledTask {
  return cron.schedule(
    CLEANUP_UPLOADS_SCHEDULE,
    async () => {
      try {
        await cleanupUploads();
      } catch (err) {
        logger.error("uploads cleanup failed", { err });
      }
    },
    { name: "cleanup-uploads", noOverlap: true },
  );
}
