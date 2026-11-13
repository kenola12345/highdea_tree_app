import type { NodeDetails } from "@highdea/shared";

import { apiFetch } from "./client";

/** ノードの重い内容（メモ・リンクプレビュー・画像URLなど）を最大100件まとめて取得する（GET /api/trees/:id/nodes?ids=） */
export async function fetchNodeDetails(treeId: string, ids: string[]): Promise<NodeDetails[]> {
  const search = new URLSearchParams({ ids: ids.join(",") });
  const { nodes } = await apiFetch<{ nodes: NodeDetails[] }>(
    `/trees/${treeId}/nodes?${search.toString()}`,
  );
  return nodes;
}
