import type { TreeDetailResponse } from "@highdea/shared";
import { Link } from "react-router";

import { CategoryChip } from "../categories/CategoryChip";
import { VisibilityBadge } from "../trees/VisibilityBadge";
import { SaveStatus } from "./SaveStatus";

type EditorToolbarProps = {
  treeId: string;
  tree: TreeDetailResponse["tree"];
  onOpenSettings: () => void;
};

/**
 * エディタ上部のバー: マイツリーへ戻る・題名・公開状態・カテゴリ・保存状態・設定（M-02）・「訪問者として見る」。
 * 管理者に非公開化されたツリーは理由を帯で示す（manifests/nodes.md EditorToolbar）。
 */
export function EditorToolbar({ treeId, tree, onOpenSettings }: EditorToolbarProps) {
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="flex min-h-12 items-center gap-2 px-4 py-2 md:gap-3">
        <Link
          to="/me"
          className="shrink-0 rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
          aria-label="Back to My Trees"
        >
          ‹ <span className="hidden sm:inline">My Trees</span>
        </Link>
        <h1 className="min-w-0 truncate text-base font-semibold" data-testid="editor-title">
          {tree.title}
        </h1>
        <VisibilityBadge visibility={tree.visibility} removed={Boolean(tree.removedAt)} />
        <div className="hidden min-w-0 gap-1 overflow-hidden lg:flex">
          {tree.categories.map((c) => (
            <CategoryChip key={c.id} category={c} />
          ))}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <SaveStatus treeId={treeId} />
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Tree settings"
            data-testid="tree-settings-button"
            className="flex size-11 items-center justify-center rounded-lg text-lg hover:bg-slate-100 md:size-9"
          >
            ⚙
          </button>
          <Link
            to={`/trees/${treeId}`}
            aria-label="View as visitor"
            title="View as visitor"
            className="flex size-11 items-center justify-center rounded-lg text-lg hover:bg-slate-100 md:size-9"
          >
            👁
          </Link>
        </div>
      </div>
      {tree.removedAt && (
        <p
          className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800"
          data-testid="editor-removal-banner"
        >
          Removed by an admin and hidden from the public
          {tree.removalReason ? `: ${tree.removalReason}` : "."} You can still edit it privately.
        </p>
      )}
    </div>
  );
}
