import { execSync } from "node:child_process";
import path from "node:path";

import pg from "pg";

import { E2E_ADMIN_DB_URL, E2E_BACKEND_ENV } from "./env";

const backendDir = path.resolve(import.meta.dirname, "../../../backend");

/**
 * E2E の準備: 専用DB（highdea_e2e）がなければ作り、マイグレーションを当て、全テーブルを空にしてからシードを入れる。
 * 開発DBには一切触れない。
 */
export default async function globalSetup(): Promise<void> {
  const admin = new pg.Client({ connectionString: E2E_ADMIN_DB_URL });
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = 'highdea_e2e'");
  if (exists.rowCount === 0) await admin.query("CREATE DATABASE highdea_e2e");
  await admin.end();

  const env = { ...process.env, ...E2E_BACKEND_ENV };
  execSync("npx --no-install prisma migrate deploy", { cwd: backendDir, env, stdio: "pipe" });

  const db = new pg.Client({ connectionString: E2E_BACKEND_ENV.DATABASE_URL });
  await db.connect();
  await db.query(
    'TRUNCATE TABLE "tree_categories", "nodes", "uploads", "categories", "trees", "users" CASCADE',
  );
  await db.end();
}
