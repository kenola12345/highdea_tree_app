import {
  BOX_HEIGHT_MIN,
  BOX_WIDTH_MIN,
  type CreateGroupBody,
  type FieldError,
  type GroupKind,
  MAX_GROUPS_PER_TREE,
  type NodeGroup,
  type UpdateGroupBody,
} from "@highdea/shared";
import type { Prisma } from "@prisma/client";

import { AppError } from "../errors/AppError.js";
import { prisma } from "../lib/prisma.js";
import { lockOwnedActiveTree, touchTree } from "./node.service.js";

/** 種類ごとの既定の題名 */
const DEFAULT_TITLE: Record<GroupKind, string> = { BOX: "Group", NOTE: "Note", LABEL: "Text" };

/** 400 VALIDATION_ERROR を1項目のエラーとして作る */
function fieldError(field: string, message: string): AppError {
  const details: FieldError[] = [{ field, message }];
  return new AppError("VALIDATION_ERROR", undefined, details);
}

/** ボックスは付箋・文字より大きい最小の大きさ（160 × 100）を守る */
function assertFits(kind: GroupKind, body: { width?: number; height?: number }) {
  if (kind !== "BOX") return;
  if (body.width !== undefined && body.width < BOX_WIDTH_MIN) {
    throw fieldError("width", `Use at least ${String(BOX_WIDTH_MIN)}`);
  }
  if (body.height !== undefined && body.height < BOX_HEIGHT_MIN) {
    throw fieldError("height", `Use at least ${String(BOX_HEIGHT_MIN)}`);
  }
}

/** レスポンスに返す列 */
export const groupSelect = {
  id: true,
  kind: true,
  title: true,
  body: true,
  color: true,
  positionX: true,
  positionY: true,
  width: true,
  height: true,
} satisfies Prisma.NodeGroupSelect;

/**
 * ボックスを足す（manifests/nodes.md POST /api/trees/:id/groups）。
 * ツリー行をロックしてから数えて足すので、同時に足しても100件を超えない。
 */
export async function create(
  userId: string,
  treeId: string,
  body: CreateGroupBody,
): Promise<NodeGroup> {
  return prisma.$transaction(async (tx) => {
    await lockOwnedActiveTree(tx, userId, treeId);
    const count = await tx.nodeGroup.count({ where: { treeId } });
    if (count >= MAX_GROUPS_PER_TREE) throw new AppError("GROUP_LIMIT_REACHED");
    const kind = body.kind ?? "BOX";
    assertFits(kind, body);
    // 文を持てるのは付箋（本文）とボックス（ラベル）だけ。文字の項目は題名が文そのもの
    if (body.body !== undefined && body.body !== null && kind === "LABEL")
      throw fieldError("body", "Text labels use the title");
    const group = await tx.nodeGroup.create({
      data: {
        treeId,
        kind,
        title: body.title ?? DEFAULT_TITLE[kind],
        body: kind === "LABEL" ? null : (body.body ?? null),
        color: body.color ?? null,
        positionX: body.positionX,
        positionY: body.positionY,
        width: body.width,
        height: body.height,
      },
      select: groupSelect,
    });
    await touchTree(tx, treeId);
    return group;
  });
}

/** 自分の（ゴミ箱にない）ツリーのボックスのツリーIDを探す。なければ存在を明かさないよう GROUP_NOT_FOUND */
async function findOwnedTreeId(
  tx: Prisma.TransactionClient,
  userId: string,
  groupId: string,
): Promise<string> {
  const group = await tx.nodeGroup.findFirst({
    where: { id: groupId, tree: { ownerId: userId, deletedAt: null } },
    select: { treeId: true },
  });
  if (!group) throw new AppError("GROUP_NOT_FOUND");
  return group.treeId;
}

/** ボックスの題名・色・位置・大きさを変える（manifests/nodes.md PATCH /api/groups/:id） */
export async function update(
  userId: string,
  groupId: string,
  body: UpdateGroupBody,
): Promise<NodeGroup> {
  return prisma.$transaction(async (tx) => {
    const treeId = await findOwnedTreeId(tx, userId, groupId);
    await lockOwnedActiveTree(tx, userId, treeId);
    const current = await tx.nodeGroup.findUnique({
      where: { id: groupId },
      select: { kind: true },
    });
    if (!current) throw new AppError("GROUP_NOT_FOUND");
    assertFits(current.kind, body);
    if (body.body !== undefined && body.body !== null && current.kind === "LABEL")
      throw fieldError("body", "Text labels use the title");
    const { count } = await tx.nodeGroup.updateMany({ where: { id: groupId }, data: body });
    // ロック待ちの間に、別のリクエストが消していた
    if (count === 0) throw new AppError("GROUP_NOT_FOUND");
    await touchTree(tx, treeId);
    return tx.nodeGroup.findUniqueOrThrow({ where: { id: groupId }, select: groupSelect });
  });
}

/** ボックスを消す。中のアイデアは変えない（manifests/nodes.md DELETE /api/groups/:id） */
export async function remove(userId: string, groupId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const treeId = await findOwnedTreeId(tx, userId, groupId);
    await lockOwnedActiveTree(tx, userId, treeId);
    const { count } = await tx.nodeGroup.deleteMany({ where: { id: groupId } });
    if (count === 0) throw new AppError("GROUP_NOT_FOUND");
    await touchTree(tx, treeId);
  });
}

/**
 * 位置の一括保存のうちボックスの分（node.service の savePositions と同じトランザクションで呼ぶ）。
 * ツリーにないIDが1つでもあれば GROUP_NOT_FOUND でロールバックする。
 */
export async function savePositionsInTx(
  tx: Prisma.TransactionClient,
  treeId: string,
  items: { id: string; positionX: number; positionY: number; width?: number; height?: number }[],
): Promise<NodeGroup[]> {
  const saved: NodeGroup[] = [];
  for (const item of items) {
    const { count } = await tx.nodeGroup.updateMany({
      where: { id: item.id, treeId },
      data: {
        positionX: item.positionX,
        positionY: item.positionY,
        width: item.width,
        height: item.height,
      },
    });
    if (count === 0) throw new AppError("GROUP_NOT_FOUND");
  }
  if (items.length > 0) {
    saved.push(
      ...(await tx.nodeGroup.findMany({
        where: { id: { in: items.map((i) => i.id) } },
        select: groupSelect,
      })),
    );
  }
  return saved;
}
