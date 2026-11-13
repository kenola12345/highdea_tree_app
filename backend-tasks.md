# Backend Implementation Task List（バックエンド実装タスクリスト）

> Source: `manifests/` v1.0 (common.md §5–§9 + the API sections of users.md, trees.md, nodes.md, explore.md) and `standards/` (backend, database, api, security, testing).
> Each task fits in 15 minutes or less. Mark it `[x]` when done. Tasks are numbered `<Phase>-<n>`.
> Paths are relative to the project root `highdea_tree_app/` (the repository root).

**Endpoint spec rule:** each endpoint task means "implement exactly what its manifest spec says": validation, authorization (`404` for resources the caller may not see), processing, success status and fields, and every listed error code.

---

## Phase 1: Environment Setup（環境構築・基本設定） 【直列】
- Depends on: none
- Main files: `package.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`, `.gitignore`, `docker-compose.yml`, `shared/package.json`, `shared/tsconfig.json`, `backend/package.json`, `backend/tsconfig.json`, `backend/.env.example`, `backend/.env`, `backend/.env.test`, `backend/prisma.config.ts`, `backend/prisma/schema.prisma`, `backend/prisma/migrations/**`, `backend/src/config/env.ts`, `backend/src/lib/prisma.ts`, `backend/src/app.ts`, `backend/src/server.ts`, `backend/vitest.config.ts`

- [x] 1-1 Confirm the project root `highdea_tree_app/` (the repository root) and create the empty directories `shared/src/`, `backend/src/`, `backend/prisma/`, `backend/scripts/`, `backend/tests/` and `backend/uploads/` (with a `.gitkeep`)
- [x] 1-2 Create the root `package.json`: `"private": true`, `"type": "module"`, npm workspaces `shared`, `backend`, `frontend`; scripts `dev`, `test`, `test:e2e`, `lint`, `typecheck` (the frontend ones can be placeholders until the frontend exists)
- [x] 1-3 Create `tsconfig.base.json` exactly as in `standards/general.md` §1.1
- [x] 1-4 Install root dev dependencies (`typescript@6.0` — not 7.0, which typescript-eslint doesn't support yet; `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-simple-import-sort`, `eslint-plugin-react-hooks`, `eslint-config-prettier`, `prettier`, `prettier-plugin-tailwindcss`) and create `eslint.config.js` and `.prettierrc.json` from `standards/general.md` §1.1
- [x] 1-5 Update `.gitignore`: `node_modules/`, `dist/`, `.env`, `.env.*`, `!.env.example`, `backend/uploads/*`, `!backend/uploads/.gitkeep`, `playwright-report/`, `test-results/`
- [x] 1-6 Create `docker-compose.yml` with one `db` service: `postgres:18`, user/password/db `highdea`, port `5432`, a named volume, and an init script that also creates the `highdea_test` database. Check: `docker compose up -d` starts and `psql` connects to both databases
- [x] 1-7 Create `shared/package.json` (name `@highdea/shared`, `"type": "module"`, `exports` → `src/index.ts`, dependency `zod@4.6`) and `shared/tsconfig.json` (extends the base, `nodenext`)
- [x] 1-8 Create `backend/package.json` (`"type": "module"`) and install runtime dependencies: `express@5.3`, `zod@4.6`, `@prisma/client@7.10.1`, `@prisma/adapter-pg@7.10.1`, `pg@8.23`, `jsonwebtoken@9.0`, `bcrypt@6.0`, `cookie-parser@1.4`, `helmet@8.3`, `cors@2.8`, `express-rate-limit@8.7`, `multer@2.5`, `file-type@22.3`, `cheerio@1.2`, `node-cron@4.6`, `@highdea/shared` (workspace)
- [x] 1-9 Install backend dev dependencies: `prisma@7.10.1`, `tsx@4.23`, `vitest@5.1`, `supertest@7.3`, and the `@types/*` packages (`node`, `express`, `jsonwebtoken`, `bcrypt`, `cookie-parser`, `cors`, `multer`, `supertest`)
- [x] 1-10 Add backend scripts: `dev` (`tsx watch src/server.ts`), `start`, `build`, `typecheck`, `test`, `prisma:migrate` (`prisma migrate dev`), `prisma:generate`, `seed` (`tsx prisma/seed.ts`), `make-admin` (`tsx scripts/make-admin.ts`)
- [x] 1-11 Create `backend/tsconfig.json` from `standards/general.md` §1.1. Check: `npm run typecheck -w backend` runs
- [x] 1-12 Create `backend/.env.example` with the 6 variables from manifest §9.3 (`standards/environment.md` §8.1), copy it to `backend/.env` with a random `JWT_SECRET`, and create `backend/.env.test` pointing to `highdea_test`
- [x] 1-13 Implement `backend/src/config/env.ts`: Zod schema for the 6 variables, exit with a clear message when invalid (`standards/environment.md` §8.2). Check: removing `JWT_SECRET` makes startup fail with a readable error
- [x] 1-14 Create `backend/prisma.config.ts` (Prisma 7: schema path, migrations path, `DATABASE_URL`, seed command)
- [x] 1-15 Copy the schema from `manifests/common.md` §5.4 into `backend/prisma/schema.prisma` unchanged. Check: `npx prisma validate` passes
- [x] 1-16 Run `npm run prisma:migrate -w backend -- --name init --create-only`, then add the one-root-per-tree partial unique index (`nodes_one_root_per_tree`) as raw SQL at the end of the migration, with a comment (`standards/database.md` §4.2)
- [x] 1-17 Apply the migration and generate the client. Check: the 6 tables, 3 enums and the partial index exist in `highdea` (`\d nodes`)
- [x] 1-18 Implement `backend/src/lib/prisma.ts`: one `PrismaClient` with `PrismaPg`, query logging only in development (`standards/database.md` §4.3)
- [x] 1-19 Create a minimal `backend/src/app.ts` that builds and exports the Express app (JSON body parser, `GET /api/health` → `{ data: { ok: true } }`), and `backend/src/server.ts` that calls `listen(env.PORT)`. Check: `npm run dev -w backend` and `curl localhost:3000/api/health` returns `200`
- [x] 1-20 Create `backend/vitest.config.ts` (node environment, loads `.env.test`, runs files one at a time) and one smoke test for `/api/health` with Supertest. Check: `npm test -w backend` passes

---

## Phase 2: Common Foundation（共通基盤） 【直列】
- Depends on: Phase 1
- Main files: `shared/src/index.ts`, `shared/src/constants.ts`, `shared/src/errors.ts`, `shared/src/schemas/*.ts` (all files created here as stubs), `shared/src/types/*.ts` (all files created here as stubs), `backend/src/errors/AppError.ts`, `backend/src/middleware/{errorHandler,validate}.ts`, `backend/src/lib/logger.ts`, `backend/src/types/express.d.ts`, `backend/src/services/common/*.ts`, `backend/src/routes/*.routes.ts` (all 10 created here as empty routers), `backend/src/app.ts`
- Why serial: this Phase creates every shared file, so the feature Phases afterwards only touch their own files

- [x] 2-1 Create `shared/src/constants.ts` with every business limit: `MAX_NODES_PER_TREE` (2000), `MAX_CATEGORIES_PER_USER` (100), `MAX_CATEGORIES_PER_TREE` (10), `TRASH_RETENTION_DAYS` (10), `MAX_UPLOAD_BYTES` (5 MB), `NODE_TITLE_MAX` (200), `NODE_BODY_MAX` (10,000), `NODE_DETAILS_BATCH_MAX` (100), `PAGE_LIMIT_DEFAULT` (20) / `PAGE_LIMIT_MAX` (50), `RESERVED_USERNAMES`, `ALLOWED_IMAGE_TYPES`
- [x] 2-2 Create `shared/src/errors.ts`: `ERROR_STATUS` for all 29 codes in the manifest's Error Codes table, the `ErrorCode` type, `FieldError` and `ApiErrorBody` types (`standards/backend.md` §3.4)
- [x] 2-3 Create `shared/src/schemas/common.ts`: `idParamSchema` (cuid string), `usernameParamSchema`, `paginationQuerySchema` (`page` ≥ 1 default 1, `limit` 1–50 default 20, coerced from strings)
- [x] 2-4 Create empty stub files `shared/src/schemas/{auth,users,trees,nodes,categories,explore,uploads,linkPreview,admin}.ts` and `shared/src/types/{user,tree,node,category,upload,pagination}.ts` (with `Pagination = { page, limit, total }`), and a barrel `shared/src/index.ts` that re-exports every file. Check: `import { paginationQuerySchema } from "@highdea/shared"` works in the backend
- [x] 2-5 Implement `backend/src/errors/AppError.ts`: code → status from `ERROR_STATUS`, a default English message per code, optional `details`
- [x] 2-6 Implement `backend/src/lib/logger.ts` (JSON lines; info/warn/error; never logs bodies, cookies or passwords)
- [x] 2-7 Implement `backend/src/middleware/errorHandler.ts`: `AppError` → `{ error: { code, message, details? } }`; Multer's file-size error → `FILE_TOO_LARGE`; malformed JSON → `VALIDATION_ERROR`; anything else → `500 INTERNAL_ERROR` with the real error logged only (`standards/backend.md` §3.4)
- [x] 2-8 Implement `backend/src/middleware/validate.ts` (params, query, body; Zod issues → `VALIDATION_ERROR` with `details[{ field, message }]`; result in `req.validated`) and `backend/src/types/express.d.ts` declaring `req.user` (`{ id, role }`) and `req.validated`
- [x] 2-9 Create the 10 route files `backend/src/routes/{auth,users,trees,trash,nodes,categories,explore,uploads,linkPreview,admin}.routes.ts`, each exporting an empty `Router()`
- [x] 2-10 Finish `backend/src/app.ts`: `helmet()`, `cors({ origin: env.CORS_ORIGIN, credentials: true })`, `cookie-parser`, JSON body limit, mount all 10 routers under `/api`, `/api/*` fallback → `404` with the common error shape, then `errorHandler`
- [x] 2-11 Serve uploaded files in `app.ts`: `express.static(env.UPLOAD_DIR)` at `/uploads` with `X-Content-Type-Options: nosniff` and no directory listing (manifest nodes.md, `POST /api/uploads`)
- [x] 2-12 Create `backend/src/services/common/treeAccess.ts`: `publicTreeWhere` (PUBLIC, not removed, not in the Trash, owner active) and `visibleTreeWhere(viewerId?)` (owner sees own non-deleted trees; others see public trees) (`standards/database.md` §4.4)
- [x] 2-13 Create `backend/src/services/common/treeMapper.ts`: the tree summary select and `toTreeSummary()` (`id`, `title`, `description`, `visibility`, `categories[{ id, name, color }]`, `nodeCount`, `removedAt`, `updatedAt`, owner fields as the specs require) shared by My Trees, Trash, profiles and Explore
- [x] 2-14 Create `backend/src/services/common/pagination.ts`: `toSkipTake(page, limit)` and `toPagination(page, limit, total)`
- [x] 2-15 Tests: `backend/tests/foundation.api.test.ts` checks the unknown-route `404`, a forced `AppError`, a forced unknown error (`500` without internals) and a `VALIDATION_ERROR` with `details`

---

## Phase 3: Authentication and Test Helpers（認証・テスト基盤） 【直列】
- Depends on: Phase 2
- Main files: `backend/src/lib/{password,jwt}.ts`, `backend/src/middleware/{auth,requireAdmin,rateLimits}.ts`, `shared/src/schemas/auth.ts`, `shared/src/types/user.ts`, `backend/src/services/auth.service.ts`, `backend/src/controllers/auth.controller.ts`, `backend/src/routes/auth.routes.ts`, `backend/tests/helpers/**`, `backend/tests/auth.api.test.ts`
- Endpoints: `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- Why serial: every later Phase uses the auth middleware, rate limiters and test helpers

- [x] 3-1 Implement `backend/src/lib/password.ts`: `hashPassword` (bcrypt, cost 12) and `verifyPassword`
- [x] 3-2 Implement `backend/src/lib/jwt.ts`: `signToken(userId)` (HS256, `sub` + `exp` only, 7 days), `verifyToken`, `setAuthCookie(res, userId)` and `clearAuthCookie(res)` (`access_token`, `httpOnly`, `SameSite=Lax`, `Secure` in production, `path=/`) (`standards/security.md` §9.1)
- [x] 3-3 Implement `backend/src/middleware/auth.ts`: `requireAuth` (verify cookie → load the user from the DB → missing or deactivated → clear cookie + `401 UNAUTHENTICATED` → `req.user = { id, role }`), `optionalAuth` (invalid cookie = guest) and `guestOnly` (valid cookie of an active user → `403 ALREADY_AUTHENTICATED`)
- [x] 3-4 Implement `backend/src/middleware/requireAdmin.ts`: `req.user.role !== "ADMIN"` → `403 FORBIDDEN` (role read from the DB by `requireAuth`)
- [x] 3-5 Implement the IP limiters in `backend/src/middleware/rateLimits.ts`: `signupLimiter` (5 per 15 min per IP) and `loginLimiter` (5 **failed** per 15 min per IP, `skipSuccessfulRequests`), both answering `429 RATE_LIMITED` in the common error shape
- [x] 3-6 Add the per-user limiters to `rateLimits.ts`: `passwordCheckLimiter` (5 **wrong passwords** per user per 15 min, shared by the account, password and deactivate endpoints, counting only `403 WRONG_PASSWORD` responses), `linkPreviewLimiter` (30 per user per min) and `uploadLimiter` (60 per user per hour)
- [x] 3-7 Fill `shared/src/schemas/auth.ts`: `usernameSchema`, `passwordSchema` (8–72), `signupSchema`, `loginSchema` (password 1–72), all `z.strictObject` (`standards/backend.md` §3.5)
- [x] 3-8 Fill `shared/src/types/user.ts`: `MeResponse` (`id`, `email`, `username`, `displayName`, `avatarUrl`, `role`, `createdAt`) and `PublicUserResponse` (`id`, `username`, `displayName`, `avatarUrl`, `createdAt`); add `toMeResponse()` in `backend/src/services/common/userMapper.ts`
- [x] 3-9 `AuthService.signup`: reserved username → `400 USERNAME_RESERVED`; email or username taken (including deactivated accounts) → `409 EMAIL_TAKEN` / `USERNAME_TAKEN` (also map the `P2002` unique violation); hash the password; create the user
- [x] 3-10 `AuthService.login`: unknown email, wrong password or deactivated account → the same `401 INVALID_CREDENTIALS`; compare a dummy hash when the email is unknown so timing doesn't reveal accounts
- [x] 3-11 `AuthService.me`: load the active user by ID and return `MeResponse`
- [x] 3-12 `backend/src/controllers/auth.controller.ts` + `auth.routes.ts`: `POST /signup` (`guestOnly`, `signupLimiter`, `validate`, set cookie, `201`), `POST /login` (`guestOnly`, `loginLimiter`, set cookie, `200`), `POST /logout` (no auth needed, clear cookie, `200`), `GET /me` (`requireAuth`, `200`)
- [x] 3-13 Create `backend/tests/helpers/db.ts`: truncate all tables (`TRUNCATE ... CASCADE`) before each test file; refuse to run unless `DATABASE_URL` points to `highdea_test`
- [x] 3-14 Create `backend/tests/helpers/factories.ts`: `createUser`, `createLoggedInUser` (returns the user and a `Cookie` header), `createAdmin`, `createTree` (with its root node, optional visibility/removed/deleted state), `createCategory`, `createNodes(treeId, n)`, `createUpload`
- [x] 3-15 Tests: signup (`201` + cookie, `400` with `details`, `USERNAME_RESERVED`, `EMAIL_TAKEN`, `USERNAME_TAKEN` including a deactivated account, `ALREADY_AUTHENTICATED`, `429` on the 6th attempt)
- [x] 3-16 Tests: login (`200` + cookie, `INVALID_CREDENTIALS` for wrong password / unknown email / deactivated, `ALREADY_AUTHENTICATED`, `429` after 5 failures), logout (clears the cookie with and without a valid cookie), me (`200`, `401` for guests, `401` + cookie cleared for a deactivated user)
- [x] 3-17 Tests: `requireAdmin` returns `403 FORBIDDEN` for a `USER`, and a role changed in the DB takes effect on the next request with the same token

---

## Phase 4: Users API（ユーザーAPI） 【並列可】
- Depends on: Phase 3
- Main files: `shared/src/schemas/users.ts`, `backend/src/services/user.service.ts`, `backend/src/controllers/users.controller.ts`, `backend/src/routes/users.routes.ts`, `backend/tests/users.api.test.ts` (no overlap with other Phases)
- Endpoints: `GET /api/users/:username`, `PATCH /api/users/me`, `PATCH /api/users/me/account`, `PATCH /api/users/me/password`, `POST /api/users/me/deactivate`

- [ ] 4-1 Fill `shared/src/schemas/users.ts`: `updateProfileSchema` (`displayName`, `avatarUrl`; at least one field), `updateAccountSchema` (`email`?, `username`?, `currentPassword`; at least one of email/username), `changePasswordSchema` (`newPassword` ≠ `currentPassword`), `deactivateSchema` (`password`)
- [ ] 4-2 `UserService.getPublicProfile(username, page, limit)`: lowercase the username; missing or deactivated → `404 USER_NOT_FOUND`; return `PublicUserResponse` + the user's public trees (`publicTreeWhere`, newest `updatedAt` first, `toTreeSummary`) + pagination
- [ ] 4-3 `UserService.updateProfile(userId, body)`: update only `displayName` / `avatarUrl`, return `MeResponse`
- [ ] 4-4 Add `UserService.checkCurrentPassword(userId, password)`: wrong → `403 WRONG_PASSWORD` (counted by `passwordCheckLimiter`)
- [ ] 4-5 `UserService.updateAccount`: check the password; reserved username → `400 USERNAME_RESERVED`; email/username taken by any other account (including deactivated) → `409 EMAIL_TAKEN` / `USERNAME_TAKEN` (also from `P2002`); save. The old username is released at once (no redirect, no reservation)
- [ ] 4-6 `UserService.changePassword`: check the current password, hash and save the new one; the user stays logged in
- [ ] 4-7 `UserService.deactivate`: check the password, set `deletedAt`; the controller clears the auth cookie
- [ ] 4-8 `backend/src/controllers/users.controller.ts` + `users.routes.ts`: `GET /:username` (public, no auth), `PATCH /me` (`requireAuth`), `PATCH /me/account`, `PATCH /me/password`, `POST /me/deactivate` (`requireAuth`, `passwordCheckLimiter`). Register `/me/*` routes before `/:username`
- [ ] 4-9 Tests: `GET /api/users/:username` (`200` with only public trees; private, removed and Trash trees excluded; email and role never returned; `404` for unknown and deactivated users; uppercase username works; pagination)
- [ ] 4-10 Tests: `PATCH /me` (`200`, `400` empty body or unknown field such as `role`, `401`)
- [ ] 4-11 Tests: `PATCH /me/account` (email change, username change and old name reusable by another user, `WRONG_PASSWORD`, `USERNAME_RESERVED`, `EMAIL_TAKEN`, `USERNAME_TAKEN`, `401`)
- [ ] 4-12 Tests: `PATCH /me/password` (login works with the new password, same-password `400`, `WRONG_PASSWORD`) and `POST /me/deactivate` (cookie cleared, old token gets `401`, login fails, email and username stay taken)
- [ ] 4-13 Test: the 6th wrong password within 15 minutes across the three password endpoints returns `429 RATE_LIMITED`

---

## Phase 5: Trees & Trash API（ツリー・ゴミ箱API） 【並列可】
- Depends on: Phase 3
- Main files: `shared/src/schemas/trees.ts`, `shared/src/types/tree.ts`, `backend/src/services/{tree,trash}.service.ts`, `backend/src/controllers/{trees,trash}.controller.ts`, `backend/src/routes/{trees,trash}.routes.ts`, `backend/src/jobs/purgeTrash.ts`, `backend/tests/{trees,trash}.api.test.ts`, `backend/tests/jobs/purgeTrash.test.ts` (no overlap with other Phases)
- Endpoints: `GET /api/trees`, `POST /api/trees`, `GET /api/trees/:id`, `PATCH /api/trees/:id`, `DELETE /api/trees/:id`, `GET /api/trash`, `POST /api/trees/:id/restore`
- Note: the route `POST /api/trees/:id/restore` lives in `trash.routes.ts` (mounted under `/api`), so `trees.routes.ts` and `trash.routes.ts` don't both need editing by different Phases

- [ ] 5-1 Fill `shared/src/schemas/trees.ts`: `listTreesQuerySchema` (pagination + `categoryId`), `createTreeSchema` (`title` 1–100, `description` ≤ 500, `visibility`, `categoryIds` up to 10 with duplicates removed, `rootTitle` 1–200 defaulting to `title`), `updateTreeSchema` (at least one field)
- [ ] 5-2 Fill `shared/src/types/tree.ts`: `TreeSummary`, `TreeDetailResponse` (tree, categories, owner, removal info for the owner, `isOwner`, node skeleton `NodeSkeleton[]`: `id`, `parentId`, `type`, `title`, `positionX`, `positionY`, `sortOrder`), `TrashItem` (with `purgeAt`)
- [ ] 5-3 Add `TreeService.assertOwnCategories(tx, userId, categoryIds)`: any missing or foreign ID → `404 CATEGORY_NOT_FOUND`
- [ ] 5-4 `TreeService.listMine(userId, query)`: own trees with `deletedAt = null`, optional `categoryId` filter (foreign/missing → `CATEGORY_NOT_FOUND`), newest `updatedAt` first, `_count` for `nodeCount`, pagination
- [ ] 5-5 `TreeService.create(userId, body)`: one transaction: create the tree, its root node and the category tags; return `TreeSummary` (`201`)
- [ ] 5-6 `TreeService.getDetail(viewer, treeId)`: visible to the owner (not deleted) or to anyone if public; otherwise `404 TREE_NOT_FOUND`; return tree + categories + owner + node skeleton (all nodes, skeleton fields only) + `isOwner`; removal reason only for the owner
- [ ] 5-7 `TreeService.update(userId, treeId, body)`: owner and not deleted, else `404`; setting `PUBLIC` on a removed tree → `409 TREE_REMOVED`; categories replaced in a transaction (`CATEGORY_NOT_FOUND` rolls back)
- [ ] 5-8 `TreeService.moveToTrash(userId, treeId)`: owner and not already deleted, else `404`; set `deletedAt`; return the tree with `purgeAt`
- [ ] 5-9 `TrashService.list(userId, page, limit)`: own trees with `deletedAt` set, most recently deleted first, `purgeAt = deletedAt + TRASH_RETENTION_DAYS`
- [ ] 5-10 `TrashService.restore(userId, treeId)`: missing / purged / foreign → `404 TREE_NOT_FOUND`; not deleted → `409 TREE_NOT_IN_TRASH`; clear `deletedAt` (visibility and categories kept as they were)
- [ ] 5-11 `backend/src/controllers/trees.controller.ts` + `trees.routes.ts`: `GET /trees` (`requireAuth`), `POST /trees` (`requireAuth`, `201`), `GET /trees/:id` (`optionalAuth`), `PATCH /trees/:id`, `DELETE /trees/:id` (`requireAuth`)
- [ ] 5-12 `backend/src/controllers/trash.controller.ts` + `trash.routes.ts`: `GET /trash`, `POST /trees/:id/restore` (`requireAuth`)
- [ ] 5-13 Implement `backend/src/jobs/purgeTrash.ts`: export `purgeTrash(now)` that hard-deletes trees whose `deletedAt` is older than 10 days (nodes and tags go by CASCADE) and logs the count, plus `schedulePurgeTrash()` (daily `node-cron`). Registration in `server.ts` happens in Phase 10
- [ ] 5-14 Tests: `GET /api/trees` (only own non-deleted trees, category filter, `CATEGORY_NOT_FOUND`, pagination, `401`) and `POST /api/trees` (`201` with a root node, `400` cases, `CATEGORY_NOT_FOUND` creates nothing)
- [ ] 5-15 Tests: `GET /api/trees/:id` (owner sees private; guest and other users get `404` for private, removed, Trash and deactivated-owner trees; public works for guests; `isOwner`; skeleton fields only)
- [ ] 5-16 Tests: `PATCH /api/trees/:id` (`200`, `TREE_REMOVED`, other user `404`, category replacement) and `DELETE /api/trees/:id` (`200`, second delete `404`)
- [ ] 5-17 Tests: `GET /api/trash` (`purgeAt`, order, only own) and restore (`200`, `TREE_NOT_IN_TRASH`, other user `404`); `purgeTrash` deletes only trees older than 10 days

---

## Phase 6: Categories API（カテゴリAPI） 【並列可】
- Depends on: Phase 3
- Main files: `shared/src/schemas/categories.ts`, `shared/src/types/category.ts`, `backend/src/services/category.service.ts`, `backend/src/controllers/categories.controller.ts`, `backend/src/routes/categories.routes.ts`, `backend/tests/categories.api.test.ts` (no overlap with other Phases)
- Endpoints: `GET /api/categories`, `POST /api/categories`, `PATCH /api/categories/:id`, `DELETE /api/categories/:id`

- [ ] 6-1 Fill `shared/src/schemas/categories.ts` (`name` trimmed 1–50, `color` `#RRGGBB`, strict objects so `nameKey` / `userId` are rejected; update needs at least one field) and `shared/src/types/category.ts` (`CategoryResponse` with `treeCount` as the spec lists)
- [ ] 6-2 `CategoryService.list(userId)`: own categories sorted by name (A–Z) with `treeCount` = the user's trees with this category that aren't in the Trash (one query, no N+1)
- [ ] 6-3 `CategoryService.create(userId, body)`: transaction: count ≥ 100 → `409 CATEGORY_LIMIT_REACHED`; set `nameKey = name.trim().toLowerCase()`; `P2002` → `409 CATEGORY_NAME_TAKEN`
- [ ] 6-4 `CategoryService.update(userId, id, body)`: foreign/missing → `404 CATEGORY_NOT_FOUND`; update `nameKey` with `name`; case-only rename of the same category allowed; `P2002` → `CATEGORY_NAME_TAKEN`
- [ ] 6-5 `CategoryService.remove(userId, id)`: foreign/missing → `404`; delete (tags removed by CASCADE, including trees in the Trash)
- [ ] 6-6 `backend/src/controllers/categories.controller.ts` + `categories.routes.ts` (all `requireAuth`; `POST` returns `201`)
- [ ] 6-7 Tests: list (only own, tree counts), create (`201`, `CATEGORY_NAME_TAKEN` for "Work" vs "work", `CATEGORY_LIMIT_REACHED` at 100, `400` for `nameKey` in the body)
- [ ] 6-8 Tests: update (`200`, case-only rename allowed, name clash `409`, other user `404`) and delete (`200`, tags gone from trees, trees kept, other user `404`)

---

## Phase 7: Uploads & Link Preview（画像アップロード・リンクプレビュー） 【並列可】
- Depends on: Phase 3
- Main files: `shared/src/schemas/{uploads,linkPreview}.ts`, `shared/src/types/upload.ts`, `backend/src/lib/ssrfGuard.ts`, `backend/src/middleware/upload.ts`, `backend/src/services/{upload,linkPreview}.service.ts`, `backend/src/controllers/{uploads,linkPreview}.controller.ts`, `backend/src/routes/{uploads,linkPreview}.routes.ts`, `backend/src/jobs/cleanupUploads.ts`, `backend/tests/{uploads,linkPreview}.api.test.ts`, `backend/tests/lib/ssrfGuard.test.ts`, `backend/tests/jobs/cleanupUploads.test.ts` (no overlap with other Phases)
- Endpoints: `POST /api/uploads`, `POST /api/link-preview`

- [ ] 7-1 Implement `backend/src/middleware/upload.ts`: Multer memory storage, `limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 }`, single field `file`; no file / several files / not multipart → `400 VALIDATION_ERROR`
- [ ] 7-2 `UploadService.save(userId, file)`: detect the type with `file-type` from the bytes; not PNG/JPEG/WebP/GIF → `415 UNSUPPORTED_FILE_TYPE`; `storageKey = randomUUID() + ext`; write to `UPLOAD_DIR`; create the `uploads` row; delete the file if the DB insert fails
- [ ] 7-3 Fill `shared/src/types/upload.ts` (`UploadResponse`: `id`, `url` (`/uploads/<storageKey>`), `originalName`, `mimeType`, `sizeBytes`, `createdAt`) and wire `backend/src/controllers/uploads.controller.ts` + `uploads.routes.ts` (`requireAuth`, `uploadLimiter`, `upload`, `201`)
- [ ] 7-4 Implement `backend/src/lib/ssrfGuard.ts` part 1: `assertPublicUrl(url)`: `http`/`https` only, ports 80/443 only, resolve DNS and refuse private, loopback, link-local and unique-local IPv4/IPv6 addresses → `400 URL_NOT_ALLOWED`
- [ ] 7-5 `ssrfGuard.ts` part 2: `safeFetch(url)`: manual redirects (max 3, each target re-checked), 5-second total timeout, read at most 1 MB, only `text/html`; failures → `422 PREVIEW_UNAVAILABLE`
- [ ] 7-6 `LinkPreviewService.parse(html, baseUrl)`: `og:title` / `og:description` / `og:image`, falling back to `<title>` and `<meta name="description">`; make a relative image URL absolute; trim to the column lengths (300 / 1000)
- [ ] 7-7 `LinkPreviewService.getPreview(url)`: in-memory cache for 10 minutes per URL; export it for the node service (Phase 8) together with a `tryGetPreview(url)` that returns empty fields instead of throwing
- [ ] 7-8 Fill `shared/src/schemas/linkPreview.ts` (`url` http/https, ≤ 2,048) and wire `backend/src/controllers/linkPreview.controller.ts` + `linkPreview.routes.ts` (`POST /link-preview`, `requireAuth`, `linkPreviewLimiter`)
- [ ] 7-9 Implement `backend/src/jobs/cleanupUploads.ts`: `cleanupUploads()` deletes uploads no node points to (row and file, no grace period), and `scheduleCleanupUploads()` (daily at a low-traffic time). Registration in Phase 10
- [ ] 7-10 Tests: uploads (`201` for each allowed type, `415` for SVG and for a `.png` that is really text, `413` over 5 MB, `400` with no file, `401`, `429` after 60, file served at `/uploads/...` with `nosniff`)
- [ ] 7-11 Tests: `ssrfGuard` unit tests (`127.0.0.1`, `10.x`, `192.168.x`, `169.254.169.254`, `::1`, port 8080, a redirect to a private address) and link preview API tests with the fetch mocked (`200` with OG fields, `<title>` fallback, `URL_NOT_ALLOWED`, `PREVIEW_UNAVAILABLE`, `401`, cache hit)
- [ ] 7-12 Test: `cleanupUploads` removes only unused uploads and their files

---

## Phase 8: Nodes API（ノードAPI） 【並列可】
- Depends on: Phase 3, Phase 7 (`LinkPreviewService.tryGetPreview`)
- Main files: `shared/src/schemas/nodes.ts`, `shared/src/types/node.ts`, `backend/src/services/node.service.ts`, `backend/src/controllers/nodes.controller.ts`, `backend/src/routes/nodes.routes.ts`, `backend/tests/nodes.api.test.ts`, `backend/tests/nodes-positions.api.test.ts` (no overlap with other Phases)
- Endpoints: `GET /api/trees/:id/nodes`, `POST /api/trees/:id/nodes`, `PATCH /api/nodes/:id`, `PATCH /api/trees/:id/nodes/positions`, `DELETE /api/nodes/:id`

- [ ] 8-1 Fill `shared/src/schemas/nodes.ts` part 1: `videoUrlSchema` (YouTube or Vimeo only), `createNodeSchema` as a discriminated union on `type` (`TEXT` / `LINK` / `VIDEO` / `IMAGE`, required and forbidden fields per type, preview fields rejected)
- [ ] 8-2 `nodes.ts` part 2: `updateNodeSchema` (at least one field; `positionX`/`positionY`/`sortOrder` only with `parentId`), `positionsSchema` (1–2,000 unique IDs), `nodeDetailsQuerySchema` (`ids` comma-separated, 1–100)
- [ ] 8-3 Fill `shared/src/types/node.ts` (`NodeSkeleton`, `NodeDetails`, `NodeResponse` with skeleton + detail fields + `imageUrl`) and add `toNodeResponse()` in `node.service.ts`
- [ ] 8-4 `NodeService.getDetails(viewer, treeId, ids)`: tree visible as in `GET /api/trees/:id`, else `404 TREE_NOT_FOUND`; return details only for IDs in that tree
- [ ] 8-5 Add the helpers `lockOwnedActiveTree(tx, userId, treeId)` (`SELECT ... FOR UPDATE`, not in the Trash → else `TREE_NOT_FOUND`) and `findOwnedNode(tx, userId, nodeId)` (tree owned and not in the Trash → else `NODE_NOT_FOUND`) (`standards/database.md` §4.5)
- [ ] 8-6 `NodeService.create` part 1: transaction: lock the tree, count ≥ 2,000 → `409 NODE_LIMIT_REACHED`, parent in the same tree (else `404 PARENT_NOT_FOUND`), `IMAGE` upload owned by the user (else `404 UPLOAD_NOT_FOUND`), default `sortOrder` after the last sibling, insert, bump the tree's `updatedAt`
- [ ] 8-7 `NodeService.create` part 2: for `LINK`, fetch the preview **before** the transaction with `tryGetPreview` (failure → empty fields, node still created); return `201`
- [ ] 8-8 `NodeService.update` part 1: content and type changes: keep `title`/`body`; clear fields that don't apply to the new type (`url` + preview fields, `imageUploadId`); require the new type's fields; refetch the preview when a `LINK` URL changes
- [ ] 8-9 `NodeService.update` part 2: re-parenting: the root can't move; walk up from the new parent and refuse if it reaches the node → `409 INVALID_MOVE`; new parent in another tree → `PARENT_NOT_FOUND`; save the position fields sent with `parentId`; bump `updatedAt` in the same transaction
- [ ] 8-10 `NodeService.savePositions(userId, treeId, nodes)`: one transaction; any ID not in the tree → `404 NODE_NOT_FOUND` and nothing saved; bump `updatedAt`; return `id`, positions, `sortOrder`, `updatedAt`
- [ ] 8-11 `NodeService.remove(userId, nodeId)`: root → `409 CANNOT_DELETE_ROOT`; collect the subtree IDs, delete (CASCADE) and bump `updatedAt` in one transaction; return the deleted IDs
- [ ] 8-12 `backend/src/controllers/nodes.controller.ts` + `nodes.routes.ts`: `GET /trees/:id/nodes` (`optionalAuth`), `POST /trees/:id/nodes` (`201`), `PATCH /trees/:id/nodes/positions`, `PATCH /nodes/:id`, `DELETE /nodes/:id` (`requireAuth`)
- [ ] 8-13 Tests: create (each type `201`, `400` wrong fields per type and preview fields sent, `PARENT_NOT_FOUND`, `UPLOAD_NOT_FOUND` for another user's upload, Trash tree `404`, removed tree still editable by the owner, `NODE_LIMIT_REACHED` at 2,000, LINK created with empty preview when the fetch fails)
- [ ] 8-14 Test: two simultaneous creates on a tree with 1,999 nodes leave exactly 2,000 nodes (the row lock works)
- [ ] 8-15 Tests: update (type change keeps title/body and clears the old fields, `INVALID_MOVE` for root / self / descendant, re-parent with position, other user `404`)
- [ ] 8-16 Tests: positions (`200`, a foreign ID saves nothing, duplicate IDs `400`) and delete (subtree removed, `CANNOT_DELETE_ROOT`, Trash tree `404`), details (`200` for public trees as a guest, `404` for private, more than 100 IDs `400`)

---

## Phase 9: Explore & Admin API（Explore・管理者API） 【並列可】
- Depends on: Phase 3
- Main files: `shared/src/schemas/{explore,admin}.ts`, `backend/src/services/{explore,admin}.service.ts`, `backend/src/controllers/{explore,admin}.controller.ts`, `backend/src/routes/{explore,admin}.routes.ts`, `backend/tests/{explore,admin}.api.test.ts` (no overlap with other Phases)
- Endpoints: `GET /api/explore`, `GET /api/explore/categories`, `POST /api/admin/trees/:id/remove`

- [ ] 9-1 Fill `shared/src/schemas/explore.ts` (`exploreQuerySchema`: `q` 1–100 trimmed, `category` 1–50 lowercased, pagination; `exploreCategoriesQuerySchema`: `q` 1–50, `limit` 1–50) and `shared/src/schemas/admin.ts` (`reason` trimmed 1–500)
- [ ] 9-2 `ExploreService.list(query)`: `publicTreeWhere` + `q` (title or description contains, case-insensitive) + `category` (any tag with that `name_key`), newest `updatedAt` first, `toTreeSummary` with owner `username`/`displayName`, pagination
- [ ] 9-3 `ExploreService.categories(query)`: distinct `name_key`s on public trees with counts and a display name, optional prefix `q`, most used first, `limit` (one grouped query, no N+1)
- [ ] 9-4 `AdminService.removeTree(adminId, treeId, reason)`: not publicly visible → `404 TREE_NOT_FOUND`; already removed → `409 TREE_ALREADY_REMOVED`; set `removedAt`, `removedById`, `removalReason` and `visibility = PRIVATE`
- [ ] 9-5 `backend/src/controllers/explore.controller.ts` + `explore.routes.ts` (public) and `admin.controller.ts` + `admin.routes.ts` (`requireAuth`, `requireAdmin`)
- [ ] 9-6 Tests: Explore (only public trees; private, removed, Trash and deactivated-owner trees excluded; `q` search; category match across users ignoring case; pagination; `400` for empty `q`) and categories (counts only public trees, prefix filter)
- [ ] 9-7 Tests: admin remove (`200` and the tree disappears from Explore, owner can still open it privately, `TREE_ALREADY_REMOVED`, private tree `404`, `USER` → `403 FORBIDDEN`, guest `401`, `400` empty reason)

---

## Phase 10: Integration & Final Checks（統合・最終確認） 【直列】
- Depends on: Phases 4–9
- Main files: `backend/src/server.ts`, `backend/prisma/seed.ts`, `backend/scripts/make-admin.ts`, `backend-tasks.md`

- [ ] 10-1 Register `schedulePurgeTrash()` and `scheduleCleanupUploads()` in `backend/src/server.ts` (not during tests). Check: the server log shows both jobs scheduled
- [ ] 10-2 Write `backend/prisma/seed.ts`: 2 users (one admin), categories, a public tree with ~20 nodes of every type, a private tree, a tree in the Trash. Check: `npm run seed -w backend` runs twice without errors (reset first)
- [ ] 10-3 Write `backend/scripts/make-admin.ts`: `npm run make-admin -w backend -- <email>` sets `role = ADMIN` for an active user, with a clear message if not found
- [ ] 10-4 Run `npm run lint`, `npm run typecheck -w backend` and fix every error
- [ ] 10-5 Run the full backend test suite `npm test -w backend` and fix failures
- [ ] 10-6 Coverage check: for each of the 30 endpoints in `manifests/common.md` §6, confirm the route exists and every error code in its spec has a test. List any gaps here as new tasks
- [ ] 10-7 Smoke test against the dev DB: seed, start the server, log in with `curl`, call `GET /api/auth/me`, `GET /api/trees`, `GET /api/trees/:id`, `POST /api/trees/:id/nodes`, `GET /api/explore`; check statuses and shapes against the manifest
- [ ] 10-8 Security pass with `standards/review-checklist.md` (auth on every route, ownership in queries, no `passwordHash` in any response, rate limiters attached, `nosniff` on uploads, CORS with credentials)

---

## 並列実装サマリー（Parallel Implementation Summary）

| Phase | Type | Depends on | Can run in parallel with | Reason (dependencies, shared files) |
|---|---|---|---|---|
| 1 Environment setup | 直列 | — | — | Creates the repo structure, packages and DB every Phase needs |
| 2 Common foundation | 直列 | 1 | — | Creates every shared file (constants, error codes, schema/type stubs, barrel, route registry in `app.ts`, tree helpers) |
| 3 Auth & test helpers | 直列 | 2 | — | Auth middleware, all rate limiters and test factories are used by every later Phase |
| 4 Users | 並列可 | 3 | 5, 6, 7, 8, 9 | Own schema, service, controller, route and test files only |
| 5 Trees & Trash | 並列可 | 3 | 4, 6, 7, 8, 9 | Own files; `purgeTrash.ts` registered later in Phase 10 |
| 6 Categories | 並列可 | 3 | 4, 5, 7, 8, 9 | Own files only |
| 7 Uploads & link preview | 並列可 | 3 | 4, 5, 6, 9 | Own files; `cleanupUploads.ts` registered in Phase 10 |
| 8 Nodes | 並列可 | 3, 7 | 4, 5, 6, 9 | Uses `LinkPreviewService` from Phase 7 (read only); own files otherwise |
| 9 Explore & Admin | 並列可 | 3 | 4, 5, 6, 7, 8 | Own files; reuses `services/common/*` read only |
| 10 Integration | 直列 | 4–9 | — | Edits `server.ts`; seed data needs every model and feature |

Parallel Phases never edit the same file: shared files (`app.ts`, `shared/src/index.ts`, `shared/src/errors.ts`, `shared/src/constants.ts`, `rateLimits.ts`, `services/common/*`, `tests/helpers/*`, `schema.prisma`) are finished in Phases 1–3 and only read afterwards. If a feature Phase finds it needs a change to one of them, stop and make that change as a separate serial task first.

### 推奨実行順序（Recommended Order）
1. Phase 1 → Phase 2 → Phase 3 (serial)
2. Phase 4 / Phase 5 / Phase 6 / Phase 7 / Phase 9 (parallel)
3. Phase 8 (after Phase 7; can overlap with any of 4, 5, 6, 9 still running)
4. Phase 10 (integration, serial)

---

**Coverage: all 30 endpoints are covered** (Auth 4 · Users 5 · Trees 5 · Trash 2 · Categories 4 · Nodes 5 · Uploads 1 · Link preview 1 · Explore 2 · Admin 1), plus the 2 daily jobs, seed data and the make-admin script. No endpoint was left out.

Totals: 10 Phases, 133 tasks.
