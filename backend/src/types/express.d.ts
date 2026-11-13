import type { UserRole } from "@prisma/client";

declare module "express-serve-static-core" {
  interface Request {
    /** requireAuth / optionalAuth が DB から読み込んだログイン中のユーザー（ロールは毎回 DB の値） */
    user?: { id: string; role: UserRole };
    /** validate() が Zod で検証・変換した入力。コントローラーは req.body ではなくこちらを読む */
    validated?: { params?: unknown; query?: unknown; body?: unknown };
  }
}

export {};
