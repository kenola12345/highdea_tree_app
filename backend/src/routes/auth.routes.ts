import { loginSchema, signupSchema } from "@highdea/shared";
import { Router } from "express";

import * as auth from "../controllers/auth.controller.js";
import { guestOnly, requireAuth } from "../middleware/auth.js";
import { loginLimiter, signupLimiter } from "../middleware/rateLimits.js";
import { validate } from "../middleware/validate.js";

export const authRouter = Router();

// guestOnly を制限より先に置く: ログイン済みの 403 を「ログイン失敗」として数えないため
authRouter.post(
  "/auth/signup",
  guestOnly,
  signupLimiter,
  validate({ body: signupSchema }),
  auth.signup,
);
authRouter.post(
  "/auth/login",
  guestOnly,
  loginLimiter,
  validate({ body: loginSchema }),
  auth.login,
);
authRouter.post("/auth/logout", auth.logout);
authRouter.get("/auth/me", requireAuth, auth.me);
