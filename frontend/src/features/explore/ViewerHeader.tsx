import type { TreeDetailResponse } from "@highdea/shared";
import { Link } from "react-router";

import { CategoryChip } from "../categories/CategoryChip";

type ViewerHeaderProps = {
  data: TreeDetailResponse;
  /** 管理者のときだけ「Remove」を出す（権限の確認は API 側でも行われる） */
  isAdmin: boolean;
  onRemove: () => void;
};

/**
 * ツリービューア（P-06）の見出し: 題名・所有者・カテゴリ・説明。
 * 管理者には公開中のツリーに限り「Remove」（M-09）を出す。所有者のエディタへの切り替えはヘッダーの「Edit | View」（manifests/explore.md P-06）。
 * 所有者が自分の非公開化されたツリーを見ているときは理由を示す。
 */
export function ViewerHeader({ data, isAdmin, onRemove }: ViewerHeaderProps) {
  const { tree, owner, isOwner } = data;
  const canRemove = isAdmin && tree.visibility === "PUBLIC" && !tree.removedAt;
  return (
    <div className="bg-surface border-b border-slate-200">
      <div className="mx-auto flex max-w-6xl flex-wrap items-start gap-3 px-4 py-3 md:px-8">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold break-words" data-testid="viewer-title">
            {tree.title}
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            by{" "}
            <Link
              to={`/u/${owner.username}`}
              className="font-medium text-slate-800 hover:underline"
            >
              {owner.displayName}
            </Link>
          </p>
          {tree.description && (
            <p className="mt-1 line-clamp-2 text-sm text-slate-600">{tree.description}</p>
          )}
          {tree.categories.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tree.categories.map((c) => (
                <CategoryChip key={c.id} category={c} />
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              data-testid="viewer-remove"
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {isOwner && tree.removedAt && (
        <p className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 md:px-8">
          An admin removed this tree from public view
          {tree.removalReason ? `: ${tree.removalReason}` : "."} Only you can see it.
        </p>
      )}
    </div>
  );
}
