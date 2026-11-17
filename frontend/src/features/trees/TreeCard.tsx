import type { TreeCategoryRef, TreeOwnerRef, TreeVisibility } from "@highdea/shared";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { formatRelative } from "../../lib/dates";
import { CategoryChip } from "../categories/CategoryChip";
import { VisibilityBadge } from "./VisibilityBadge";

type TreeCardProps = {
  tree: {
    id: string;
    title: string;
    description: string | null;
    categories: TreeCategoryRef[];
    nodeCount: number;
    updatedAt: string;
    visibility?: TreeVisibility;
    removedAt?: string | null;
  };
  /** カードを押したときの移動先（エディタまたはビューア） */
  to: string;
  /** Explore では所有者を表示する */
  owner?: TreeOwnerRef;
  /** マイツリーでの「…」メニューなど */
  menu?: ReactNode;
};

/** ツリーのカード。マイツリー・Explore・公開プロフィールで共通に使う */
export function TreeCard({ tree, to, owner, menu }: TreeCardProps) {
  return (
    <article
      data-testid="tree-card"
      className="bg-surface relative flex w-full flex-col rounded-xl border border-slate-200 p-4 shadow-sm transition hover:border-slate-300 hover:shadow"
    >
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 text-base font-semibold break-words">
          <Link to={to} className="after:absolute after:inset-0 hover:underline">
            {tree.title}
          </Link>
        </h3>
        {tree.visibility && (
          <VisibilityBadge visibility={tree.visibility} removed={Boolean(tree.removedAt)} />
        )}
        {menu && <div className="relative z-10 -mt-1 -mr-1">{menu}</div>}
      </div>
      {tree.description && (
        <p className="mt-1 line-clamp-2 text-sm text-slate-600">{tree.description}</p>
      )}
      {tree.categories.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {tree.categories.map((c) => (
            <CategoryChip key={c.id} category={c} />
          ))}
        </div>
      )}
      <div className="mt-auto flex items-center gap-2 pt-4 text-xs text-slate-500">
        <span>
          {tree.nodeCount} {tree.nodeCount === 1 ? "idea" : "ideas"}
        </span>
        <span aria-hidden="true">·</span>
        <span>Updated {formatRelative(tree.updatedAt)}</span>
        {owner && (
          <>
            <span aria-hidden="true">·</span>
            <Link
              to={`/u/${owner.username}`}
              className="relative z-10 truncate font-medium hover:underline"
            >
              {owner.displayName}
            </Link>
          </>
        )}
      </div>
    </article>
  );
}
