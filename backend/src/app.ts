import path from "node:path";

import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express, type Router } from "express";
import helmet from "helmet";

import { env } from "./config/env.js";
import { apiNotFound, errorHandler } from "./middleware/errorHandler.js";
import { adminRouter } from "./routes/admin.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { categoriesRouter } from "./routes/categories.routes.js";
import { connectionsRouter } from "./routes/connections.routes.js";
import { exploreRouter } from "./routes/explore.routes.js";
import { linkPreviewRouter } from "./routes/linkPreview.routes.js";
import { nodesRouter } from "./routes/nodes.routes.js";
import { trashRouter } from "./routes/trash.routes.js";
import { treesRouter } from "./routes/trees.routes.js";
import { uploadsRouter } from "./routes/uploads.routes.js";
import { usersRouter } from "./routes/users.routes.js";

/** 各ルーターは /api からの完全なパス（例: /trees/:id/restore）を自分で宣言する */
const API_ROUTERS: Router[] = [
  authRouter,
  usersRouter,
  treesRouter,
  trashRouter,
  nodesRouter,
  connectionsRouter,
  categoriesRouter,
  exploreRouter,
  uploadsRouter,
  linkPreviewRouter,
  adminRouter,
];

type CreateAppOptions = {
  /** テスト専用: 本番ルートの後・404 とエラーハンドラーの前に追加するルーター */
  extraRouters?: Router[];
};

/**
 * Express アプリを組み立てて返す（listen はしない）。
 * テストで Supertest から直接呼べるよう、起動処理は server.ts に分けている。
 */
export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();

  app.use(helmet());
  // Cookie 認証のため credentials を許可する。origin は "*" にできないので環境変数で固定（standards/security.md §9.6）
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));

  // アップロード画像は推測できないファイル名の公開URLで配信する（manifests/nodes.md POST /api/uploads）
  app.use(
    "/uploads",
    express.static(path.resolve(env.UPLOAD_DIR), {
      index: false,
      dotfiles: "ignore",
      setHeaders: (res) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
      },
    }),
  );
  // 画像が無い場合は本文なしの 404（API ではないため共通エラー形式は使わない）
  app.use("/uploads", (_req, res) => {
    res.sendStatus(404);
  });

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ data: { ok: true } });
  });
  for (const router of [...API_ROUTERS, ...(options.extraRouters ?? [])]) {
    app.use("/api", router);
  }
  app.use("/api", apiNotFound);

  app.use(errorHandler);
  return app;
}
