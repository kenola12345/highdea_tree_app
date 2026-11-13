// P-06 Tree Viewer
import type { NodeDetails } from "@highdea/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router";

import { queryKeys } from "../api/queryKeys";
import { useTree } from "../api/tree";
import { ErrorState } from "../components/ErrorState";
import { Spinner } from "../components/Spinner";
import { TreeCanvas } from "../features/canvas/TreeCanvas";
import { type MediaNode, MediaViewerModal } from "../features/nodes/MediaViewerModal";
import { NotFound } from "./NotFoundPage";

/**
 * 読み取り専用のツリー表示（P-06）。Phase 7 ではキャンバスだけを表示し、
 * 題名・所有者などのヘッダーと管理者の非公開化（M-09）は frontend-tasks.md Phase 10 で追加する。
 */
export default function TreeViewerPage() {
  const { id = "" } = useParams();
  const { data, isPending, isError, notFound, refetch } = useTree(id);
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaNode | null>(null);

  if (notFound) return <NotFound />;
  if (isPending) return <Spinner />;
  if (isError)
    return <ErrorState message="Couldn't load this tree." onRetry={() => void refetch()} />;

  // 画像・動画ノードを開くと原寸画像や動画を表示する（M-10）
  function openNode(nodeId: string) {
    const node = data?.nodes.find((n) => n.id === nodeId);
    if (!node || (node.type !== "IMAGE" && node.type !== "VIDEO")) return;
    const details = queryClient.getQueryData<NodeDetails>(queryKeys.nodeDetails(id, nodeId));
    setMedia({
      title: node.title,
      type: node.type,
      imageUrl: details?.imageUrl ?? null,
      url: details?.url ?? null,
    });
  }

  return (
    <div className="h-[calc(100dvh-3.5rem)] w-full">
      <h1 className="sr-only">{data.tree.title}</h1>
      <TreeCanvas
        treeId={id}
        nodes={data.nodes}
        selectedId={selectedId}
        onNodeSelect={setSelectedId}
        onNodeOpen={openNode}
      />
      <MediaViewerModal
        node={media}
        onClose={() => {
          setMedia(null);
        }}
      />
    </div>
  );
}
