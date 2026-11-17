import type { NodeDetails, NodeSkeleton } from "@highdea/shared";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { queryKeys } from "../../api/queryKeys";
import { autoCardSize } from "./cardContent";
import { isExpanded, useExpandedVersion } from "./expandedStore";
import type { AutoSizes } from "./layout";

/**
 * 大きさが未設定のノードの、中身に合わせた大きさ（manifests/nodes.md §3.5 Card shape and size）。
 * 中身（メモ・画像・リンクのプレビュー）は見えているノードから遅れて届くので、詳細のキャッシュが更新されるたびと、
 * フォントの読み込みが終わったとき（文字の幅が変わる）に計算し直す。
 */
export function useAutoCardSizes(treeId: string, nodes: NodeSkeleton[]): AutoSizes {
  const queryClient = useQueryClient();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      const [kind, tree] = event.query.queryKey as readonly unknown[];
      if (event.type === "updated" && kind === "nodeDetails" && tree === treeId) {
        setVersion((v) => v + 1);
      }
    });
    let alive = true;
    // テスト環境（jsdom）には document.fonts がない
    if ("fonts" in document) {
      void document.fonts.ready.then(() => {
        if (alive) setVersion((v) => v + 1);
      });
    }
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [queryClient, treeId]);

  // 「Show more / Show less」で開閉したときも計算し直す
  const expandedVersion = useExpandedVersion();
  return useMemo(
    () => computeSizes(queryClient, treeId, nodes, version + expandedVersion * 100_000),
    [queryClient, treeId, nodes, version, expandedVersion],
  );
}

/** 大きさが未設定のノードごとに、キャッシュにある詳細から大きさを出す（_version は計算し直すきっかけ） */
function computeSizes(
  queryClient: QueryClient,
  treeId: string,
  nodes: NodeSkeleton[],
  _version: number,
): AutoSizes {
  const sizes = new Map<string, { width: number; height: number }>();
  for (const node of nodes) {
    if (node.width !== null && node.height !== null) continue;
    const details = queryClient.getQueryData<NodeDetails>(queryKeys.nodeDetails(treeId, node.id));
    sizes.set(
      node.id,
      autoCardSize(
        { ...node, isRoot: node.parentId === null },
        details,
        isExpanded(treeId, node.id),
      ),
    );
  }
  return sizes;
}
