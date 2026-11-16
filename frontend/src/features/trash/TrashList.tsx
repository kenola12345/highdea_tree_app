import type { TrashItem as TrashItemData } from "@highdea/shared";
import { useState } from "react";

import { ApiError } from "../../api/client";
import { useRestoreTree } from "../../api/trash";
import { useToast } from "../../components/Toast";
import { DeleteForeverModal, type DeleteForeverTarget } from "./DeleteForeverModal";
import { TrashItem } from "./TrashItem";

type TrashListProps = {
  trees: TrashItemData[];
  /** ゴミ箱全体の件数（ページをまたいだ合計）。「Empty Trash」の確認文に出す */
  total: number;
};

/**
 * ゴミ箱の一覧、復元、完全削除（1件 / すべて）。完全削除済み・復元済みなどで失敗したら知らせて一覧を更新する。
 */
export function TrashList({ trees, total }: TrashListProps) {
  const restore = useRestoreTree();
  const toast = useToast();
  const [deleteTarget, setDeleteTarget] = useState<DeleteForeverTarget | null>(null);

  function onRestore(tree: TrashItemData) {
    restore.mutate(tree.id, {
      onSuccess: () => {
        toast(`Restored “${tree.title}”`, "success");
      },
      onError: (err) => {
        const gone =
          err instanceof ApiError &&
          (err.code === "TREE_NOT_FOUND" || err.code === "TREE_NOT_IN_TRASH");
        toast(
          gone ? "This tree is no longer in the Trash." : "Couldn't restore the tree. Try again.",
          "error",
        );
      },
    });
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => {
            setDeleteTarget({ kind: "all", count: total });
          }}
          data-testid="empty-trash-button"
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Empty Trash
        </button>
      </div>
      <ul
        className="divide-y divide-slate-200 rounded-xl border border-slate-200"
        data-testid="trash-list"
      >
        {trees.map((tree) => (
          <TrashItem
            key={tree.id}
            tree={tree}
            restoring={restore.isPending && restore.variables === tree.id}
            onRestore={() => {
              onRestore(tree);
            }}
            onDeleteForever={() => {
              setDeleteTarget({ kind: "one", tree });
            }}
          />
        ))}
      </ul>
      <DeleteForeverModal
        target={deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
