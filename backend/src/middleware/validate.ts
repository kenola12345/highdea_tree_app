import type { FieldError } from "@highdea/shared";
import type { Request, RequestHandler } from "express";
import type { z, ZodType } from "zod";

import { AppError } from "../errors/AppError.js";

type Schemas = { params?: ZodType; query?: ZodType; body?: ZodType };
type Part = keyof Schemas;

/**
 * リクエストの params・query・body を Zod で検証するミドルウェア（全入力を検証: CLAUDE.md）。
 * 失敗したら 400 VALIDATION_ERROR を、どのフィールドが不正かを details に入れて返す。
 * 検証・変換後の値は req.validated に入る（Express 5 の req.query は書き換えられないため別の場所に置く）。
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    const details: FieldError[] = [];
    const validated: Partial<Record<Part, unknown>> = {};
    for (const part of ["params", "query", "body"] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(part === "body" ? (req.body ?? {}) : req[part]);
      if (result.success) {
        validated[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          details.push({ field: issue.path.join(".") || part, message: issue.message });
        }
      }
    }
    if (details.length > 0) throw new AppError("VALIDATION_ERROR", undefined, details);
    req.validated = { ...req.validated, ...validated };
    next();
  };
}

/** validate() 済みの値を型付きで取り出す。validate を付け忘れたルートでは 500 にして気づけるようにする */
export function getValidated<S extends ZodType>(req: Request, part: Part, _schema: S): z.infer<S> {
  const value = req.validated?.[part];
  if (value === undefined) throw new Error(`validate() is missing for req.${part}`);
  return value as z.infer<S>;
}
