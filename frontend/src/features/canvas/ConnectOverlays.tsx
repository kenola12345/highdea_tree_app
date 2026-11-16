import clsx from "clsx";
import { type ReactNode, useEffect, useRef, useState } from "react";

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

/** カラーピッカーの連続した変更をまとめて保存するまでの待ち時間 */
const COLOR_SAVE_DELAY_MS = 250;

type LineColorControlProps = {
  /** data-testid の頭（"connection-color" / "branch-color"） */
  testId: string;
  label: string;
  /** 選んだ色（#RRGGBB）。null は既定・受け継ぐ */
  value: string | null;
  /** null のときに実際に使われる色 */
  fallbackColor: string;
  /** null に戻すボタンの文言（"Default" / "Inherit"） */
  fallbackLabel: string;
  disabled: boolean;
  onChange: (color: string | null) => void;
};

/**
 * 線の色の見本ボタン（押すと OS のカラーピッカー）と「Default / Inherit」ボタン（manifests/nodes.md §3.5 Choosing colors）。
 * ピッカーはドラッグ中に何度も変更を出すので、見本はすぐ変え、保存はまとめて少し後に1回送る。閉じる（選択を外す）ときは待たずに送る。
 */
function LineColorControl({
  testId,
  label,
  value,
  fallbackColor,
  fallbackLabel,
  disabled,
  onChange,
}: LineColorControlProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const pending = useRef<{ color: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  function flush() {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    onChangeRef.current(p.color);
    setDraft(null);
  }
  // ツールバーが閉じるときに、待っている色を保存する
  useEffect(
    () => () => {
      const p = pending.current;
      if (!p) return;
      clearTimeout(p.timer);
      pending.current = null;
      onChangeRef.current(p.color);
    },
    [],
  );

  const shown = draft ?? value ?? fallbackColor;
  return (
    <>
      <label
        className={clsx(
          "relative flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap text-slate-700 md:min-h-9",
          disabled ? "opacity-40" : "cursor-pointer hover:bg-slate-100",
        )}
        title={label}
      >
        <span
          aria-hidden="true"
          className="size-5 rounded-full ring-1 ring-black/15"
          style={{ backgroundColor: shown }}
          data-testid={`${testId}-swatch`}
        />
        Color
        <input
          type="color"
          aria-label={label}
          value={shown.toLowerCase()}
          disabled={disabled}
          onChange={(e) => {
            const color = e.target.value.toUpperCase();
            setDraft(color);
            if (pending.current) clearTimeout(pending.current.timer);
            pending.current = { color, timer: setTimeout(flush, COLOR_SAVE_DELAY_MS) };
          }}
          data-testid={`${testId}-picker`}
          className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
      </label>
      {(value !== null || draft !== null) && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (pending.current) clearTimeout(pending.current.timer);
            pending.current = null;
            setDraft(null);
            onChange(null);
          }}
          data-testid={`${testId}-default`}
          className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap text-slate-700 hover:bg-slate-100 disabled:opacity-40 md:min-h-9"
        >
          {fallbackLabel}
        </button>
      )}
    </>
  );
}

/** 線の中点の上に出す小さなツールバーの枠 */
function LineToolbar({
  point,
  label,
  testId,
  children,
}: {
  point: { x: number; y: number };
  label: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      data-testid={testId}
      className="absolute z-10 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
      style={{ left: point.x, top: Math.max(point.y - 8, 56) }}
    >
      {children}
    </div>
  );
}

/**
 * 選択中のつながりの中点に出す小さなツールバー: 色の変更と「Remove connection」。
 * 消すときの確認は出さない（すぐ作り直せるため: manifests/nodes.md）
 */
export function ConnectionToolbar({
  point,
  color,
  defaultColor,
  disabled,
  onColorChange,
  onRemove,
}: {
  point: { x: number; y: number };
  color: string | null;
  defaultColor: string;
  /** 保存中（一時ID）のつながりはまだ変えられない・消せない */
  disabled: boolean;
  onColorChange: (color: string | null) => void;
  onRemove: () => void;
}) {
  return (
    <LineToolbar point={point} label="Connection actions" testId="connection-toolbar">
      <LineColorControl
        testId="connection-color"
        label="Connection color"
        value={color}
        fallbackColor={defaultColor}
        fallbackLabel="Default"
        disabled={disabled}
        onChange={onColorChange}
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        data-testid="remove-connection-button"
        className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap text-red-700 hover:bg-red-50 disabled:opacity-40 md:min-h-9"
      >
        Remove connection
      </button>
    </LineToolbar>
  );
}

/**
 * 選択中の枝の線の中点に出すツールバー: 線の色の変更。枝の色は線が入る子ノードの lineColor で、
 * その下の線にも受け継がれる（M-04 の Line color と同じ: manifests/nodes.md §3.5）
 */
export function BranchToolbar({
  point,
  color,
  inheritedColor,
  disabled,
  onColorChange,
}: {
  point: { x: number; y: number };
  /** 子ノードの lineColor（null は親の色を受け継ぐ） */
  color: string | null;
  inheritedColor: string;
  /** 保存中（一時ID）のノードの線はまだ変えられない */
  disabled: boolean;
  onColorChange: (color: string | null) => void;
}) {
  return (
    <LineToolbar point={point} label="Branch line actions" testId="branch-toolbar">
      <LineColorControl
        testId="branch-color"
        label="Line color (also used for the lines below it)"
        value={color}
        fallbackColor={inheritedColor}
        fallbackLabel="Inherit"
        disabled={disabled}
        onChange={onColorChange}
      />
    </LineToolbar>
  );
}
