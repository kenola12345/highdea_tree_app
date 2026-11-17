import {
  NODE_HEIGHT_MAX,
  NODE_HEIGHT_MIN,
  NODE_WIDTH_MAX,
  NODE_WIDTH_MIN,
  type NodeShape,
} from "@highdea/shared";
import clsx from "clsx";

import { inputClassName } from "../../components/FormField";

export const NODE_SHAPES: { shape: NodeShape; label: string; preview: string }[] = [
  { shape: "ROUNDED", label: "Rounded", preview: "rounded-md" },
  { shape: "RECTANGLE", label: "Square", preview: "rounded-none" },
  { shape: "PILL", label: "Pill", preview: "rounded-full" },
  { shape: "ELLIPSE", label: "Circle", preview: "rounded-[50%]" },
];

/** 大きさの入力欄の文字（空欄は既定の大きさ） */
export type SizeText = { width: string; height: string };

type NodeShapeFieldsProps = {
  shape: NodeShape;
  size: SizeText;
  errors: { width?: string; height?: string };
  onShapeChange: (shape: NodeShape) => void;
  onSizeChange: (size: SizeText) => void;
};

/**
 * M-04 の形と大きさ（manifests/nodes.md §3.5 Card shape and size）。
 * 形は Rounded / Square / Pill / Circle、大きさは幅と高さ（空欄なら中身に合わせた大きさ。「Auto」で空欄に戻す）。
 */
export function NodeShapeFields({
  shape,
  size,
  errors,
  onShapeChange,
  onSizeChange,
}: NodeShapeFieldsProps) {
  return (
    <div className="space-y-4">
      <div>
        <p id="node-shape-label" className="mb-2 block text-sm font-medium text-slate-800">
          Shape
        </p>
        <div
          role="radiogroup"
          aria-labelledby="node-shape-label"
          className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1"
        >
          {NODE_SHAPES.map((s) => (
            <button
              key={s.shape}
              type="button"
              role="radio"
              aria-checked={shape === s.shape}
              data-testid={`shape-${s.shape}`}
              onClick={() => {
                onShapeChange(s.shape);
              }}
              className={clsx(
                "flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium md:min-h-9",
                shape === s.shape
                  ? "bg-surface text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              <span
                aria-hidden="true"
                className={clsx("h-4 w-7 border-2 border-current", s.preview)}
              />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-800">Size</p>
          <button
            type="button"
            disabled={size.width === "" && size.height === ""}
            onClick={() => {
              onSizeChange({ width: "", height: "" });
            }}
            data-testid="node-size-auto"
            className="min-h-11 rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 md:min-h-8"
          >
            Auto
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SizeInput
            id="node-width"
            label="Width"
            value={size.width}
            min={NODE_WIDTH_MIN}
            max={NODE_WIDTH_MAX}
            error={errors.width}
            onChange={(width) => {
              onSizeChange({ ...size, width });
            }}
          />
          <SizeInput
            id="node-height"
            label="Height"
            value={size.height}
            min={NODE_HEIGHT_MIN}
            max={NODE_HEIGHT_MAX}
            error={errors.height}
            onChange={(height) => {
              onSizeChange({ ...size, height });
            }}
          />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Leave empty (Auto) to fit the content. You can also drag the corners of the selected card.
        </p>
      </div>
    </div>
  );
}

function SizeInput({
  id,
  label,
  value,
  min,
  max,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  min: number;
  max: number;
  error: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-slate-600">
        {label} ({min}–{max})
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={value}
        placeholder="Auto"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className={inputClassName}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-700" data-testid={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * 大きさの入力欄の文字を数値にする（純粋関数）。空欄は null（既定の大きさ）。範囲外・小数はエラー。
 */
export function parseSize(text: SizeText):
  | { ok: true; width: number | null; height: number | null }
  | {
      ok: false;
      errors: { width?: string; height?: string };
    } {
  const errors: { width?: string; height?: string } = {};
  const one = (v: string, min: number, max: number, key: "width" | "height") => {
    const trimmed = v.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n < min || n > max) {
      errors[key] = `Use a whole number from ${String(min)} to ${String(max)}`;
      return null;
    }
    return n;
  };
  const width = one(text.width, NODE_WIDTH_MIN, NODE_WIDTH_MAX, "width");
  const height = one(text.height, NODE_HEIGHT_MIN, NODE_HEIGHT_MAX, "height");
  if (errors.width || errors.height) return { ok: false, errors };
  return { ok: true, width, height };
}
