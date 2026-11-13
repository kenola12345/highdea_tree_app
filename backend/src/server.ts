import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { scheduleCleanupUploads } from "./jobs/cleanupUploads.js";
import { schedulePurgeTrash } from "./jobs/purgeTrash.js";
import { logger } from "./lib/logger.js";

const app = createApp();

app.listen(env.PORT, () => {
  logger.info("server started", { url: `http://localhost:${String(env.PORT)}` });
});

// 日次ジョブ（manifests/common.md §3.10）。テスト中はサーバーを起動しないが、念のため test では登録しない
if (env.NODE_ENV !== "test") {
  schedulePurgeTrash();
  scheduleCleanupUploads();
  logger.info("daily jobs scheduled", { jobs: ["purgeTrash", "cleanupUploads"] });
}
