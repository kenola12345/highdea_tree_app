// P-06 Tree Viewer
import type { NodeDetails } from "@highdea/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useParams } from "react-router";

import { fetchNodeDetails } from "../api/nodeDetails";
import { queryKeys } from "../api/queryKeys";
import { useTree } from "../api/tree";
import { ErrorState } from "../components/ErrorState";
import { Spinner } from "../components/Spinner";
import { RemoveTreeModal } from "../features/admin/RemoveTreeModal";
import { useMe } from "../features/auth/useMe";
import { type CanvasApi, TreeCanvas } from "../features/canvas/TreeCanvas";
import { CARD_FROM } from "../features/canvas/viewport";
import { ViewerHeader } from "../features/explore/ViewerHeader";
import { type MediaNode, MediaViewerModal } from "../features/nodes/MediaViewerModal";
import { NotFound } from "./NotFoundPage";

/**
 * 読み取り専用のツリー表示（P-06）。公開ツリーは誰でも、非公開・非公開化されたツリーは所有者だけが見られる。
 * 編集の操作はなく、画像・動画のノードを押すと（読める倍率のとき）大きく表示する（M-10）。
 */
export default function TreeViewerPage() {
  const { id = "" } = useParams();
  const { data, isPending, isError, notFound, refetch } = useTree(id);
  const { isAdmin } = useMe();
  const queryClient = useQueryClient();
  const apiRef = useRef<CanvasApi | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaNode | null>(null);
  const [removing, setRemoving] = useState(false);

  if (notFound) return <NotFound />;
  if (isPending) return <Spinner />;
  if (isError)
    return <ErrorState message="Couldn't load this tree." onRetry={() => void refetch()} />;

  /** 画像・動画のノードを押したら原寸画像や動画を表示する。点や短い題名しか見えない倍率では選択だけにする */
  async function onNodeClick(nodeId: string | null) {
    setSelectedId(nodeId);
    const node = nodeId ? data?.nodes.find((n) => n.id === nodeId) : undefined;
    if (!nodeId || !node || (node.type !== "IMAGE" && node.type !== "VIDEO")) return;
    if ((apiRef.current?.transform.k ?? 0) < CARD_FROM) return;
    let details = queryClient.getQueryData<NodeDetails>(queryKeys.nodeDetails(id, nodeId));
    if (!details) [details] = await fetchNodeDetails(id, [nodeId]).catch(() => []);
    setMedia({
      title: node.title,
      type: node.type,
      imageUrl: details?.imageUrl ?? null,
      url: details?.url ?? null,
    });
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] w-full flex-col">
      <ViewerHeader
        data={data}
        isAdmin={isAdmin}
        onRemove={() => {
          setRemoving(true);
        }}
      />
      <div className="relative min-h-0 flex-1">
        <TreeCanvas
          treeId={id}
          nodes={data.nodes}
          apiRef={apiRef}
          selectedId={selectedId}
          onNodeSelect={(nodeId) => void onNodeClick(nodeId)}
        />
      </div>
      <MediaViewerModal
        node={media}
        onClose={() => {
          setMedia(null);
        }}
      />
      <RemoveTreeModal
        open={removing}
        tree={{ id, title: data.tree.title, ownerUsername: data.owner.username }}
        onClose={() => {
          setRemoving(false);
        }}
      />
    </div>
  );
}
