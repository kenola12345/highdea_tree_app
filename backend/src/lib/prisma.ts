import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { env } from "../config/env.js";

// Prisma 7 はドライバアダプタ経由で接続する（manifests/common.md §7.2）
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

/** アプリ全体で共有する唯一の PrismaClient。リクエストごとに作ると接続プールが増え続けるため使い回す。 */
export const prisma = new PrismaClient({
  adapter,
  log: env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["warn", "error"],
});
