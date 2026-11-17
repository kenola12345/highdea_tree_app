import type { GridStyle, TreeCanvasStyle, UpdateTreeCanvasBody } from "@highdea/shared";
import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useEffect, useRef } from "react";

import { previewTreeCanvas, useUpdateTreeCanvas } from "../../api/tree";
import { ColorField } from "../../components/ColorField";
import { CANVAS_DEFAULTS } from "./canvasTheme";
import { DEFAULT_CANVAS_STYLE } from "./GridBackground";
import { NODE_STYLE_ORDER, NODE_STYLES } from "./nodeStyles";

/** 最後の変更からまとめて保存するまでの待ち時間（manifests/nodes.md「saves 300 ms after the last change」） */
const SAVE_DELAY_MS = 300;

const STYLES: { value: GridStyle; label: string }[] = [
  { value: "LINES", label: "Lines" },
  { value: "DOTS", label: "Dots" },
  { value: "NONE", label: "None" },
];

type CanvasPanelProps = {
  treeId: string;
  canvas: TreeCanvasStyle;
  onClose: () => void;
};

/**
 * キャンバスの見た目のパネル（manifests/nodes.md §3.5 Canvas look）: 方眼の種類・色・不透明度、背景色、Reset。
 * 変更はキャッシュに書いてすぐ画面に出し、最後の変更から 300ms 後に、それまでの変更をまとめて1回保存する。
 * スマホでは左右をページと同じ 16px（inset-x-4）空けて下に出す。
 */
export function CanvasPanel({ treeId, canvas, onClose }: CanvasPanelProps) {
  const queryClient = useQueryClient();
  const save = useUpdateTreeCanvas(treeId);
  // before: まとめて保存する変更の、変え始める前の見た目（元に戻す用）
  const pending = useRef<{
    patch: UpdateTreeCanvasBody;
    before: TreeCanvasStyle;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const saveRef = useRef(save.mutate);
  useEffect(() => {
    saveRef.current = save.mutate;
  });

  // 閉じるときに、待っている変更を保存する
  useEffect(
    () => () => {
      const p = pending.current;
      if (!p) return;
      clearTimeout(p.timer);
      pending.current = null;
      saveRef.current({ body: p.patch, before: p.before });
    },
    [],
  );

  function change(patch: Partial<TreeCanvasStyle>) {
    previewTreeCanvas(queryClient, treeId, patch);
    const merged = { ...pending.current?.patch, ...patch };
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = {
      patch: merged,
      before: pending.current?.before ?? canvas,
      timer: setTimeout(() => {
        const p = pending.current;
        pending.current = null;
        if (p) saveRef.current({ body: p.patch, before: p.before });
      }, SAVE_DELAY_MS),
    };
  }

  // Reset はキャンバスだけを戻す（カードの見た目のプリセットは別のしくみなので変えない）
  const isDefault =
    canvas.gridStyle === DEFAULT_CANVAS_STYLE.gridStyle &&
    canvas.gridColor === null &&
    canvas.gridOpacity === DEFAULT_CANVAS_STYLE.gridOpacity &&
    canvas.gridSpacing === DEFAULT_CANVAS_STYLE.gridSpacing &&
    canvas.backgroundColor === null;

  return (
    <section
      role="dialog"
      aria-label="Canvas look"
      data-testid="canvas-panel"
      className="bg-surface animate-pop-in absolute inset-x-4 bottom-4 z-20 max-h-[calc(100%-2rem)] origin-bottom overflow-y-auto rounded-xl border border-slate-200 p-4 shadow-xl sm:inset-x-auto sm:top-4 sm:right-4 sm:bottom-auto sm:w-[22rem] sm:origin-top-right"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Canvas</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close canvas settings"
          data-testid="canvas-panel-close"
          className="-mr-2 flex size-11 items-center justify-center rounded-lg text-lg text-slate-500 hover:bg-slate-100 md:size-8"
        >
          ×
        </button>
      </div>

      <div className="space-y-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-800">Grid</legend>
          <div role="radiogroup" className="flex rounded-lg border border-slate-300 p-0.5">
            {STYLES.map((s) => (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={canvas.gridStyle === s.value}
                onClick={() => {
                  change({ gridStyle: s.value });
                }}
                data-testid={`grid-style-${s.value}`}
                className={clsx(
                  "min-h-11 flex-1 rounded-md text-sm font-medium md:min-h-8",
                  canvas.gridStyle === s.value
                    ? "text-surface bg-slate-900"
                    : "text-slate-700 hover:bg-slate-100",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className={clsx(canvas.gridStyle === "NONE" && "pointer-events-none opacity-40")}>
          <label
            htmlFor="canvas-grid-color"
            className="mb-2 block text-sm font-medium text-slate-800"
          >
            Grid color
          </label>
          <ColorField
            id="canvas-grid-color"
            value={canvas.gridColor}
            onChange={(gridColor) => {
              change({ gridColor });
            }}
            fallbackColor={CANVAS_DEFAULTS.grid}
            fallbackLabel="Default"
          />
        </div>

        <div className={clsx(canvas.gridStyle === "NONE" && "pointer-events-none opacity-40")}>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="canvas-grid-opacity" className="text-sm font-medium text-slate-800">
              Grid opacity
            </label>
            <span className="text-sm text-slate-600 tabular-nums">{canvas.gridOpacity}%</span>
          </div>
          <input
            id="canvas-grid-opacity"
            type="range"
            min={0}
            max={100}
            step={5}
            value={canvas.gridOpacity}
            onChange={(e) => {
              change({ gridOpacity: Number(e.target.value) });
            }}
            data-testid="canvas-grid-opacity"
            className="accent-brand-600 h-11 w-full cursor-pointer md:h-6"
          />
        </div>

        <div className={clsx(canvas.gridStyle === "NONE" && "pointer-events-none opacity-40")}>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="canvas-grid-spacing" className="text-sm font-medium text-slate-800">
              Grid spacing
            </label>
            <span className="text-sm text-slate-600 tabular-nums">{canvas.gridSpacing}</span>
          </div>
          <input
            id="canvas-grid-spacing"
            type="range"
            min={12}
            max={64}
            step={4}
            value={canvas.gridSpacing}
            onChange={(e) => {
              change({ gridSpacing: Number(e.target.value) });
            }}
            data-testid="canvas-grid-spacing"
            className="accent-brand-600 h-11 w-full cursor-pointer md:h-6"
          />
        </div>

        <div>
          <label
            htmlFor="canvas-background"
            className="mb-2 block text-sm font-medium text-slate-800"
          >
            Background
          </label>
          <ColorField
            id="canvas-background"
            value={canvas.backgroundColor}
            onChange={(backgroundColor) => {
              change({ backgroundColor });
            }}
            fallbackColor={CANVAS_DEFAULTS.background}
            fallbackLabel="Default"
          />
        </div>

        <button
          type="button"
          disabled={isDefault}
          onClick={() => {
            change({
              gridStyle: DEFAULT_CANVAS_STYLE.gridStyle,
              gridColor: null,
              gridOpacity: DEFAULT_CANVAS_STYLE.gridOpacity,
              gridSpacing: DEFAULT_CANVAS_STYLE.gridSpacing,
              backgroundColor: null,
            });
          }}
          data-testid="canvas-reset"
          className="min-h-11 w-full rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 md:min-h-9"
        >
          Reset canvas
        </button>

        <fieldset className="border-t border-slate-200 pt-4">
          <legend className="sr-only">Node style</legend>
          <p className="mb-1 text-sm font-medium text-slate-800">Nodes</p>
          <p className="mb-2 text-xs text-slate-500">
            How cards look in this tree. The canvas above stays as it is.
          </p>
          <div role="radiogroup" aria-label="Node style" className="grid grid-cols-2 gap-2">
            {NODE_STYLE_ORDER.map((preset) => {
              const t = NODE_STYLES[preset];
              const active = canvas.nodeStyle === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    change({ nodeStyle: preset });
                  }}
                  data-testid={`node-style-${preset}`}
                  className={clsx(
                    "rounded-xl border p-2 text-left",
                    active
                      ? "border-ink ring-ink ring-1"
                      : "border-slate-200 hover:border-slate-400",
                  )}
                >
                  {/* プリセットの見本: カード1枚（題名と説明） */}
                  <span
                    aria-hidden="true"
                    className="block rounded-lg px-2 py-1.5"
                    style={{
                      background: t.card,
                      color: t.text,
                      border: `1px solid ${t.border}`,
                    }}
                  >
                    <span className="block text-xs font-bold" style={{ fontFamily: t.titleFont }}>
                      Controller
                    </span>
                    <span className="block text-[10px] opacity-70">Handles requests.</span>
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-slate-800">{t.label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>
    </section>
  );
}

/** 右下のズーム操作の上に出す「Canvas」ボタン（エディタのみ） */
export function CanvasButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      data-testid="canvas-button"
      className={clsx(
        "flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-medium shadow-sm md:min-h-9",
        open ? "text-surface bg-slate-900" : "bg-surface hover:bg-page text-slate-700",
      )}
    >
      <span aria-hidden="true">▦</span>
      Canvas
    </button>
  );
}

/** 「Tidy up」ボタン: カードが重ならないようにツリー全体を並べ直す（エディタのみ。元に戻せる） */
export function TidyUpButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="Lay out the tree so no cards overlap (undo with ⌘Z / Ctrl+Z)"
      data-testid="tidy-button"
      className="bg-surface hover:bg-page flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 shadow-sm disabled:opacity-40 md:min-h-9"
    >
      <span aria-hidden="true">✦</span>
      Tidy up
    </button>
  );
}
