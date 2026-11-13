import type { RequestHandler } from "express";

import { AppError } from "../errors/AppError.js";
import { currentUser } from "./auth.js";

/** 管理者専用。requireAuth の後に置く。ロールは requireAuth が DB から読んだ値を使う */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (currentUser(req).role !== "ADMIN") throw new AppError("FORBIDDEN");
  next();
};
