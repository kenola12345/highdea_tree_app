// E2E 専用の環境。開発用（:3000 / :5173 / DB highdea）とは別のポートとDBを使い、開発データを変えない。
export const E2E_DB_URL = "postgresql://highdea:highdea@localhost:5432/highdea_e2e";
export const E2E_ADMIN_DB_URL = "postgresql://highdea:highdea@localhost:5432/highdea";
export const E2E_BACKEND_PORT = 3100;
export const E2E_FRONTEND_PORT = 5174;
export const E2E_BASE_URL = `http://localhost:${String(E2E_FRONTEND_PORT)}`;

/** E2E 用バックエンドに渡す環境変数（.env は読まないので必要なものをすべて渡す） */
export const E2E_BACKEND_ENV = {
  DATABASE_URL: E2E_DB_URL,
  JWT_SECRET: "e2e-only-secret-that-is-at-least-32-characters-long",
  PORT: String(E2E_BACKEND_PORT),
  NODE_ENV: "development",
  CORS_ORIGIN: E2E_BASE_URL,
  UPLOAD_DIR: "./tests/.uploads-e2e",
};

/** シードの共通パスワード（backend/prisma/seed.ts） */
export const SEED_PASSWORD = "password123";
