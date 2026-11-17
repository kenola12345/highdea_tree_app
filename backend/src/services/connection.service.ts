import {
  type CreateConnectionBody,
  MAX_CONNECTIONS_PER_TREE,
  type NodeConnection,
  type UpdateConnectionBody,
} from "@highdea/shared";
import type { Prisma } from "@prisma/client";

import { AppError } from "../errors/AppError.js";
import { prisma } from "../lib/prisma.js";
import { sortPair } from "./common/connectionPair.js";
import { lockOwnedActiveTree, touchTree } from "./node.service.js";

/** レスポンスに返す列 */
export const connectionSelect = {
  id: true,
  nodeAId: true,
  nodeBId: true,
  color: true,
  kind: true,
  arrow: true,
} as const;

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

    // 向きのある種類（順番・依存）は、つなぎ始めたアイデア（本文の nodeAId）から相手へ向ける
    const kind = body.kind ?? "RELATED";
    const directed = kind === "SEQUENCE" || kind === "DEPENDENCY";
    const arrow = directed ? (body.nodeAId === nodeAId ? "A_TO_B" : "B_TO_A") : null;
    const connection = await tx.nodeConnection.create({
      data: { treeId, nodeAId, nodeBId, kind, arrow },
      select: connectionSelect,
    });
    await touchTree(tx, treeId);
    return connection;
  });
}

/** 自分の（ゴミ箱にない）ツリーのつながりのツリーIDを探す。なければ存在を明かさないよう CONNECTION_NOT_FOUND */
async function findOwnedTreeId(
  tx: Prisma.TransactionClient,
  userId: string,
  connectionId: string,
): Promise<string> {
  const connection = await tx.nodeConnection.findFirst({
    where: { id: connectionId, tree: { ownerId: userId, deletedAt: null } },
    select: { treeId: true },
  });
  if (!connection) throw new AppError("CONNECTION_NOT_FOUND");
  return connection.treeId;
}

/**
 * つながりの線の色・種類・向きを変える（manifests/nodes.md PATCH /api/connections/:id）。色の null は既定の灰色。
 * ノード編集と同じくツリー行をロックして直列にし、ツリーの updatedAt も更新する。
 */
export async function update(
  userId: string,
  connectionId: string,
  body: UpdateConnectionBody,
): Promise<NodeConnection> {
  return prisma.$transaction(async (tx) => {
    const treeId = await findOwnedTreeId(tx, userId, connectionId);
    await lockOwnedActiveTree(tx, userId, treeId);
    const { count } = await tx.nodeConnection.updateMany({
      where: { id: connectionId },
      data: { color: body.color, kind: body.kind, arrow: body.arrow },
    });
    // ロック待ちの間に、別のリクエストがつながり（かノード）を消していた
    if (count === 0) throw new AppError("CONNECTION_NOT_FOUND");
    await touchTree(tx, treeId);
    return tx.nodeConnection.findUniqueOrThrow({
      where: { id: connectionId },
      select: connectionSelect,
    });
  });
}

/**
 * つながりを消す（manifests/nodes.md DELETE /api/connections/:id）。
 * 存在しない・他人のツリー・ゴミ箱のツリーのものは、存在を明かさないよう CONNECTION_NOT_FOUND。
 */
export async function remove(userId: string, connectionId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const treeId = await findOwnedTreeId(tx, userId, connectionId);
    // ノード編集と同じくツリー単位で直列にする（ロック後に消えていれば、別のリクエストが先に消した）
    await lockOwnedActiveTree(tx, userId, treeId);
    const { count } = await tx.nodeConnection.deleteMany({ where: { id: connectionId } });
    if (count === 0) throw new AppError("CONNECTION_NOT_FOUND");
    await touchTree(tx, treeId);
  });
}
