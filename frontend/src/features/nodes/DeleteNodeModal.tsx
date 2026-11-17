import { ConfirmDialog } from "../../components/ConfirmDialog";

type DeleteNodeModalProps = {
  node: { id: string; title: string } | null;
  /** 子孫の数（骨格から数える） */
  descendantCount: number;
  onClose: () => void;
  onConfirm: (id: string) => void;
};

/** 元に戻すキー（Mac は ⌘Z、それ以外は Ctrl+Z） */
const UNDO_KEYS =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘Z" : "Ctrl+Z";
/** M-06 ノード削除の確認。枝ごと消えることと消える数、⌘Z / Ctrl+Z で元に戻せることを示す（manifests/nodes.md M-06） */
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
          ? `Delete this idea and ${String(n)} ${n === 1 ? "idea" : "ideas"} under it? You can undo this with ${UNDO_KEYS}.`
          : `Delete this idea? You can undo this with ${UNDO_KEYS}.`
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
