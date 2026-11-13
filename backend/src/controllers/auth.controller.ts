import { loginSchema, signupSchema } from "@highdea/shared";
import type { RequestHandler } from "express";

import { clearAuthCookie, setAuthCookie } from "../lib/jwt.js";
import { currentUser } from "../middleware/auth.js";
import { getValidated } from "../middleware/validate.js";
import * as authService from "../services/auth.service.js";

/** POST /api/auth/signup: 登録してそのままログイン状態にする */
export const signup: RequestHandler = async (req, res) => {
  const user = await authService.signup(getValidated(req, "body", signupSchema));
  setAuthCookie(res, user.id);
  res.status(201).json({ data: { user } });
};

/** POST /api/auth/login */
export const login: RequestHandler = async (req, res) => {
  const user = await authService.login(getValidated(req, "body", loginSchema));
  setAuthCookie(res, user.id);
  res.status(200).json({ data: { user } });
};

/** POST /api/auth/logout: Cookie を消すだけ（サーバー側にセッションはない） */
export const logout: RequestHandler = (_req, res) => {
  clearAuthCookie(res);
  res.status(200).json({ data: null });
};

/** GET /api/auth/me */
export const me: RequestHandler = async (req, res) => {
  const user = await authService.me(currentUser(req).id);
  res.status(200).json({ data: { user } });
};
