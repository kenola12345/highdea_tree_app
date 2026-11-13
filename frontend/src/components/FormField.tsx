import type { ReactNode } from "react";

type FieldProps = { id: string; "aria-invalid": boolean; "aria-describedby"?: string };

type FormFieldProps = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  /** 入力要素を描画する関数。id と aria 属性を受け取ってそのまま渡す */
  children: (props: FieldProps) => ReactNode;
};

/** ラベル・入力・ヒント・エラーをまとめたフォーム項目。エラーは入力欄のすぐ下に出す（サーバーの details も同じ場所） */
export function FormField({ id, label, error, hint, children }: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-red-700" data-testid={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

/** 入力欄の共通クラス */
export const inputClassName =
  "block w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-brand-600 focus:ring-2 focus:ring-brand-100 focus:outline-none aria-[invalid=true]:border-red-500 md:text-sm";
