import type { FieldError } from "@highdea/shared";
import { useCallback, useState } from "react";
import type { z, ZodType } from "zod";

import { ApiError } from "../api/client";

export type FieldErrors = Record<string, string>;

/** Zod / API の details を「項目名 → 最初のメッセージ」に変換する */
function toFieldErrors(details: FieldError[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const { field, message } of details) {
    errors[field] ??= message;
  }
  return errors;
}

/**
 * フォームの検証とエラー表示をまとめるフック。
 * 送信前にバックエンドと同じ共有スキーマで検証し、サーバーが VALIDATION_ERROR を返したら details を各項目に割り当てる
 * （manifests/common.md §4 Field-level errors）。
 */
export function useApiForm<S extends ZodType>(schema: S) {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  /** 入力値を検証する。問題なければ変換後の値、あれば null を返してエラーを表示する */
  const validate = useCallback(
    (values: unknown): z.infer<S> | null => {
      const result = schema.safeParse(values);
      if (result.success) {
        setFieldErrors({});
        setFormError(null);
        return result.data;
      }
      setFieldErrors(
        toFieldErrors(
          result.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
        ),
      );
      return null;
    },
    [schema],
  );

  /** API のエラーを表示に反映する。項目に割り当てられた場合は true */
  const applyServerError = useCallback(
    (err: unknown, fieldByCode: Partial<Record<string, string>> = {}): boolean => {
      if (err instanceof ApiError) {
        if (err.code === "VALIDATION_ERROR" && err.details?.length) {
          setFieldErrors(toFieldErrors(err.details));
          return true;
        }
        const field = fieldByCode[err.code];
        if (field) {
          setFieldErrors({ [field]: err.message });
          return true;
        }
        setFormError(err.message);
        return false;
      }
      setFormError("Something went wrong. Please try again.");
      return false;
    },
    [],
  );

  const clearErrors = useCallback(() => {
    setFieldErrors({});
    setFormError(null);
  }, []);

  return { fieldErrors, formError, validate, applyServerError, clearErrors, setFormError };
}
