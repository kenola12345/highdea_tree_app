import { z } from "zod";

import { REMOVAL_REASON_MAX } from "../constants.js";

/** POST /api/admin/trees/:id/remove の本文。理由は所有者に表示されるため必須 */
export const removeTreeSchema = z.strictObject({
  reason: z.string().trim().min(1).max(REMOVAL_REASON_MAX),
});
export type RemoveTreeBody = z.infer<typeof removeTreeSchema>;
