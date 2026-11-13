# Coding Standards — 10. Code Review Checklist（コードレビューチェックリスト）

Part of the coding standards. Start from [index.md](./index.md). Section numbers (§N) refer to the files listed there.

### General
- [ ] `npm run lint`, `npm run typecheck` and `npm test` pass
- [ ] No `any`, no `@ts-ignore`, no `console.log`
- [ ] Naming follows §1.3; business limits use the constants in `shared/src/constants.ts`
- [ ] Request/response types come from `@highdea/shared`, not redefined locally
- [ ] Comments are in Japanese and explain WHY where a business rule is involved
- [ ] The change matches the manifest; if the spec changed, the manifest (and `CLAUDE.md` schema) was updated in the same PR

### Frontend
- [ ] API calls go through `api/` hooks and `apiFetch`; no `fetch` in components
- [ ] Query keys come from `queryKeys`; mutations invalidate every cache the manifest lists
- [ ] Server data isn't copied into `useState`
- [ ] Forms validate with the shared schema and show `details` next to fields
- [ ] Business rules in the UI are derived from data (root has no Delete, 2,000-node limit, removed tree)
- [ ] `data-testid` on elements E2E tests use
- [ ] Tailwind only; text keeps the standard `px-4` gutter on phones (checked at phone width)
- [ ] No `dangerouslySetInnerHTML`; links checked for `http(s)`; videos embedded from parsed IDs

### Backend
- [ ] Route → controller → service layering; business rules only in services
- [ ] Every input validated with a strict Zod schema; controllers read `req.validated`
- [ ] Errors are `AppError` with a code from `shared/src/errors.ts`; status matches the Error Codes table
- [ ] Every status and error code in the endpoint's manifest spec is implemented
- [ ] `requireAuth` / `requireAdmin` present; ownership checked inside the query; hidden resources return `404`
- [ ] No env access outside `config/env.ts`; no secrets or personal data in logs

### Database
- [ ] Schema follows naming, `@map` / `@@map`, `Timestamptz(3)`, enums and `onDelete` rules
- [ ] Migration created and committed; no edits to merged migrations
- [ ] Soft-deleted, removed and deactivated rows are filtered (shared `where` helpers)
- [ ] Only needed fields selected; `passwordHash` never returned
- [ ] Lists are paginated; no N+1 queries
- [ ] Multi-row changes and check-then-write logic run in a transaction using `tx`; no network calls inside
- [ ] Only the single PrismaClient from `lib/prisma.ts` is used

### API
- [ ] Path and method match the manifest's endpoint list
- [ ] `{ data: { ... } }` / `{ error: { code, message, details? } }`; `201` for creates
- [ ] Paged lists return `data.pagination: { page, limit, total }`

### Security
- [ ] Auth cookie options are `httpOnly`, `SameSite=Lax`, `Secure` in production; role read from the DB
- [ ] Passwords hashed with bcrypt; login errors don't reveal which accounts exist
- [ ] Server-only fields can't be set by clients
- [ ] Link preview goes through `ssrfGuard`; uploads checked with `file-type` and stored under a random name
- [ ] Rate limits applied where the manifest requires them

### Tests
- [ ] New endpoints have API tests for success, `400`, `401`, `404` (other user's resource) and each business-rule error
- [ ] Tests use factories and the test database; AAA structure; one behavior per test
- [ ] E2E tests use `data-testid` and auto-waiting, no fixed timeouts

### Git
- [ ] Branch name uses a §7.1 prefix
- [ ] Commits follow `type: 日本語の件名[scope]`, one logical change each, specific files staged
- [ ] No `.env` files, secrets or `backend/uploads/` content committed
