import type { NodeDetails } from "@highdea/shared";
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "./client";
import { queryKeys } from "./queryKeys";

/** ノードの重い内容（メモ・リンクプレビュー・画像URLなど）を最大100件まとめて取得する（GET /api/trees/:id/nodes?ids=） */
export async function fetchNodeDetails(treeId: string, ids: string[]): Promise<NodeDetails[]> {
  const search = new URLSearchParams({ ids: ids.join(",") });
  const { nodes } = await apiFetch<{ nodes: NodeDetails[] }>(
    `/trees/${treeId}/nodes?${search.toString()}`,
  );
  return nodes;
}

/** 1ノードの中身を取得する（キャッシュがあればそれを使う）。ビューアの詳細表示（M-12）用 */
export function useNodeDetailsQuery(treeId: string, nodeId: string | null) {
  return useQuery({
    queryKey: queryKeys.nodeDetails(treeId, nodeId ?? ""),
    queryFn: async () => {
      const [details] = await fetchNodeDetails(treeId, [nodeId ?? ""]);
      if (!details) throw new Error("This idea is no longer available.");
      return details;
    },
    enabled: nodeId !== null,
    staleTime: 60_000,
  });
}
