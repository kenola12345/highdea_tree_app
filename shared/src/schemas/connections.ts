// アイデア同士のつながりのリクエストスキーマ（manifests/nodes.md POST /api/trees/:id/connections）。
import { z } from "zod";

import { lineColorSchema } from "./nodes.js";

/** POST /api/trees/:id/connections の本文。向きはないので2つのIDの順番は問わない */
export const createConnectionSchema = z
  .strictObject({
    nodeAId: z.string().min(1),
    nodeBId: z.string().min(1),
  })
  .refine((body) => body.nodeAId !== body.nodeBId, {
    message: "An idea can't be connected to itself",
    path: ["nodeBId"],
  });
export type CreateConnectionBody = z.infer<typeof createConnectionSchema>;

/** PATCH /api/connections/:id の本文。色（#RRGGBB）か null（既定の灰色） */
export const updateConnectionSchema = z.strictObject({ color: lineColorSchema });
export type UpdateConnectionBody = z.infer<typeof updateConnectionSchema>;
