import cron, { type ScheduledTask } from "node-cron";

import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { purgeCutoff } from "../services/trash.service.js";

/** 毎日 3:00 に実行する。画像の掃除ジョブと同じく利用の少ない時間帯にする */
const PURGE_SCHEDULE = "0 3 * * *";

/**
 * ゴミ箱に入って保持日数（10日）を過ぎたツリーを完全削除し、削除件数を返す（manifests/common.md §3.10）。
 * ノードとカテゴリタグは DB の ON DELETE CASCADE で一緒に消える。使われなくなった画像は画像の掃除ジョブが消す。
 */
export async function purgeTrash(now: Date = new Date()): Promise<number> {
  const { count } = await prisma.tree.deleteMany({
    where: { deletedAt: { lt: purgeCutoff(now) } },
  });
  logger.info("purged trees from the Trash", { count });
  return count;
}

/** purgeTrash を毎日実行するよう登録する（server.ts から呼ぶ） */
export function schedulePurgeTrash(): ScheduledTask {
  return cron.schedule(PURGE_SCHEDULE, async () => {
    // 失敗しても次の日に再実行されるため、ログに残してプロセスは止めない
    try {
      await purgeTrash();
    } catch (err) {
      logger.error("trash purge failed", { err });
    }
  });
}
