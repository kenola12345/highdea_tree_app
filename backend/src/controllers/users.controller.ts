import {
  changePasswordSchema,
  deactivateSchema,
  paginationQuerySchema,
  updateAccountSchema,
  updateProfileSchema,
  usernameParamSchema,
} from "@highdea/shared";
import type { RequestHandler } from "express";

import { clearAuthCookie } from "../lib/jwt.js";
import { currentUser } from "../middleware/auth.js";
import { getValidated } from "../middleware/validate.js";
import * as userService from "../services/user.service.js";

/** GET /api/users/:username: 公開プロフィールと公開ツリー */
export const getProfile: RequestHandler = async (req, res) => {
  const { username } = getValidated(req, "params", usernameParamSchema);
  const { page, limit } = getValidated(req, "query", paginationQuerySchema);
  const data = await userService.getPublicProfile(username, page, limit);
  res.status(200).json({ data });
};

/** PATCH /api/users/me */
export const updateProfile: RequestHandler = async (req, res) => {
  const user = await userService.updateProfile(
    currentUser(req).id,
    getValidated(req, "body", updateProfileSchema),
  );
  res.status(200).json({ data: { user } });
};

/** PATCH /api/users/me/account */
export const updateAccount: RequestHandler = async (req, res) => {
  const user = await userService.updateAccount(
    currentUser(req).id,
    getValidated(req, "body", updateAccountSchema),
  );
  res.status(200).json({ data: { user } });
};

/** PATCH /api/users/me/password */
export const changePassword: RequestHandler = async (req, res) => {
  await userService.changePassword(
    currentUser(req).id,
    getValidated(req, "body", changePasswordSchema),
  );
  res.status(200).json({ data: null });
};

/** POST /api/users/me/deactivate: 退会後はログアウトと同じく Cookie を消す */
export const deactivate: RequestHandler = async (req, res) => {
  const { password } = getValidated(req, "body", deactivateSchema);
  await userService.deactivate(currentUser(req).id, password);
  clearAuthCookie(res);
  res.status(200).json({ data: null });
};
