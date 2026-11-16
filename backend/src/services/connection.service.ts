import {
  type CreateConnectionBody,
  MAX_CONNECTIONS_PER_TREE,
  type NodeConnection,
} from "@highdea/shared";

import { AppError } from "../errors/AppError.js";
import { prisma } from "../lib/prisma.js";
import { sortPair } from "./common/connectionPair.js";
import { lockOwnedActiveTree, touchTree } from "./node.service.js";

/** レスポンスに返す列 */
export const connectionSelect = { id: true, nodeAId: true, nodeBId: true } as const;

/**
 * 同じツリーの2つのアイデアをつなぐ（manifests/nodes.md POST /api/trees/:id/connections）。
 * ツリー行をロックしてから上限・重複を確かめて追加するので、同時に追加しても500件を超えず、同じ組も二重にできない。
 * WHY: 親子のノードはすでに枝の線でつながっているので、つながりにはしない（INVALID_CONNECTION）。
 */
export async function create(
  userId: string,
  treeId: string,
  body: CreateConnectionBody,
): Promise<NodeConnection> {
  const [nodeAId, nodeBId] = sortPair(body.nodeAId, body.nodeBId);
  return prisma.$transaction(async (tx) => {
    await lockOwnedActiveTree(tx, userId, treeId);
    const nodes = await tx.node.findMany({
      where: { treeId, id: { in: [nodeAId, nodeBId] } },
      select: { id: true, parentId: true },
    });
    if (nodes.length !== 2) throw new AppError("NODE_NOT_FOUND");
    if (nodes.some((n) => n.parentId === nodeAId || n.parentId === nodeBId)) {
      throw new AppError("INVALID_CONNECTION");
    }
    const existing = await tx.nodeConnection.findUnique({
      where: { nodeAId_nodeBId: { nodeAId, nodeBId } },
      select: { id: true },
    });
    if (existing) throw new AppError("INVALID_CONNECTION");
    const count = await tx.nodeConnection.count({ where: { treeId } });
    if (count >= MAX_CONNECTIONS_PER_TREE) throw new AppError("CONNECTION_LIMIT_REACHED");

    const connection = await tx.nodeConnection.create({
      data: { treeId, nodeAId, nodeBId },
      select: connectionSelect,
    });
    await touchTree(tx, treeId);
    return connection;
  });
}

/**
 * つながりを消す（manifests/nodes.md DELETE /api/connections/:id）。
 * 存在しない・他人のツリー・ゴミ箱のツリーのものは、存在を明かさないよう CONNECTION_NOT_FOUND。
 */
export async function remove(userId: string, connectionId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const connection = await tx.nodeConnection.findFirst({
      where: { id: connectionId, tree: { ownerId: userId, deletedAt: null } },
      select: { treeId: true },
    });
    if (!connection) throw new AppError("CONNECTION_NOT_FOUND");
    // ノード編集と同じくツリー単位で直列にする（ロック後に消えていれば、別のリクエストが先に消した）
    await lockOwnedActiveTree(tx, userId, connection.treeId);
    const { count } = await tx.nodeConnection.deleteMany({ where: { id: connectionId } });
    if (count === 0) throw new AppError("CONNECTION_NOT_FOUND");
    await touchTree(tx, connection.treeId);
  });
}
