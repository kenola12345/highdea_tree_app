---
paths: "backend/src/**/*"
---

# Backend Coding Standards（バックエンド規約）

## トリガー（いつ参照するか）
- When adding or changing a route, controller, service or middleware
- When implementing an endpoint's validation, errors or response
- When adding an error code or throwing `AppError`
- When working on auth, authorization or ownership checks, password checks or rate limits
- When working on uploads or link previews (SSRF)
- When adding logging

## 目的（何のために）
- To keep business rules in `services/` and route handlers thin
- To return the exact response and error format and status codes from the manifest
- To make every endpoint check auth and ownership the same way

## 参照ファイル
Read `standards/backend.md` and `standards/api.md`. For auth, authorization, uploads or link previews, also read `standards/security.md`. For Prisma queries, see `standards/database.md`.
