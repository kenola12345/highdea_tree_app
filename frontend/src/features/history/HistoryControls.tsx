import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

import type { HistoryStep } from "./historyStore";

type HistoryControlsProps = {
  past: HistoryStep[];
  future: HistoryStep[];
  busy: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onJump: (pastLength: number) => void;
};

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const UNDO_KEYS = isMac ? "⌘Z" : "Ctrl+Z";
const REDO_KEYS = isMac ? "⇧⌘Z" : "Ctrl+Y";

/**
 * エディタのツールバーの「元に戻す / やり直す」と履歴の一覧（manifests/nodes.md §3.5 Undo and redo）。
 * 一覧は古い順で、今の位置より後（やり直せる手）は薄く出す。手を押すとそこまで戻す・進める。
 */
export function HistoryControls({
  past,
  future,
  busy,
  onUndo,
  onRedo,
  onJump,
}: HistoryControlsProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const lastUndo = past.at(-1);
  const nextRedo = future.at(-1);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const iconButton =
    "flex size-11 items-center justify-center rounded-full text-lg text-slate-700 hover:bg-slate-100 disabled:opacity-30 md:size-9";
  // やり直せる手は新しいものが末尾にあるので、一覧では逆順（次にやり直す手が上）に並べる
  const steps = [
    ...past.map((s, i) => ({ step: s, target: i + 1, done: true })),
    ...[...future].reverse().map((s, i) => ({ step: s, target: past.length + i + 1, done: false })),
  ];

  return (
    <div ref={wrapperRef} className="relative flex items-center">
      <button
        type="button"
        onClick={onUndo}
        disabled={!lastUndo || busy}
        aria-label={lastUndo ? `Undo ${lastUndo.label}` : "Undo"}
        title={
          lastUndo ? `Undo ${lastUndo.label} (${UNDO_KEYS})` : `Nothing to undo (${UNDO_KEYS})`
        }
        data-testid="undo-button"
        className={iconButton}
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 14 4 9l5-5" />
          <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!nextRedo || busy}
        aria-label={nextRedo ? `Redo ${nextRedo.label}` : "Redo"}
        title={
          nextRedo ? `Redo ${nextRedo.label} (${REDO_KEYS})` : `Nothing to redo (${REDO_KEYS})`
        }
        data-testid="redo-button"
        className={iconButton}
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m15 14 5-5-5-5" />
          <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-label="History"
        title="History"
        data-testid="history-button"
        className={clsx(iconButton, "hidden sm:flex")}
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
          <path d="M3 4v4h4" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="History"
          data-testid="history-panel"
          className="bg-surface animate-drop-in absolute top-full right-0 z-30 mt-2 w-72 origin-top-right rounded-2xl border border-slate-200 p-2 shadow-xl"
        >
          <p className="px-2 pt-1 pb-2 text-xs font-semibold text-slate-400">History</p>
          <ol className="max-h-80 overflow-y-auto">
            <li>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  onJump(0);
                }}
                className={clsx(
                  "w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-100",
                  past.length === 0 ? "text-ink font-bold" : "text-slate-500",
                )}
              >
                Opened
              </button>
            </li>
            {steps.map(({ step, target, done }) => (
              <li key={target}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    onJump(target);
                  }}
                  data-testid="history-step"
                  aria-current={target === past.length ? "step" : undefined}
                  className={clsx(
                    "w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-100",
                    target === past.length
                      ? "text-ink bg-slate-100 font-bold"
                      : done
                        ? "text-slate-700"
                        : "text-slate-400 italic",
                  )}
                >
                  {step.label}
                </button>
              </li>
            ))}
          </ol>
          {steps.length === 0 && (
            <p className="px-2 pb-2 text-sm text-slate-500">Changes you make will show here.</p>
          )}
        </div>
      )}
    </div>
  );
}
