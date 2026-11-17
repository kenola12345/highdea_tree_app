import { NODE_FONT_SIZE_DEFAULT, NODE_FONT_SIZE_MAX, NODE_FONT_SIZE_MIN } from "@highdea/shared";

import { ColorField } from "../../components/ColorField";

type NodeTextFieldsProps = {
  /** メモの文字の大きさ（null は既定） */
  fontSize: number | null;
  /** 文字の色（null は自動） */
  textColor: string | null;
  /** 「Auto」のときに使われる色（カードの色に対して読みやすい方） */
  autoTextColor: string;
  onFontSizeChange: (size: number | null) => void;
  onTextColorChange: (color: string | null) => void;
};

/**
 * M-04 の文字の大きさと色（manifests/nodes.md §3.5 Text size and color）。
 * 大きさはスライダー（10–28 px。題名は少し大きく太字）で「Default」に戻せる。色はカラーピッカーで「Auto」に戻せる。
 */
export function NodeTextFields({
  fontSize,
  textColor,
  autoTextColor,
  onFontSizeChange,
  onTextColorChange,
}: NodeTextFieldsProps) {
  const size = fontSize ?? NODE_FONT_SIZE_DEFAULT;
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label htmlFor="node-font-size" className="text-sm font-medium text-slate-800">
            Text size
          </label>
          <div className="flex items-center gap-2">
            <span
              className="text-sm text-slate-600 tabular-nums"
              data-testid="node-font-size-value"
            >
              {size}px
            </span>
            <button
              type="button"
              disabled={fontSize === null}
              onClick={() => {
                onFontSizeChange(null);
              }}
              data-testid="node-font-size-default"
              className="min-h-11 rounded-full px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 md:min-h-8"
            >
              Default
            </button>
          </div>
        </div>
        <input
          id="node-font-size"
          type="range"
          min={NODE_FONT_SIZE_MIN}
          max={NODE_FONT_SIZE_MAX}
          step={1}
          value={size}
          onChange={(e) => {
            const next = Number(e.target.value);
            onFontSizeChange(next === NODE_FONT_SIZE_DEFAULT ? null : next);
          }}
          className="accent-brand-600 h-11 w-full cursor-pointer md:h-6"
        />
      </div>
      <div>
        <label htmlFor="node-text-color" className="block text-sm font-medium text-slate-800">
          Text color
        </label>
        <p className="mb-2 text-xs text-slate-500">Auto picks dark or white text for the card.</p>
        <ColorField
          id="node-text-color"
          value={textColor}
          onChange={onTextColorChange}
          fallbackColor={autoTextColor}
          fallbackLabel="Auto"
        />
      </div>
    </div>
  );
}
