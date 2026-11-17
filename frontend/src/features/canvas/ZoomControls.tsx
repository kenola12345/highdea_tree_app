type ZoomControlsProps = {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
};

const button =
  "flex size-11 items-center justify-center text-lg font-medium text-slate-700 hover:bg-slate-100 md:size-9";

/** 拡大・縮小・全体表示のボタンと現在の倍率 */
export function ZoomControls({ scale, onZoomIn, onZoomOut, onFit }: ZoomControlsProps) {
  return (
    <div className="bg-surface flex items-center overflow-hidden rounded-xl border border-slate-200 shadow-sm">
      <button type="button" aria-label="Zoom out" onClick={onZoomOut} className={button}>
        −
      </button>
      <span
        className="w-12 text-center text-xs text-slate-600 tabular-nums"
        aria-live="polite"
        data-testid="zoom-level"
      >
        {Math.round(scale * 100)}%
      </span>
      <button type="button" aria-label="Zoom in" onClick={onZoomIn} className={button}>
        +
      </button>
      <button
        type="button"
        onClick={onFit}
        className="border-l border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        Fit
      </button>
    </div>
  );
}
