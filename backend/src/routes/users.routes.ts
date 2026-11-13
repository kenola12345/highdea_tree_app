import {
  changePasswordSchema,
  deactivateSchema,
  paginationQuerySchema,
  updateAccountSchema,
  updateProfileSchema,
  usernameParamSchema,
} from "@highdea/shared";
import { Router } from "express";

import * as users from "../controllers/users.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { passwordCheckLimiter } from "../middleware/rateLimits.js";
import { validate } from "../middleware/validate.js";

// ユーザーのルート（app.ts で /api 配下にマウント済み）
export const usersRouter = Router();

// /users/me* を /users/:username より先に登録する（"me" がユーザー名として扱われないように）
usersRouter.patch(
  "/users/me",
  requireAuth,
  validate({ body: updateProfileSchema }),
  users.updateProfile,
);

// パスワード確認がある3つは requireAuth の後に制限を置く（ユーザー単位で誤りを数えるため）
usersRouter.patch(
  "/users/me/account",
  requireAuth,
  passwordCheckLimiter,
  validate({ body: updateAccountSchema }),
  users.updateAccount,
);
usersRouter.patch(
  "/users/me/password",
  requireAuth,
  passwordCheckLimiter,
  validate({ body: changePasswordSchema }),
  users.changePassword,
);
usersRouter.post(
  "/users/me/deactivate",
  requireAuth,
  passwordCheckLimiter,
  validate({ body: deactivateSchema }),
  users.deactivate,
);

usersRouter.get(
  "/users/:username",
  validate({ params: usernameParamSchema, query: paginationQuerySchema }),
  users.getProfile,
);
