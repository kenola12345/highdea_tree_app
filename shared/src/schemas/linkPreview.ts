import { z } from "zod";

import { NODE_URL_MAX } from "../constants.js";

/** POST /api/link-preview の本文。http/https の URL、2,048文字まで（manifests/nodes.md） */
export const linkPreviewSchema = z.strictObject({
  url: z
    .string()
    .trim()
    .max(NODE_URL_MAX)
    .pipe(z.url({ protocol: /^https?$/, message: "Enter an http or https URL" })),
});
export type LinkPreviewBody = z.infer<typeof linkPreviewSchema>;

/** リンクプレビューの結果。url はリダイレクト後の最終URL。ページに無い項目は null */
export type LinkPreviewResponse = {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
};
