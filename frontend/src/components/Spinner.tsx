type SpinnerProps = { label?: string };

/** 読み込み中の表示 */
export function Spinner({ label = "Loading…" }: SpinnerProps) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-12 text-slate-500">
      <span className="border-brand-600 size-5 animate-spin rounded-full border-2 border-t-transparent" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
