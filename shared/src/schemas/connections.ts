// アイデア同士のつながりのリクエストスキーマ（manifests/nodes.md POST /api/trees/:id/connections）。
import { z } from "zod";

import { lineColorSchema } from "./nodes.js";

/** POST /api/trees/:id/connections の本文。向きはないので2つのIDの順番は問わない */
/** つながりの種類（manifests/nodes.md §3.5 Connections） */
export const connectionKindSchema = z.enum(["RELATED", "SEQUENCE", "DEPENDENCY", "CONTRAST"]);
/** 向き（nodeAId → nodeBId か、その逆）。null は向きなし */
export const connectionArrowSchema = z.enum(["A_TO_B", "B_TO_A"]).nullable();

export const createConnectionSchema = z
  .strictObject({
    nodeAId: z.string().min(1),
    nodeBId: z.string().min(1),
    kind: connectionKindSchema.optional(),
  })
  .refine((body) => body.nodeAId !== body.nodeBId, {
    message: "An idea can't be connected to itself",
    path: ["nodeBId"],
  });
export type CreateConnectionBody = z.infer<typeof createConnectionSchema>;

/** PATCH /api/connections/:id の本文。色・種類・向きのうち変えるものだけ（最低1つ） */
export const updateConnectionSchema = z
  .strictObject({
    color: lineColorSchema.optional(),
    kind: connectionKindSchema.optional(),
    arrow: connectionArrowSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: "Send at least one field to change" });
export type UpdateConnectionBody = z.infer<typeof updateConnectionSchema>;
