import { env } from "../../src/config/env.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetRateLimits } from "../../src/middleware/rateLimits.js";

/**
 * テスト用DBの全テーブルを空にし、レート制限のカウンターも初期化する。各テストファイルの beforeEach で呼ぶ。
 * 開発DBを誤って消さないよう、DB名が highdea_test（または highdea_test_<名前>）でなければ実行しない。
 */
export async function resetDb(): Promise<void> {
  // 並列開発用に highdea_test_<名前> のDBも許可する
  if (!/^\/highdea_test(_\w+)?$/.test(new URL(env.DATABASE_URL).pathname)) {
    throw new Error(`Refusing to reset a non-test database: ${env.DATABASE_URL}`);
  }
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "tree_categories", "node_connections", "nodes", "uploads", "categories", "trees", "users" CASCADE',
  );
  await resetRateLimits();
}

export { prisma };
