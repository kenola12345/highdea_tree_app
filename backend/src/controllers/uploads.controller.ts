import type { RequestHandler } from "express";

import { currentUser } from "../middleware/auth.js";
import * as uploadService from "../services/upload.service.js";

/** POST /api/uploads: 画像を1つ保存して 201 で返す */
export const create: RequestHandler = async (req, res) => {
  if (!req.file) throw new Error("upload middleware is missing on this route");
  const upload = await uploadService.save(currentUser(req).id, req.file);
  res.status(201).json({ data: { upload } });
};
