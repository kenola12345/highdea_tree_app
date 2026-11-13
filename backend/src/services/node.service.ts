import {
  type CreateNodeBody,
  type DeleteNodeResponse,
  type FieldError,
  isVideoProviderUrl,
  MAX_NODES_PER_TREE,
  type NodeDetails,
  type NodePositionResponse,
  type NodeResponse,
  type PositionsBody,
  type UpdateNodeBody,
} from "@highdea/shared";
import type { NodeType, Prisma } from "@prisma/client";

import { AppError } from "../errors/AppError.js";
import { prisma } from "../lib/prisma.js";
import { visibleTreeWhere } from "./common/treeAccess.js";
import { type NodePreviewFields, tryGetPreview } from "./linkPreview.service.js";
import { uploadUrl } from "./upload.service.js";

type Tx = Prisma.TransactionClient;

/** 追加・編集のレスポンスに必要な列（骨格 + 詳細 + 画像の保存名） */
const nodeResponseSelect = {
  id: true,
  parentId: true,
  type: true,
  title: true,
  body: true,
  url: true,
  previewTitle: true,
  previewDescription: true,
  previewImageUrl: true,
  positionX: true,
  positionY: true,
  sortOrder: true,
  lineColor: true,
  createdAt: true,
  updatedAt: true,
  imageUpload: { select: { storageKey: true } },
} satisfies Prisma.NodeSelect;

/** 詳細の一括取得で返す列 */
const nodeDetailsSelect = {
  id: true,
  body: true,
  url: true,
  previewTitle: true,
  previewDescription: true,
  previewImageUrl: true,
  updatedAt: true,
  imageUpload: { select: { storageKey: true } },
} satisfies Prisma.NodeSelect;

type NodeResponseRow = Prisma.NodeGetPayload<{ select: typeof nodeResponseSelect }>;
type NodeDetailsRow = Prisma.NodeGetPayload<{ select: typeof nodeDetailsSelect }>;

/** プレビュー列をすべて空にする値（LINK 以外の型には持たせない） */
const EMPTY_PREVIEW: NodePreviewFields = {
  previewTitle: null,
  previewDescription: null,
  previewImageUrl: null,
  previewFetchedAt: null,
};

/** DB の行を詳細のレスポンス形式にする。画像は保存名から公開URLを組み立てる */
function toNodeDetails(row: NodeDetailsRow): NodeDetails {
  return {
    id: row.id,
    body: row.body,
    url: row.url,
    previewTitle: row.previewTitle,
    previewDescription: row.previewDescription,
    previewImageUrl: row.previewImageUrl,
    imageUrl: row.imageUpload ? uploadUrl(row.imageUpload.storageKey) : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** DB の行を追加・編集のレスポンス形式（骨格 + 詳細）にする */
export function toNodeResponse(row: NodeResponseRow): NodeResponse {
  return {
    id: row.id,
    parentId: row.parentId,
    type: row.type,
    title: row.title,
    body: row.body,
    url: row.url,
    previewTitle: row.previewTitle,
    previewDescription: row.previewDescription,
    previewImageUrl: row.previewImageUrl,
    imageUrl: row.imageUpload ? uploadUrl(row.imageUpload.storageKey) : null,
    positionX: row.positionX,
    positionY: row.positionY,
    sortOrder: row.sortOrder,
    lineColor: row.lineColor,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * 自分のゴミ箱外のツリー行をロックする。見つからない・他人・ゴミ箱内は存在を隠して TREE_NOT_FOUND。
 * 管理者に非公開化されたツリーも所有者は編集できるため removed_at は見ない（manifests/nodes.md）。
 */
export async function lockOwnedActiveTree(tx: Tx, userId: string, treeId: string): Promise<void> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM trees
    WHERE id = ${treeId} AND owner_id = ${userId} AND deleted_at IS NULL
    FOR UPDATE`;
  if (rows.length === 0) throw new AppError("TREE_NOT_FOUND");
}

/**
 * 自分のゴミ箱外のツリーにあるノードを探し、そのツリー行をロックする。それ以外は NODE_NOT_FOUND。
 * 同時の付け替えで循環ができたり、削除中の枝に子が追加されたりしないよう、ツリー単位で直列にする。
 */
export async function findOwnedNode(
  tx: Tx,
  userId: string,
  nodeId: string,
): Promise<{ id: string; treeId: string }> {
  const rows = await tx.$queryRaw<{ id: string; treeId: string }[]>`
    SELECT n.id, n.tree_id AS "treeId" FROM nodes n
    JOIN trees t ON t.id = n.tree_id
    WHERE n.id = ${nodeId} AND t.owner_id = ${userId} AND t.deleted_at IS NULL
    FOR UPDATE OF t`;
  const row = rows[0];
  if (!row) throw new AppError("NODE_NOT_FOUND");
  return row;
}

/** 親ノードがこのツリーにあるか確認する。別ツリーのノードの下には付けられない（manifests/nodes.md nodes） */
async function assertParentInTree(tx: Tx, treeId: string, parentId: string): Promise<void> {
  const parent = await tx.node.findFirst({ where: { id: parentId, treeId }, select: { id: true } });
  if (!parent) throw new AppError("PARENT_NOT_FOUND");
}

/**
 * 画像が呼び出したユーザーのアップロードか確認する。
 * FOR SHARE で行を押さえ、確認とノード保存の間に未使用画像の掃除ジョブに消されないようにする。
 */
async function assertOwnUpload(tx: Tx, userId: string, uploadId: string): Promise<void> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM uploads WHERE id = ${uploadId} AND owner_id = ${userId} FOR SHARE`;
  if (rows.length === 0) throw new AppError("UPLOAD_NOT_FOUND");
}

/** 親の最後の子の次の並び順（manifests/nodes.md「Default: after the parent's last child」） */
async function nextSortOrder(tx: Tx, parentId: string): Promise<number> {
  const { _max } = await tx.node.aggregate({ where: { parentId }, _max: { sortOrder: true } });
  return _max.sortOrder === null ? 0 : _max.sortOrder + 1;
}

/** ツリーの更新日時を進める（マイツリーの並び順・閲覧画面のキャッシュ判定に使うため） */
async function touchTree(tx: Tx, treeId: string): Promise<void> {
  await tx.tree.update({ where: { id: treeId }, data: { updatedAt: new Date() } });
}

/**
 * ノード詳細の一括取得。ツリーの見え方は GET /api/trees/:id と同じで、見えなければ TREE_NOT_FOUND。
 * 存在しない・別ツリーのIDは失敗にせず除外する（直前に削除されたノードでバッチ全体を失敗させないため）。
 */
export async function getDetails(
  viewerId: string | undefined,
  treeId: string,
  ids: string[],
): Promise<{ nodes: NodeDetails[] }> {
  const tree = await prisma.tree.findFirst({
    where: { AND: [{ id: treeId }, visibleTreeWhere(viewerId)] },
    select: { id: true },
  });
  if (!tree) throw new AppError("TREE_NOT_FOUND");
  const rows = await prisma.node.findMany({
    where: { treeId, id: { in: ids } },
    select: nodeDetailsSelect,
  });
  return { nodes: rows.map(toNodeDetails) };
}

/**
 * ノードを追加する。LINK のプレビューはトランザクションの外で先に取得する（ロック中に通信しない: standards/database.md §4.5）。
 * 件数確認と追加は、ツリー行をロックした1トランザクションで行い、同時追加でも2,000件を超えないようにする（manifests/nodes.md）。
 */
export async function create(
  userId: string,
  treeId: string,
  body: CreateNodeBody,
): Promise<NodeResponse> {
  const preview = body.type === "LINK" ? await tryGetPreview(body.url) : EMPTY_PREVIEW;

  return prisma.$transaction(async (tx) => {
    await lockOwnedActiveTree(tx, userId, treeId);
    const count = await tx.node.count({ where: { treeId } });
    if (count >= MAX_NODES_PER_TREE) throw new AppError("NODE_LIMIT_REACHED");
    await assertParentInTree(tx, treeId, body.parentId);
    if (body.type === "IMAGE") await assertOwnUpload(tx, userId, body.imageUploadId);

    const node = await tx.node.create({
      data: {
        treeId,
        parentId: body.parentId,
        type: body.type,
        title: body.title,
        body: body.body ?? null,
        url: body.type === "LINK" || body.type === "VIDEO" ? body.url : null,
        ...preview,
        imageUploadId: body.type === "IMAGE" ? body.imageUploadId : null,
        positionX: body.positionX ?? 0,
        positionY: body.positionY ?? 0,
        sortOrder: body.sortOrder ?? (await nextSortOrder(tx, body.parentId)),
        lineColor: body.lineColor ?? null,
      },
      select: nodeResponseSelect,
    });
    await touchTree(tx, treeId);
    return toNodeResponse(node);
  });
}

/** 400 VALIDATION_ERROR を1項目のエラーとして作る */
function fieldError(field: string, message: string): AppError {
  const details: FieldError[] = [{ field, message }];
  return new AppError("VALIDATION_ERROR", undefined, details);
}

/**
 * 変更後の型に対して送られた項目が正しいか確認する。type を送らない場合は現在の型が基準になるため、スキーマではなくここで見る。
 * 型を変える時は、新しい型に必要な項目を同じリクエストで送る必要がある（manifests/nodes.md PATCH /api/nodes/:id）。
 */
function assertFieldsFitType(currentType: NodeType, body: UpdateNodeBody): NodeType {
  const nextType = body.type ?? currentType;
  const isUrlType = nextType === "LINK" || nextType === "VIDEO";
  if (body.url !== undefined && !isUrlType) throw fieldError("url", "Not allowed for this type");
  if (body.imageUploadId !== undefined && nextType !== "IMAGE") {
    throw fieldError("imageUploadId", "Not allowed for this type");
  }
  if (nextType === "VIDEO" && body.url !== undefined && !isVideoProviderUrl(body.url)) {
    throw fieldError("url", "Only YouTube or Vimeo URLs are supported");
  }
  if (nextType !== currentType) {
    if (isUrlType && body.url === undefined) throw fieldError("url", "Required for this type");
    if (nextType === "IMAGE" && body.imageUploadId === undefined) {
      throw fieldError("imageUploadId", "Required for this type");
    }
  }
  return nextType;
}

/** 付け替え先の親から根まで辿り、移動するノード自身に出会えば自分の枝の下への移動なので拒否する */
async function assertNotIntoOwnBranch(
  tx: Tx,
  treeId: string,
  nodeId: string,
  newParentId: string,
): Promise<void> {
  const nodes = await tx.node.findMany({ where: { treeId }, select: { id: true, parentId: true } });
  const parentOf = new Map(nodes.map((n) => [n.id, n.parentId]));
  let cursor: string | null | undefined = newParentId;
  while (cursor) {
    if (cursor === nodeId) throw new AppError("INVALID_MOVE");
    cursor = parentOf.get(cursor);
  }
}

/**
 * ノードを編集する（内容・型・付け替え）。
 * 型を変えても title・body は残し、新しい型に合わない項目（url とプレビュー、画像）は消す（manifests/nodes.md）。
 * LINK の URL が送られたらプレビューを取り直すが、通信はトランザクションの外で先に行う。
 */
export async function update(
  userId: string,
  nodeId: string,
  body: UpdateNodeBody,
): Promise<NodeResponse> {
  // 通信の前に、所有と型の確認を済ませて不要な取得をしない（確定はロック後に読み直して行う）
  const before = await prisma.node.findFirst({
    where: { id: nodeId, tree: { ownerId: userId, deletedAt: null } },
    select: { type: true },
  });
  if (!before) throw new AppError("NODE_NOT_FOUND");
  const plannedType = assertFieldsFitType(before.type, body);
  const fetched =
    plannedType === "LINK" && body.url !== undefined ? await tryGetPreview(body.url) : undefined;

  return prisma.$transaction(async (tx) => {
    const { treeId } = await findOwnedNode(tx, userId, nodeId);
    const current = await tx.node.findUniqueOrThrow({
      where: { id: nodeId },
      select: { type: true, parentId: true },
    });
    const nextType = assertFieldsFitType(current.type, body);

    const data: Prisma.NodeUncheckedUpdateInput = {
      title: body.title,
      body: body.body,
      lineColor: body.lineColor,
    };
    if (nextType !== current.type) {
      // 型が変わったら古い型の項目を消す（画像ファイル自体は未使用画像の掃除ジョブが消す）
      Object.assign(data, { type: nextType, url: null, imageUploadId: null, ...EMPTY_PREVIEW });
    }
    if (body.url !== undefined) {
      Object.assign(data, {
        url: body.url,
        ...(nextType === "LINK" ? (fetched ?? EMPTY_PREVIEW) : EMPTY_PREVIEW),
      });
    }
    if (body.imageUploadId !== undefined) {
      await assertOwnUpload(tx, userId, body.imageUploadId);
      data.imageUploadId = body.imageUploadId;
    }

    if (body.parentId !== undefined) {
      // ルートは他のノードの下に移動できない（manifests/nodes.md nodes）
      if (current.parentId === null) throw new AppError("INVALID_MOVE");
      await assertParentInTree(tx, treeId, body.parentId);
      await assertNotIntoOwnBranch(tx, treeId, nodeId, body.parentId);
      data.parentId = body.parentId;
      data.positionX = body.positionX;
      data.positionY = body.positionY;
      data.sortOrder =
        body.sortOrder ??
        (body.parentId === current.parentId ? undefined : await nextSortOrder(tx, body.parentId));
    }

    const node = await tx.node.update({
      where: { id: nodeId },
      data,
      select: nodeResponseSelect,
    });
    await touchTree(tx, treeId);
    return toNodeResponse(node);
  });
}

/**
 * ドラッグ移動・自動整列の位置をまとめて保存する。1トランザクションで全件保存するか何も保存しない。
 * ツリーにないIDが1つでもあれば NODE_NOT_FOUND でロールバックする（manifests/nodes.md）。
 */
export async function savePositions(
  userId: string,
  treeId: string,
  items: PositionsBody["nodes"],
): Promise<{ nodes: NodePositionResponse[] }> {
  return prisma.$transaction(async (tx) => {
    await lockOwnedActiveTree(tx, userId, treeId);
    // 最大2,000件を1件ずつ更新すると遅いため、配列を unnest して1回の UPDATE にする。
    // ノードの updated_at は「内容の変更」を表すため位置だけの保存では変えない
    // （変えるとキャンバスがドラッグしただけのノードの詳細を取り直してしまう: manifests/nodes.md）
    const rows = await tx.$queryRaw<NodePositionRow[]>`
      UPDATE nodes AS n SET
        position_x = v.x,
        position_y = v.y,
        sort_order = COALESCE(v.s, n.sort_order)
      FROM unnest(
        ${items.map((i) => i.id)}::text[],
        ${items.map((i) => i.positionX)}::float8[],
        ${items.map((i) => i.positionY)}::float8[],
        ${items.map((i) => i.sortOrder ?? null)}::int[]
      ) AS v(id, x, y, s)
      WHERE n.id = v.id AND n.tree_id = ${treeId}
      RETURNING n.id, n.position_x AS "positionX", n.position_y AS "positionY",
        n.sort_order AS "sortOrder", n.updated_at AS "updatedAt"`;
    if (rows.length !== items.length) throw new AppError("NODE_NOT_FOUND");
    await touchTree(tx, treeId);
    return { nodes: rows.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() })) };
  });
}

type NodePositionRow = Omit<NodePositionResponse, "updatedAt"> & { updatedAt: Date };

/**
 * ノードを枝ごと完全に削除する。ルートは消せない（ツリーごと削除する: manifests/nodes.md）。
 * 子孫は DB の ON DELETE CASCADE で消えるが、エディタがキャッシュから外せるよう先にIDを集めて返す。
 */
export async function remove(userId: string, nodeId: string): Promise<DeleteNodeResponse> {
  return prisma.$transaction(async (tx) => {
    const { treeId } = await findOwnedNode(tx, userId, nodeId);
    const nodes = await tx.node.findMany({
      where: { treeId },
      select: { id: true, parentId: true },
    });
    const target = nodes.find((n) => n.id === nodeId);
    if (target?.parentId === null) throw new AppError("CANNOT_DELETE_ROOT");

    const childrenOf = new Map<string, string[]>();
    for (const n of nodes) {
      if (n.parentId === null) continue;
      childrenOf.set(n.parentId, [...(childrenOf.get(n.parentId) ?? []), n.id]);
    }
    const deletedNodeIds: string[] = [];
    const stack = [nodeId];
    while (stack.length > 0) {
      const id = stack.pop() as string;
      deletedNodeIds.push(id);
      stack.push(...(childrenOf.get(id) ?? []));
    }

    await tx.node.delete({ where: { id: nodeId } });
    await touchTree(tx, treeId);
    return { deletedNodeIds };
  });
}
