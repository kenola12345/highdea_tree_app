type ErrorStateProps = { message?: string; onRetry?: () => void };

/** 読み込みに失敗したときの表示（再試行ボタン付き） */
export function ErrorState({
  message = "Something went wrong while loading.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center text-red-800"
    >
      <p className="text-sm">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="bg-surface mt-3 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium hover:bg-red-100"
        >
          Try again
        </button>
      )}
    </div>
  );
}
