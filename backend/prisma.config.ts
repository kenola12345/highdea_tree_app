import { existsSync } from "node:fs";

import { defineConfig, env } from "prisma/config";

// Prisma 7 は .env を自動で読まないため、Node 標準の loadEnvFile で読み込む（無ければ環境変数をそのまま使う）
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --env-file-if-exists=.env prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
