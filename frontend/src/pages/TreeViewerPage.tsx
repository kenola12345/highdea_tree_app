// P-06 Tree Viewer
import { useRef, useState } from "react";
import { useParams } from "react-router";

import { useTree } from "../api/tree";
import { ErrorState } from "../components/ErrorState";
import { Spinner } from "../components/Spinner";
import { RemoveTreeModal } from "../features/admin/RemoveTreeModal";
import { useMe } from "../features/auth/useMe";
import { type CanvasApi, TreeCanvas } from "../features/canvas/TreeCanvas";
import { ViewerHeader } from "../features/explore/ViewerHeader";
import { type MediaNode, MediaViewerModal } from "../features/nodes/MediaViewerModal";
import { NodeDetailsPanel } from "../features/nodes/NodeDetailsPanel";
import { NotFound } from "./NotFoundPage";

/**
 * 読み取り専用のツリー表示（P-06）。公開ツリーは誰でも、非公開・非公開化されたツリーは所有者だけが見られる。
 * 編集の操作はなく、アイデアを押すと詳細（M-12）を開く。画像は詳細から原寸表示（M-10）できる。
 */
export default function TreeViewerPage() {
  const { id = "" } = useParams();
  const { data, isPending, isError, notFound, refetch } = useTree(id);
  const { isAdmin } = useMe();
  const apiRef = useRef<CanvasApi | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaNode | null>(null);
  const [removing, setRemoving] = useState(false);

  if (notFound) return <NotFound />;
  if (isPending) return <Spinner />;
  if (isError)
    return <ErrorState message="Couldn't load this tree." onRetry={() => void refetch()} />;

  const selectedNode = selectedId ? (data.nodes.find((n) => n.id === selectedId) ?? null) : null;

  return (
    <div className="flex h-[calc(100dvh-4rem)] w-full flex-col">
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
          connections={data.connections}
          canvas={data.canvas}
          groups={data.groups}
          apiRef={apiRef}
          selectedId={selectedId}
          onNodeSelect={setSelectedId}
        />
        {/* キャンバスの上に重ねる（PC では右側のパネル、スマホでは全画面） */}
        <NodeDetailsPanel
          treeId={id}
          node={selectedNode}
          onClose={() => {
            setSelectedId(null);
          }}
          onOpenMedia={setMedia}
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
