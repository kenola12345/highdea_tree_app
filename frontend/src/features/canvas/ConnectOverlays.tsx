/**
 * つなぐ相手を選んでいる間の案内（manifests/nodes.md §3.5 Connections「Click another idea to connect it to “{title}”」）。
 * キャンバスの上端に重ねる。スマホの左右余白はページと同じ 16px（px-4 相当の inset-x-4）。
 */
export function ConnectBanner({ title, onCancel }: { title: string; onCancel: () => void }) {
  return (
    <div
      role="status"
      data-testid="connect-banner"
      className="absolute inset-x-4 top-3 z-10 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900 shadow-sm"
    >
      <p className="min-w-0 flex-1 break-words">Click another idea to connect it to “{title}”</p>
      <button
        type="button"
        onClick={onCancel}
        data-testid="connect-cancel"
        className="min-h-11 shrink-0 rounded-lg px-3 font-medium hover:bg-blue-100 md:min-h-9"
      >
        Cancel
      </button>
    </div>
  );
}

/** 選択中のつながりの中点に出す小さなツールバー。確認は出さない（すぐ作り直せるため: manifests/nodes.md） */
export function ConnectionToolbar({
  point,
  disabled,
  onRemove,
}: {
  point: { x: number; y: number };
  /** 保存中（一時ID）のつながりはまだ消せない */
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Connection actions"
      data-testid="connection-toolbar"
      className="absolute z-10 flex -translate-x-1/2 -translate-y-full rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
      style={{ left: point.x, top: Math.max(point.y - 8, 56) }}
    >
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        data-testid="remove-connection-button"
        className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap text-red-700 hover:bg-red-50 disabled:opacity-40 md:min-h-9"
      >
        Remove connection
      </button>
    </div>
  );
}
