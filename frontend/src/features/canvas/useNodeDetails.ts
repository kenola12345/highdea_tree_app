import { NODE_DETAILS_BATCH_MAX, type NodeDetails } from "@highdea/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { fetchNodeDetails } from "../../api/nodeDetails";
import { queryKeys } from "../../api/queryKeys";

/** 取得の間隔。パン中に連続でリクエストしないよう、この間隔でまとめて送る（manifests/nodes.md SPA points） */
export const FETCH_INTERVAL_MS = 300;

type SkeletonRef = { id: string; updatedAt: string };

/**
 * 取得が必要なノードIDを選ぶ純粋関数。キャッシュにない、またはキャッシュの updatedAt が骨格と違う（内容が変わった）もので、
 * 取得中でないものだけを返す。
 */
export function pickIdsToFetch(
  nodes: SkeletonRef[],
  getCached: (id: string) => NodeDetails | undefined,
  inFlight: ReadonlySet<string>,
): string[] {
  return nodes
    .filter((n) => {
      if (inFlight.has(n.id)) return false;
      const cached = getCached(n.id);
      return !cached || cached.updatedAt !== n.updatedAt;
    })
    .map((n) => n.id);
}

/** 配列を size 件ずつに分ける */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * 見えているノード（読める倍率のとき）の中身を、最大100件ずつ・一定間隔でまとめて取得し、ノードIDごとにキャッシュする。
 * 結果は useNodeDetail で各カードが読む。
 */
export function useLoadNodeDetails(treeId: string, nodes: SkeletonRef[], enabled: boolean): void {
  const queryClient = useQueryClient();
  const inFlight = useRef(new Set<string>());
  const lastFetchAt = useRef(0);

  useEffect(() => {
    if (!enabled || nodes.length === 0) return;
    const getCached = (id: string) =>
      queryClient.getQueryData<NodeDetails>(queryKeys.nodeDetails(treeId, id));

    function flush() {
      const ids = pickIdsToFetch(nodes, getCached, inFlight.current);
      if (ids.length === 0) return;
      lastFetchAt.current = Date.now();
      for (const batch of chunk(ids, NODE_DETAILS_BATCH_MAX)) {
        batch.forEach((id) => inFlight.current.add(id));
        fetchNodeDetails(treeId, batch)
          .then((details) => {
            for (const d of details)
              queryClient.setQueryData(queryKeys.nodeDetails(treeId, d.id), d);
          })
          // 取得に失敗したカードは中身なしのまま表示し、次に見えたときに再試行する
          .catch(() => undefined)
          .finally(() => {
            batch.forEach((id) => inFlight.current.delete(id));
          });
      }
    }

    const wait = Math.max(0, lastFetchAt.current + FETCH_INTERVAL_MS - Date.now());
    const timer = setTimeout(flush, wait);
    return () => {
      clearTimeout(timer);
    };
  }, [enabled, nodes, queryClient, treeId]);
}

/** 1ノードの中身をキャッシュから読む（取得は useLoadNodeDetails が行う）。未取得なら undefined */
export function useNodeDetail(treeId: string, nodeId: string): NodeDetails | undefined {
  const { data } = useQuery({
    queryKey: queryKeys.nodeDetails(treeId, nodeId),
    queryFn: (): NodeDetails => {
      throw new Error("Node details are loaded in batches by useLoadNodeDetails");
    },
    enabled: false,
    staleTime: Infinity,
  });
  return data;
}
