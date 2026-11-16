import { useDeleteTreeForever, useEmptyTrash } from "../../api/trash";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";

/** 何を完全削除するか: ゴミ箱の1件、またはゴミ箱全体（count はゴミ箱のツリー数） */
export type DeleteForeverTarget =
  { kind: "one"; tree: { id: string; title: string } } | { kind: "all"; count: number };

type DeleteForeverModalProps = { target: DeleteForeverTarget | null; onClose: () => void };

/**
 * M-13 完全削除の確認（manifests/trees.md M-13）。1件の「Delete forever」と「Empty Trash」で共用する。
 * WHY: 取り消せない操作なので、必ず確認してから赤いボタンで実行する。
 */
export function DeleteForeverModal({ target, onClose }: DeleteForeverModalProps) {
  const deleteOne = useDeleteTreeForever();
  const emptyTrash = useEmptyTrash();
  const toast = useToast();
  const mutation = target?.kind === "all" ? emptyTrash : deleteOne;

  function close() {
    deleteOne.reset();
    emptyTrash.reset();
    onClose();
  }

  function onConfirm() {
    if (!target) return;
    if (target.kind === "one") {
      deleteOne.mutate(target.tree.id, {
        onSuccess: () => {
          toast("Deleted permanently", "success");
          close();
        },
      });
    } else {
      emptyTrash.mutate(undefined, {
        onSuccess: () => {
          toast("Trash emptied", "success");
          close();
        },
      });
    }
  }

  const count = target?.kind === "all" ? target.count : 0;
  return (
    <ConfirmDialog
      open={Boolean(target)}
      title={
        target?.kind === "all" ? "Empty Trash?" : `Delete “${target?.tree.title ?? ""}” forever?`
      }
      message={
        target?.kind === "all"
          ? `${count === 1 ? "The 1 tree" : `All ${String(count)} trees`} in the Trash will be deleted permanently. This can't be undone.`
          : `“${target?.tree.title ?? ""}” will be deleted permanently, with all of its ideas. This can't be undone.`
      }
      confirmLabel={target?.kind === "all" ? "Empty Trash" : "Delete forever"}
      danger
      pending={mutation.isPending}
      error={mutation.error?.message ?? null}
      testId="delete-forever-modal"
      onCancel={close}
      onConfirm={onConfirm}
    />
  );
}
