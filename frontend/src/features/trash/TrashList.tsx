import type { TrashItem as TrashItemData } from "@highdea/shared";

import { ApiError } from "../../api/client";
import { useRestoreTree } from "../../api/trash";
import { useToast } from "../../components/Toast";
import { TrashItem } from "./TrashItem";

/** ゴミ箱の一覧と復元。完全削除済み・復元済みなどで失敗したら知らせて一覧を更新する */
export function TrashList({ trees }: { trees: TrashItemData[] }) {
  const restore = useRestoreTree();
  const toast = useToast();

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
        />
      ))}
    </ul>
  );
}
