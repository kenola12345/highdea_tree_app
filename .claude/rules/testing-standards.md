---
paths: "{**/*.test.{ts,tsx},**/*.spec.ts,backend/tests/**/*,frontend/tests/**/*}"
---

# Testing Standards（テスト規約）

## トリガー（いつ参照するか）
- When writing or changing unit tests (Vitest)
- When writing or changing API tests (Vitest + Supertest)
- When writing or changing E2E tests (Playwright)
- When adding test factories or helpers, or setting up the test database

## 目的（何のために）
- To cover success, validation, `401`, `404` and every business-rule error for each endpoint
- To keep tests readable (AAA, one behavior per test) and reliable (factories, test DB, no fixed waits)

## 参照ファイル
Read `standards/testing.md`.
