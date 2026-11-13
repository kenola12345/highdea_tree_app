// ノードのレスポンス型（manifests/nodes.md）。骨格 NodeSkeleton は types/tree.ts で定義済み。
import type { NodeSkeleton } from "./tree.js";

/** 遅延取得するノードの重い内容（GET /api/trees/:id/nodes の data.nodes の1件）。imageUrl は IMAGE 以外 null */
export type NodeDetails = {
  id: string;
  body: string | null;
  url: string | null;
  previewTitle: string | null;
  previewDescription: string | null;
  previewImageUrl: string | null;
  imageUrl: string | null;
  updatedAt: string;
};

/** 追加・編集（POST /api/trees/:id/nodes、PATCH /api/nodes/:id）の data.node。骨格と詳細の両方を含む */
export type NodeResponse = NodeSkeleton &
  Omit<NodeDetails, "id" | "updatedAt"> & { createdAt: string };

/** PATCH /api/trees/:id/nodes/positions の data.nodes の1件 */
export type NodePositionResponse = {
  id: string;
  positionX: number;
  positionY: number;
  sortOrder: number;
  updatedAt: string;
};

/** DELETE /api/nodes/:id の data。削除したノードと子孫すべてのID */
export type DeleteNodeResponse = { deletedNodeIds: string[] };
