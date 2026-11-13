import { ConfirmDialog } from "../../components/ConfirmDialog";

type DeleteNodeModalProps = {
  node: { id: string; title: string } | null;
  /** 子孫の数（骨格から数える） */
  descendantCount: number;
  onClose: () => void;
  onConfirm: (id: string) => void;
};

/** M-06 ノード削除の確認。枝ごと消え、元に戻せないことと、消える数を示す（manifests/nodes.md M-06） */
export function DeleteNodeModal({
  node,
  descendantCount,
  onClose,
  onConfirm,
}: DeleteNodeModalProps) {
  const n = descendantCount;
  return (
    <ConfirmDialog
      open={Boolean(node)}
      title={`Delete “${node?.title ?? ""}”?`}
      message={
        n > 0
          ? `Delete this idea and ${String(n)} ${n === 1 ? "idea" : "ideas"} under it? This can't be undone.`
          : "Delete this idea? This can't be undone."
      }
      confirmLabel="Delete"
      danger
      testId="delete-node-modal"
      onCancel={onClose}
      onConfirm={() => {
        if (node) onConfirm(node.id);
        onClose();
      }}
    />
  );
}
