import express, { type Express } from "express";

/**
 * Express アプリを組み立てて返す（listen はしない）。
 * テストで Supertest から直接呼べるよう、起動処理は server.ts に分けている。
 */
export function createApp(): Express {
  const app = express();

  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ data: { ok: true } });
  });

  return app;
}
