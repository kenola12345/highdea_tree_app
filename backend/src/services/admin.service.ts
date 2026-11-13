import type { RemovedTreeResponse } from "@highdea/shared";

import { AppError } from "../errors/AppError.js";
import { prisma } from "../lib/prisma.js";
import { publicTreeWhere } from "./common/treeAccess.js";

/**
 * 管理者が公開ツリーを非公開化する（削除ではない）。
 * 公開ツリーである条件を UPDATE の WHERE に含めて1文で更新するため、2人の管理者が同時に実行しても成功するのは1人だけ。
 * visibility も同じ更新で PRIVATE にする（データと公開状態を一致させる: manifests/explore.md）。
 */
export async function removeTree(
  adminId: string,
  treeId: string,
  reason: string,
): Promise<RemovedTreeResponse> {
  const [updated] = await prisma.tree.updateManyAndReturn({
    where: { id: treeId, ...publicTreeWhere },
    data: {
      removedAt: new Date(),
      removedById: adminId,
      removalReason: reason,
      visibility: "PRIVATE",
    },
    select: { id: true, title: true, visibility: true, removedAt: true, removalReason: true },
  });
  if (!updated) throw await notRemovableError(treeId);
  if (!updated.removedAt || updated.removalReason === null) {
    throw new Error("removal fields were not saved");
  }
  return {
    id: updated.id,
    title: updated.title,
    visibility: updated.visibility,
    removedAt: updated.removedAt.toISOString(),
    removalReason: updated.removalReason,
  };
}

/**
 * 更新できなかった理由を判定する。
 * 非公開化済み（ゴミ箱外・所有者有効）なら 409、それ以外は公開されていないものとして 404。
 * 非公開ツリーは管理者にも存在を明かさない（CLAUDE.md 認可ルール）。
 */
async function notRemovableError(treeId: string): Promise<AppError> {
  const removed = await prisma.tree.findFirst({
    where: { id: treeId, removedAt: { not: null }, deletedAt: null, owner: { deletedAt: null } },
    select: { id: true },
  });
  return new AppError(removed ? "TREE_ALREADY_REMOVED" : "TREE_NOT_FOUND");
}
