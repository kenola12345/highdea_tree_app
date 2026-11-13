import type { Prisma } from "@prisma/client";

/**
 * 「公開ツリー」の条件（manifests/common.md「Authorization Rules」）:
 * PUBLIC で、管理者に非公開化されておらず、ゴミ箱にも入っておらず、所有者のアカウントが有効なもの。
 * Explore・公開プロフィール・閲覧画面で同じ条件を使うため、必ずこの定義を使う。
 */
export const publicTreeWhere = {
  visibility: "PUBLIC",
  removedAt: null,
  deletedAt: null,
  owner: { deletedAt: null },
} satisfies Prisma.TreeWhereInput;

/**
 * 閲覧者が見てよいツリーの条件。
 * 所有者はゴミ箱以外の自分のツリーをすべて見られ、それ以外の人（ゲスト・管理者を含む）は公開ツリーだけ見られる。
 * 非公開ツリーは管理者にも見せない（CLAUDE.md の認可ルール）。
 */
export function visibleTreeWhere(viewerId?: string): Prisma.TreeWhereInput {
  if (!viewerId) return publicTreeWhere;
  return { OR: [{ ownerId: viewerId, deletedAt: null }, publicTreeWhere] };
}
