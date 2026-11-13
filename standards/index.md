# Highdea Tree — Coding Standards Index（コーディング規約）

> Status: v1.0 (2026-11-13). Based on manifest v1.0. Split by topic so you only read what the task needs.

**Purpose.** These are the rules every developer and coding agent follows while implementing Highdea Tree, so the code stays consistent, safe and easy to review.

**Scope.** All code in the monorepo: `shared/`, `backend/`, `frontend/`, the Prisma schema and migrations, tests, Git usage and environment variables.

**Source of truth.** The manifest in [`manifests/`](../manifests/index.md) decides features, the API, the data model and the stack. **If these standards and the manifest disagree, the manifest wins.** Fix the standards file in the same change. Rules marked *(manifest)* restate a manifest decision; everything else is a team convention set here and can be changed by agreement.

## Reading Rule

Read only the file(s) for the task, using the table below. Don't read every file. `general.md` applies to all TypeScript code.

## File Map

| § | File | Covers | Read it when… |
|---|---|---|---|
| 1 | [general.md](./general.md) | tsconfig, ESLint, Prettier, type rules, naming, shared constants, import order, comments | Writing any TypeScript, creating files or directories, naming things |
| 2 | [frontend.md](./frontend.md) | Frontend directories, components, hooks and the fetch client, query keys and cache invalidation, Tailwind and the mobile gutter, state management, forms, canvas | Working in `frontend/` |
| 3 | [backend.md](./backend.md) | Backend directories, layers (routes → controllers → services), routing, `AppError` and the error handler, Zod validation, logging | Working in `backend/src/` |
| 4 | [database.md](./database.md) | Prisma schema rules, migrations, the PrismaClient, query rules (soft delete, select, pagination, N+1), transactions | Changing `schema.prisma` or migrations, or writing Prisma queries in services |
| 5 | [api.md](./api.md) | REST naming, the `{ data }` / `{ error }` format, status codes | Adding or changing an endpoint, or a response or error shape (backend or `frontend/src/api/`) |
| 6 | [testing.md](./testing.md) | Test file layout, naming, AAA, API test coverage, test DB, E2E rules | Writing or fixing tests |
| 7 | [git.md](./git.md) | Branch names, commit messages | Creating a branch or a commit |
| 8 | [environment.md](./environment.md) | `.env` files, `config/env.ts`, frontend variables | Adding or reading an environment variable |
| 9 | [security.md](./security.md) | JWT cookie, passwords, authorization and ownership, input validation, SSRF, uploads, XSS, CORS, secrets and logging | Auth, authorization, uploads, link previews, rendering user content, any security-sensitive change |
| 10 | [review-checklist.md](./review-checklist.md) | Checkbox list covering §1–9 | Reviewing code or a PR, or self-checking before a commit |

## Typical Combinations

| Task | Files |
|---|---|
| New backend endpoint | general, backend, api, database, security, testing |
| New React page or modal | general, frontend, api (only if adding an API hook) |
| Canvas / drag work | general, frontend |
| Schema change | database (and update the manifest and `CLAUDE.md` first) |
| Auth or account features | general, backend, security, api |
| Code review | review-checklist (open the linked section only for a rule you need to check) |

## Related Files

When you change a standards file, re-check these:

| File you change | Also check |
|---|---|
| general.md | frontend.md, backend.md (examples use the naming and constants rules), review-checklist.md |
| frontend.md, backend.md, database.md, api.md, testing.md, git.md, environment.md, security.md | review-checklist.md (its items mirror these rules) |
| api.md | backend.md (error handler), frontend.md (fetch client) |
| Any file | `.claude/rules/*.md` if the file was renamed or its scope changed |
