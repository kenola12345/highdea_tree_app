import type { TreeVisibility } from "@highdea/shared";

import { useMoveTreeToTrash } from "../../api/trees";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";

type MoveToTrashModalProps = {
  tree: { id: string; title: string; visibility: TreeVisibility } | null;
  onClose: () => void;
  /** 移動後の処理（エディタからならマイツリーへ戻る） */
  onDone?: () => void;
};

/** M-03 ゴミ箱へ移動の確認。10日間は復元でき、その後に完全削除される（manifests/trees.md M-03） */
export function MoveToTrashModal({ tree, onClose, onDone }: MoveToTrashModalProps) {
  const move = useMoveTreeToTrash();
  const toast = useToast();
  return (
    <ConfirmDialog
      open={Boolean(tree)}
      title={`Move “${tree?.title ?? ""}” to Trash?`}
      message="This tree will be in Trash for 10 days, then deleted permanently. You can restore it until then."
      confirmLabel="Move to Trash"
      danger
      pending={move.isPending}
      error={move.error?.message ?? null}
      testId="move-to-trash-modal"
      onCancel={() => {
        move.reset();
        onClose();
      }}
      onConfirm={() => {
        if (!tree) return;
        move.mutate(tree, {
          onSuccess: () => {
            toast("Moved to Trash", "success");
            onClose();
            onDone?.();
          },
        });
      }}
    />
  );
}
