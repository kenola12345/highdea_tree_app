import { saveStatus, useSaveStatus } from "./saveStatusStore";

/** 保存状態（Saving… / Saved ✓ / Couldn't save – retry）。ノードの変更はすぐ画面に出るので、裏の保存の状態をここで示す */
export function SaveStatus({ treeId }: { treeId: string }) {
  const { pending, failed } = useSaveStatus(treeId);
  if (failed) {
    return (
      <span
        className="flex items-center gap-1 text-xs text-red-700"
        role="status"
        data-testid="save-status"
      >
        Couldn&apos;t save –
        <button
          type="button"
          onClick={() => {
            saveStatus.clear(treeId);
            failed.retry();
          }}
          className="font-semibold underline"
        >
          retry
        </button>
      </span>
    );
  }
  return (
    <span className="text-xs text-slate-500" role="status" data-testid="save-status">
      {pending > 0 ? "Saving…" : "Saved ✓"}
    </span>
  );
}
