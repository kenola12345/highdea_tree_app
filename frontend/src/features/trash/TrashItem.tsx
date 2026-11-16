import type { TrashItem as TrashItemData } from "@highdea/shared";

import { daysLeft, formatDate } from "../../lib/dates";
import { CategoryChip } from "../categories/CategoryChip";

type TrashItemProps = {
  tree: TrashItemData;
  onRestore: () => void;
  restoring: boolean;
  /** 完全削除の確認（M-13）を開く */
  onDeleteForever: () => void;
};

/** ゴミ箱の1件。完全削除までの残り日数（purgeAt から計算）、復元ボタン、完全削除ボタン（manifests/trees.md P-09） */
export function TrashItem({ tree, onRestore, restoring, onDeleteForever }: TrashItemProps) {
  const left = daysLeft(tree.purgeAt);
  return (
    <li
      className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center"
      data-testid="trash-item"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium break-words">{tree.title}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Deleted {formatDate(tree.deletedAt)} ·{" "}
          <span
            className={left <= 2 ? "font-medium text-red-700" : undefined}
            data-testid="days-left"
          >
            {left === 0 ? "Deleted today" : `${String(left)} ${left === 1 ? "day" : "days"} left`}
          </span>
        </p>
        {tree.categories.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tree.categories.map((c) => (
              <CategoryChip key={c.id} category={c} />
            ))}
          </div>
        )}
      </div>
      <div className="flex shrink-0 gap-2 self-start sm:self-center">
        <button
          type="button"
          onClick={onRestore}
          disabled={restoring}
          data-testid="restore-button"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
        >
          {restoring ? "Restoring…" : "Restore"}
        </button>
        <button
          type="button"
          onClick={onDeleteForever}
          disabled={restoring}
          data-testid="delete-forever-button"
          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          Delete forever
        </button>
      </div>
    </li>
  );
}
