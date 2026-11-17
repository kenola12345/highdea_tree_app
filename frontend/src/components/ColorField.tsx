import clsx from "clsx";
import { useState } from "react";

const HEX = /^#[0-9a-fA-F]{6}$/;

type ColorFieldProps = {
  id: string;
  /** 選んだ色（#RRGGBB）。null は「既定・受け継ぐ」 */
  value: string | null;
  onChange: (color: string | null) => void;
  /** null のときに実際に使われる色（ピッカーの初期値とボタンの見本） */
  fallbackColor: string;
  /** null を選べる場合のボタンの文言（"Default" / "Inherit"）。省略すると null は選べない */
  fallbackLabel?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

/**
 * 色の選択。OS のカラーピッカーで自由に選び、16進（#RRGGBB）でも入力できる（manifests/nodes.md §3.5 Choosing colors）。
 * 既定の色や祖先の色に戻せる場合は「Default / Inherit」ボタンも出す。線の色・カードの色・カテゴリの色で共通に使う。
 */
export function ColorField({
  id,
  value,
  onChange,
  fallbackColor,
  fallbackLabel,
  ...aria
}: ColorFieldProps) {
  const shown = value ?? fallbackColor;
  // 入力途中（#12 など）の文字を保つための下書き。正しい #RRGGBB になった時だけ確定する
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? value ?? "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative size-11 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-slate-300 md:size-9">
        <span className="sr-only">Pick a color</span>
        <span aria-hidden="true" className="absolute inset-0" style={{ backgroundColor: shown }} />
        <input
          type="color"
          value={shown.toLowerCase()}
          onChange={(e) => {
            setDraft(null);
            onChange(e.target.value.toUpperCase());
          }}
          data-testid={`${id}-picker`}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
      <input
        id={id}
        value={text}
        placeholder={fallbackLabel ? fallbackColor : "#RRGGBB"}
        maxLength={7}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => {
          const next = e.target.value.trim();
          setDraft(next);
          if (HEX.test(next)) onChange(next.toUpperCase());
          else if (next === "" && fallbackLabel) onChange(null);
        }}
        onBlur={() => {
          setDraft(null);
        }}
        className="focus:border-brand-600 focus:ring-brand-100 w-36 rounded-lg border border-slate-300 px-3 py-2 font-mono text-base focus:ring-2 focus:outline-none aria-[invalid=true]:border-red-500 md:text-sm"
        {...aria}
      />
      {fallbackLabel && (
        <button
          type="button"
          aria-pressed={value === null}
          onClick={() => {
            setDraft(null);
            onChange(null);
          }}
          data-testid={`${id}-default`}
          className={clsx(
            "flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium md:min-h-9",
            value === null
              ? "text-surface border-slate-900 bg-slate-900"
              : "border-slate-300 hover:bg-slate-50",
          )}
        >
          <span
            aria-hidden="true"
            className="size-3 rounded-full ring-1 ring-black/10"
            style={{ backgroundColor: fallbackColor }}
          />
          {fallbackLabel}
        </button>
      )}
    </div>
  );
}
