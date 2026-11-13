---
paths: "shared/**/*"
---

# Shared Package Standards（shared パッケージ規約）

## トリガー（いつ参照するか）
- When adding or changing a Zod request schema in `shared/src/schemas/`
- When adding or changing a response type in `shared/src/types/`
- When adding an error code to `shared/src/errors.ts`
- When adding a business-limit constant to `shared/src/constants.ts`

## 目的（何のために）
- To keep one definition of request and response shapes, error codes and limits for both frontend and backend
- To keep validation identical on both sides

## 参照ファイル
Read `standards/general.md` (types, naming, constants) and `standards/api.md` (response format, status codes). For schema rules (strict objects, trimming, field errors), see §3.5 in `standards/backend.md`.
