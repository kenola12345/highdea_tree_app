# Common Definitions

Shared by every domain file. Start from [index.md](./index.md).

## 1. Project Overview（プロジェクト概要）

**Purpose.** Highdea Tree is a web app for visualizing ideas so people can organize their thoughts. A user starts with **one central idea** ("highdea") and **branches it out** into child ideas, forming a visual tree (mind map) on a canvas.

**Background.** Linear notes make it hard to see how ideas connect. Thoughts also come in many forms (a sentence, a website, a video, a picture) that usually end up scattered across different apps. Highdea Tree puts them on one canvas, in a structure you can see.

**Target users.** Anyone who wants to think visually: students, creators, developers, planners. Visitors who aren't logged in can browse other people's public trees for inspiration.

**Scope of v1.**
- Accounts: sign up, log in, profile, account settings, account deletion (§3.1, §3.2).
- Idea trees: private or public trees, each with one center idea, plus a Trash with a 10-day restore window (§3.3, §3.4).
- Idea nodes on a canvas: text, link, video and image nodes; drag and re-parent with mouse or touch; lazy loading for trees of up to 2,000 nodes (§3.5, §3.6).
- Categories to organize trees (§3.7).
- Explore: a public feed with search and category filter, and public profiles (§3.8).
- Moderation: admins can remove inappropriate public trees (§3.9).
- Background jobs for the Trash and unused images (§3.10).

Out of scope for v1: see §10.

## 2. User Roles (RBAC)（ユーザーロール定義）

| Role | Description |
|---|---|
| Guest | Not logged in. Can browse public trees, Explore and public profiles. Can sign up or log in. |
| `USER` | Registered account. Creates and manages their own trees, nodes and categories, and manages their own account. |
| `ADMIN` | Everything a `USER` can do with their own content, plus removing inappropriate **public** trees. Has **no** access to other users' private trees, Trash or settings. Admins are created with a script, never through the API (§9). |



## Authorization Rules

"Owner" below means the logged-in user (`USER` or `ADMIN`) who owns the resource. Anything a caller isn't allowed to see returns `404`, not `403`, so private content isn't revealed. The role is read from the DB on every request (§6 policies).

"Public tree" always means `visibility = PUBLIC`, not removed, not in the Trash, and the owner's account active.

Endpoint-specific conditions are in each domain file's Authorization section: [users.md](./users.md), [trees.md](./trees.md), [nodes.md](./nodes.md), [explore.md](./explore.md).

### 2.2 Role × Page Summary

| Pages | Guest | `USER` | `ADMIN` |
|---|---|---|---|
| P-01 Landing, P-06 Tree Viewer (public trees), P-07 Explore, P-08 User Profile, P-11 Not Found | ✅ | ✅ | ✅ |
| P-02 Sign up, P-03 Log in | ✅ | redirected to `/me` | redirected to `/me` |
| P-04 My Trees, P-09 Trash, P-10 Settings | redirected to `/login` | ✅ | ✅ |
| P-05 Tree Editor, P-06 Tree Viewer (own private or removed trees) | ❌ | ✅ Owner | ✅ Owner |
| M-09 Remove Tree (in P-06) | ❌ | ❌ | ✅ public trees |

## 3. Functional Requirements（機能要件）


Each feature lists its business rules and where it lives: pages (P-xx) and modals (M-xx) from §4, endpoints from §6, and tables from §5.

### 3.10 Background Jobs

- **Trash purge (daily):** permanently deletes trees that have been in the Trash for more than 10 days, with their nodes and category tags.
- **Uploads cleanup (daily, at a low-traffic time):** deletes uploaded images that no node uses, with no grace period. If it removes an image between upload and node save, the editor asks the user to upload it again.
- **Tables:** `trees`, `nodes`, `tree_categories`, `uploads`.

## 4. Screens & Navigation（画面遷移・構成）


A React SPA (React Router). Every page shares a header with the logo, Explore, and either "Log in / Sign up" (guests) or My Trees, Trash, Settings and Log out (logged-in users). The main screen is the **Tree Editor**.

Access values below: **Anyone** (guests and logged-in users), **Not logged in** (guests only; logged-in users are redirected to `/me`), `USER` / `ADMIN` (logged-in roles from §2), and **Owner** (the logged-in user who owns the tree).

Pages and modals of each domain are listed in its domain file. Shared pages:

| ID | Screen | URL | Summary | Access |
|---|---|---|---|---|
| P-01 | Landing | `/` | What Highdea Tree is, sample tree image, buttons to Explore and Sign up. Logged-in users see a "Go to My Trees" button instead | Anyone |
| P-11 | Not Found | any unknown URL, and any `404` from the API for a page's main resource | "This page doesn't exist or isn't public." Links to Explore and Home. Also shown for private trees and deactivated users, so their existence isn't revealed | Anyone |

Routing rules:
- A guest opening a `USER`/`ADMIN` page is sent to `/login?next=<url>`.
- A logged-in user opening `/signup` or `/login` is sent to `/me` (the API rejects both with `403 ALREADY_AUTHENTICATED`).
- `/trees/:id/edit` for someone who isn't the owner redirects to `/trees/:id` (decided from `isOwner` in `GET /api/trees/:id`).
- There's no separate admin page; admins act from the Tree Viewer (M-09).

#### SPA UI/UX Points（SPAとしてのUI/UX設計ポイント）

- **Field-level errors:** every form (P-02, P-03, P-10, M-01, M-02, M-04, M-05, M-07, M-09, M-11) uses the same Zod schemas as the backend for instant checks, and maps the API's `details` (`{ field, message }`) to the matching field when the server rejects a request.
- **Session handling:** on app load, `GET /api/auth/me` decides guest or logged in (`401` = guest, not an error). Any `401` during use (e.g. the 7-day token expired) clears the cached user and sends the user to `/login?next=<current url>`, keeping their place. `role` from `/me` controls admin-only buttons; the API still checks the role on every request.
- **Cache invalidation after changes:** creating, editing, trashing or restoring a tree invalidates `['trees']` (My Trees), `['trash']`, `['categories']` (tree counts) and, for public trees, `['explore']` and the owner's profile. Category edits also invalidate every cached tree that shows that category.
- **Business rules visible in the UI:** the center idea has no Delete action; "+ Add" is disabled at 2,000 ideas; a removed tree's visibility switch is disabled with the admin's reason shown; the Trash shows "X days left" from `purgeAt`; delete confirmations state how many ideas (M-06) or trees (M-08) are affected.
- **Not-found instead of forbidden:** any `404` for a page's main resource (tree, user profile) shows P-11 with the same message, whether the item doesn't exist, is private, removed or deleted, so the UI doesn't reveal private content either.

## 5. Data Modeling（データモデリング）


Common policies:
- **DB:** PostgreSQL. **ORM:** Prisma 7.10.1. The connection URL lives in `backend/prisma.config.ts`, not in `schema.prisma`.
- **Primary keys:** `cuid` strings (`String @id @default(cuid())`, stored as `TEXT`).
- **State columns:** Prisma `enum` (PostgreSQL enum types): `UserRole`, `TreeVisibility`, `NodeType`.
- **Naming:** Prisma models and fields are `camelCase` (the JSON uses the same). DB tables and columns are plural `snake_case`, mapped with `@map` / `@@map`.
- **Timestamps:** `TIMESTAMPTZ(3)`, stored in UTC. The frontend converts them to the viewer's local time.
- **Text:** `VARCHAR(n)` where a length limit is a business rule, `TEXT` for free text and URLs.

### 5.1 ER Diagram（ER図）

```mermaid
erDiagram
  USERS ||--o{ TREES : "owns"
  USERS ||--o{ TREES : "removes (admin)"
  USERS ||--o{ CATEGORIES : "owns"
  USERS ||--o{ UPLOADS : "uploads"
  TREES ||--o{ NODES : "contains"
  NODES ||--o{ NODES : "parent of"
  UPLOADS ||--o{ NODES : "shown in (IMAGE)"
  TREES ||--o{ TREE_CATEGORIES : "tagged"
  CATEGORIES ||--o{ TREE_CATEGORIES : "tags"

  USERS {
    text id PK
    varchar email UK
    varchar username UK
    UserRole role
    timestamptz deleted_at
  }
  TREES {
    text id PK
    text owner_id FK
    TreeVisibility visibility
    text removed_by_id FK
    timestamptz removed_at
    timestamptz deleted_at
  }
  NODES {
    text id PK
    text tree_id FK
    text parent_id FK
    NodeType type
    text image_upload_id FK
  }
  CATEGORIES {
    text id PK
    text user_id FK
    varchar name
    varchar name_key
  }
  TREE_CATEGORIES {
    text tree_id PK,FK
    text category_id PK,FK
  }
  UPLOADS {
    text id PK
    text owner_id FK
    varchar storage_key UK
  }
```

Table definitions are in the domain files: `users` → [users.md](./users.md); `trees`, `categories`, `tree_categories` → [trees.md](./trees.md); `nodes`, `uploads` → [nodes.md](./nodes.md).

### 5.3 Deletion Policy（削除・無効化ポリシー）

| Resource | Policy | Implementation | Related data | Notes |
|---|---|---|---|---|
| User | Deactivate (soft delete) | `users.deleted_at` | Trees, categories and uploads are kept but hidden from everyone | The user deletes their account with `POST /api/users/me/deactivate` (password required). Email and username stay taken. No reactivation in v1 |
| Tree (owner deletes) | Soft delete → Trash, then hard delete after 10 days | `trees.deleted_at`, then a daily purge job | In the Trash: nodes and tags kept, so restore brings everything back. On purge: nodes and tags deleted (CASCADE); uploaded images become unused and are removed by the uploads cleanup job | Restore with `POST /api/trees/:id/restore` |
| Tree (admin removes) | Hide from public | `trees.removed_at`, `removed_by_id`, `removal_reason`; `visibility` set to `PRIVATE` | Owner keeps private access | Kept separate from `deleted_at`, so moderation actions stay auditable |
| Node | Hard delete | `DELETE` | Whole subtree deleted (DB CASCADE). The image file stays until cleanup | Nodes have no history, so a soft delete isn't needed |
| Category | Hard delete | `DELETE` | Its `tree_categories` rows are deleted (CASCADE). Trees stay | |
| Tree–category tag | Hard delete | `DELETE` | — | Changing a tree's categories replaces all its tag rows |
| Upload | Hard delete (by cleanup job) | `DELETE` + remove the file | Blocked while any node uses it (RESTRICT) | |

FK `ON DELETE` rules:
- Links to `users`: `RESTRICT`. Users are only soft-deleted, so a physical delete would mean a mistake.
- `nodes.tree_id`, `nodes.parent_id`, `tree_categories.*`: `CASCADE`. These are owned children.
- `nodes.image_upload_id`: `RESTRICT`.

### 5.4 Prisma Schema（schema.prisma）

```prisma
generator client {
  provider = "prisma-client-js"
}

// Prisma 7: the connection URL (DATABASE_URL) is set in backend/prisma.config.ts, not here.
datasource db {
  provider = "postgresql"
}

enum UserRole {
  USER
  ADMIN
}

enum TreeVisibility {
  PRIVATE
  PUBLIC
}

enum NodeType {
  TEXT
  LINK
  VIDEO
  IMAGE
}

model User {
  id           String    @id @default(cuid())
  email        String    @unique @db.VarChar(255)
  username     String    @unique @db.VarChar(30)
  displayName  String    @map("display_name") @db.VarChar(50)
  passwordHash String    @map("password_hash") @db.VarChar(255)
  avatarUrl    String?   @map("avatar_url")
  role         UserRole  @default(USER)
  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt    DateTime  @updatedAt @map("updated_at") @db.Timestamptz(3)
  deletedAt    DateTime? @map("deleted_at") @db.Timestamptz(3)

  trees        Tree[]     @relation("TreeOwner")
  removedTrees Tree[]     @relation("TreeRemovedBy")
  categories   Category[]
  uploads      Upload[]

  @@map("users")
}

model Tree {
  id            String         @id @default(cuid())
  ownerId       String         @map("owner_id")
  title         String         @db.VarChar(100)
  description   String?        @db.VarChar(500)
  visibility    TreeVisibility @default(PRIVATE)
  removedAt     DateTime?      @map("removed_at") @db.Timestamptz(3)
  removedById   String?        @map("removed_by_id")
  removalReason String?        @map("removal_reason") @db.VarChar(500)
  createdAt     DateTime       @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt     DateTime       @updatedAt @map("updated_at") @db.Timestamptz(3)
  deletedAt     DateTime?      @map("deleted_at") @db.Timestamptz(3)

  owner      User           @relation("TreeOwner", fields: [ownerId], references: [id], onDelete: Restrict)
  removedBy  User?          @relation("TreeRemovedBy", fields: [removedById], references: [id], onDelete: Restrict)
  nodes      Node[]
  categories TreeCategory[]

  @@index([ownerId, deletedAt, updatedAt(sort: Desc)])
  @@index([deletedAt])
  @@index([visibility, removedAt, deletedAt, updatedAt(sort: Desc)])
  @@map("trees")
}

model Node {
  id                 String    @id @default(cuid())
  treeId             String    @map("tree_id")
  parentId           String?   @map("parent_id")
  type               NodeType  @default(TEXT)
  title              String    @db.VarChar(200)
  body               String?
  url                String?
  previewTitle       String?   @map("preview_title") @db.VarChar(300)
  previewDescription String?   @map("preview_description") @db.VarChar(1000)
  previewImageUrl    String?   @map("preview_image_url")
  previewFetchedAt   DateTime? @map("preview_fetched_at") @db.Timestamptz(3)
  imageUploadId      String?   @map("image_upload_id")
  positionX          Float     @default(0) @map("position_x")
  positionY          Float     @default(0) @map("position_y")
  sortOrder          Int       @default(0) @map("sort_order")
  createdAt          DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt          DateTime  @updatedAt @map("updated_at") @db.Timestamptz(3)

  tree        Tree    @relation(fields: [treeId], references: [id], onDelete: Cascade)
  parent      Node?   @relation("NodeChildren", fields: [parentId], references: [id], onDelete: Cascade)
  children    Node[]  @relation("NodeChildren")
  imageUpload Upload? @relation(fields: [imageUploadId], references: [id], onDelete: Restrict)

  @@index([treeId])
  @@index([parentId, sortOrder])
  @@index([imageUploadId])
  @@map("nodes")
}

model Category {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  name      String   @db.VarChar(50)
  nameKey   String   @map("name_key") @db.VarChar(50)
  color     String   @default("#6B7280") @db.VarChar(7)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  user  User           @relation(fields: [userId], references: [id], onDelete: Restrict)
  trees TreeCategory[]

  @@unique([userId, nameKey])
  @@index([nameKey])
  @@map("categories")
}

model TreeCategory {
  treeId     String   @map("tree_id")
  categoryId String   @map("category_id")
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(3)

  tree     Tree     @relation(fields: [treeId], references: [id], onDelete: Cascade)
  category Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@id([treeId, categoryId])
  @@index([categoryId])
  @@map("tree_categories")
}

model Upload {
  id           String   @id @default(cuid())
  ownerId      String   @map("owner_id")
  storageKey   String   @unique @map("storage_key") @db.VarChar(255)
  originalName String   @map("original_name") @db.VarChar(255)
  mimeType     String   @map("mime_type") @db.VarChar(100)
  sizeBytes    Int      @map("size_bytes")
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz(3)

  owner User   @relation(fields: [ownerId], references: [id], onDelete: Restrict)
  nodes Node[]

  @@index([ownerId])
  @@map("uploads")
}
```

## 6. API Design（API設計）


Policies:
- REST, JSON, base path `/api`.
- Auth: JWT stored in an **httpOnly cookie** (`Secure`, `SameSite`), set on login and cleared on logout.
- Common response shape: `{ "data": ... }` on success, `{ "error": { "code", "message", "details"? } }` on failure. For `VALIDATION_ERROR`, `details` is an array of `{ "field": "username", "message": "..." }` generated from the Zod error, so forms can show each error next to its field. Other error codes leave `details` out.
- Auth middleware: the JWT holds only `sub` (the user ID) and `exp`. On every request, the middleware loads the user from the DB; a missing or deactivated user gets `401 UNAUTHENTICATED`. `role` always comes from the DB, never from the token, so a role change or deactivation takes effect immediately even though tokens can't be revoked.
- Request validation with Zod; shared types between frontend and backend.

| Resource | Main endpoints |
|---|---|
| Auth | `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` |
| Users | `GET /api/users/:username`, `PATCH /api/users/me`, `PATCH /api/users/me/account` (email, username), `PATCH /api/users/me/password`, `POST /api/users/me/deactivate` (delete account) |
| Trees | `GET /api/trees` (mine), `POST /api/trees`, `GET /api/trees/:id`, `PATCH /api/trees/:id`, `DELETE /api/trees/:id` (move to Trash) |
| Trash | `GET /api/trash` (my deleted trees), `POST /api/trees/:id/restore` |
| Nodes | `GET /api/trees/:id/nodes?ids=` (lazy-load node details), `POST /api/trees/:id/nodes`, `PATCH /api/nodes/:id`, `PATCH /api/trees/:id/nodes/positions` (all drag moves), `DELETE /api/nodes/:id` |
| Categories | `GET /api/categories`, `POST /api/categories`, `PATCH /api/categories/:id`, `DELETE /api/categories/:id` |
| Explore | `GET /api/explore` (public trees, paginated, `?category=&q=`), `GET /api/explore/categories` (category names for the filter) |
| Uploads | `POST /api/uploads` (image upload, multipart) |
| Link preview | `POST /api/link-preview` (fetch title/thumbnail for a URL) |
| Admin | `POST /api/admin/trees/:id/remove` (remove a public tree) |

Endpoint specs are in the domain files: Auth, Users → [users.md](./users.md); Trees, Trash, Categories → [trees.md](./trees.md); Nodes, Uploads, Link preview → [nodes.md](./nodes.md); Explore, Admin → [explore.md](./explore.md).

## Pagination

Every paged list (`GET /api/users/:username`, `GET /api/trees`, `GET /api/trash`, `GET /api/explore`) takes `page` (from 1, default `1`) and `limit` (1–50, default `20`) and returns `data.pagination`: `page`, `limit`, `total`. The frontend computes the page count as `ceil(total / limit)`.

## Error Codes

Index of every error `code` used in the endpoint specs (generated from them; each spec's description is authoritative). Format: `{ "error": { "code", "message", "details"? } }`.

| Code | HTTP | Used by |
|---|---|---|
| `URL_NOT_ALLOWED` | `400` | `POST /api/link-preview` |
| `USERNAME_RESERVED` | `400` | `POST /api/auth/signup`, `PATCH /api/users/me/account` |
| `VALIDATION_ERROR` | `400` | most endpoints |
| `INVALID_CREDENTIALS` | `401` | `POST /api/auth/login` |
| `UNAUTHENTICATED` | `401` | 22 endpoints (most authenticated endpoints) |
| `ALREADY_AUTHENTICATED` | `403` | `POST /api/auth/signup`, `POST /api/auth/login` |
| `FORBIDDEN` | `403` | `POST /api/admin/trees/:id/remove` |
| `WRONG_PASSWORD` | `403` | `PATCH /api/users/me/account`, `PATCH /api/users/me/password`, `POST /api/users/me/deactivate` |
| `CATEGORY_NOT_FOUND` | `404` | `GET /api/trees`, `POST /api/trees`, `PATCH /api/trees/:id`, `PATCH /api/categories/:id`, `DELETE /api/categories/:id` |
| `NODE_NOT_FOUND` | `404` | `PATCH /api/nodes/:id`, `PATCH /api/trees/:id/nodes/positions`, `DELETE /api/nodes/:id` |
| `PARENT_NOT_FOUND` | `404` | `POST /api/trees/:id/nodes`, `PATCH /api/nodes/:id` |
| `TREE_NOT_FOUND` | `404` | 8 endpoints |
| `UPLOAD_NOT_FOUND` | `404` | `POST /api/trees/:id/nodes`, `PATCH /api/nodes/:id` |
| `USER_NOT_FOUND` | `404` | `GET /api/users/:username` |
| `CANNOT_DELETE_ROOT` | `409` | `DELETE /api/nodes/:id` |
| `CATEGORY_LIMIT_REACHED` | `409` | `POST /api/categories` |
| `CATEGORY_NAME_TAKEN` | `409` | `POST /api/categories`, `PATCH /api/categories/:id` |
| `EMAIL_TAKEN` | `409` | `POST /api/auth/signup`, `PATCH /api/users/me/account` |
| `INVALID_MOVE` | `409` | `PATCH /api/nodes/:id` |
| `NODE_LIMIT_REACHED` | `409` | `POST /api/trees/:id/nodes` |
| `TREE_ALREADY_REMOVED` | `409` | `POST /api/admin/trees/:id/remove` |
| `TREE_NOT_IN_TRASH` | `409` | `POST /api/trees/:id/restore` |
| `TREE_REMOVED` | `409` | `PATCH /api/trees/:id` |
| `USERNAME_TAKEN` | `409` | `POST /api/auth/signup`, `PATCH /api/users/me/account` |
| `FILE_TOO_LARGE` | `413` | `POST /api/uploads` |
| `UNSUPPORTED_FILE_TYPE` | `415` | `POST /api/uploads` |
| `PREVIEW_UNAVAILABLE` | `422` | `POST /api/link-preview` |
| `RATE_LIMITED` | `429` | 7 endpoints |
| `INTERNAL_ERROR` | `500` | most endpoints |

## 7. Tech Stack（技術スタック）

TypeScript everywhere (`strict: true`), in an npm-workspaces monorepo: `frontend/`, `backend/` and `shared/` (§8). Versions are the current stable releases as of 2026-11-13; minor and patch updates are fine. Rows marked **Added in final review** weren't named earlier but the design needs them.

### 7.1 Frontend

| Purpose | Technology | Version | Notes |
|---|---|---|---|
| UI library | React | 19.3 | |
| Build tool / dev server | Vite | 8.3 | Dev server proxies `/api` and `/uploads` to the backend, so the cookie is same-origin (§9) |
| Routing | React Router (`react-router`) | 8.5 | Routes in §4.1 |
| Server state | TanStack Query | 5.107 | Query keys and invalidation in §4.3 |
| Styling | Tailwind CSS | 4.3 | |
| Tree layout | `d3-hierarchy` | 3.1 | Builds the hierarchy from the flat node list (`parentId`) |
| Pan / zoom | `d3-zoom`, `d3-selection` | 3.0, 3.0 | `d3-selection` is required by `d3-zoom`. **Added in final review** |
| Gestures | Pointer Events (browser API) | — | One code path for mouse, touch and pen (§4.3) |
| Validation | Zod (from `shared/`) | 4.6 | Same schemas as the backend |

### 7.2 Backend

| Purpose | Technology | Version | Notes |
|---|---|---|---|
| Runtime | Node.js | 26 LTS | |
| Web framework | Express | 5.3 | |
| Validation | Zod (from `shared/`) | 4.6 | Errors mapped to `VALIDATION_ERROR` with `details` |
| ORM | Prisma (`prisma`, `@prisma/client`) | 7.10.1 | DB URL in `backend/prisma.config.ts` |
| DB driver | `@prisma/adapter-pg` + `pg` | 7.10.1, 8.23 | Prisma 7 connects through a driver adapter. **Added in final review** |
| Database | PostgreSQL | 18 | Runs in Docker Compose. **Added in final review** (version) |
| Auth tokens | `jsonwebtoken` | 9.0 | JWT with `sub` and `exp` only. **Added in final review** |
| Password hashing | `bcrypt` | 6.0 | Max 72-byte input. **Added in final review** |
| Cookies | `cookie-parser` | 1.4 | Reads `access_token`. **Added in final review** |
| Security headers / CORS | `helmet`, `cors` | 8.3, 2.8 | **Added in final review** |
| Rate limiting | `express-rate-limit` | 8.7 | Signup, login, link preview, uploads, password checks. **Added in final review** |
| File uploads | Multer | 2.5 | Stores to `backend/uploads/` in dev; S3 later |
| File type check | `file-type` | 22.3 | Detects the real type from the file's first bytes. **Added in final review** |
| Link preview parsing | `cheerio` | 1.2 | Reads Open Graph and `<title>` tags. **Added in final review** |
| Daily jobs | `node-cron` | 4.6 | Trash purge and uploads cleanup (§3.10). **Added in final review** |
| Dev runner | `tsx` | 4.23 | Runs TypeScript directly with watch mode. **Added in final review** |

### 7.3 Language, Testing and Environment

| Purpose | Technology | Version | Notes |
|---|---|---|---|
| Language | TypeScript | 7.0 | `strict: true` |
| Unit / API tests | Vitest | 5.1 | Frontend, backend and `shared/` |
| API tests (HTTP) | Supertest | 7.3 | Calls the Express app in tests. **Added in final review** |
| E2E tests | Playwright (`@playwright/test`) | 1.65 | Desktop and mobile viewports (touch drag, §4.3) |
| Dev environment | Docker Compose | — | PostgreSQL only; frontend and backend run with npm |

### 7.4 Cross-cutting Policies

| Topic | Policy |
|---|---|
| API format | REST + JSON under `/api`. `{ data }` on success, `{ error: { code, message, details? } }` on failure (§6) |
| Naming | JSON and code: `camelCase`. DB tables and columns: plural `snake_case` via `@map` / `@@map` (§5) |
| IDs | `cuid` strings. Uploaded file names use `crypto.randomUUID()` instead (§6, Uploads) |
| Time | Stored as `TIMESTAMPTZ(3)` in UTC; shown in the viewer's local time |
| Auth | JWT in an httpOnly cookie (`access_token`), 7 days, `SameSite=Lax`, `Secure` in production. User and role loaded from the DB on every request |
| Hosting | Frontend and API served from the same origin (in dev through the Vite proxy) so the `SameSite=Lax` cookie is always sent. **[To confirm]** the production hosting setup (e.g. one domain behind a reverse proxy) |

## 8. Directory Structure（ディレクトリ構成）

Monorepo with npm workspaces. `shared/` holds the Zod schemas and types used by both sides (§6 policy "shared types between frontend and backend"). **Added in final review:** the `shared/` workspace.

```
highdea_tree_app/
├── CLAUDE.md
├── MANIFEST.md
├── package.json              # npm workspaces: shared, backend, frontend; root scripts (dev, test, test:e2e)
├── docker-compose.yml        # PostgreSQL 18
├── shared/                   # code used by both frontend and backend
│   ├── src/
│   │   ├── schemas/          # Zod request schemas: auth, users, trees, nodes, categories, explore, uploads, linkPreview, admin
│   │   ├── types/            # response types (UserResponse, TreeResponse, NodeSkeleton, NodeDetails, Pagination, ...)
│   │   └── errors.ts         # error code list (VALIDATION_ERROR, TREE_NOT_FOUND, NODE_LIMIT_REACHED, ...)
│   └── package.json
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma     # §5.4
│   │   ├── migrations/       # first migration also adds the one-root-per-tree partial unique index
│   │   └── seed.ts           # sample users, trees and categories for development
│   ├── prisma.config.ts      # Prisma 7 config (DATABASE_URL)
│   ├── scripts/
│   │   └── make-admin.ts     # npm run make-admin -- <email>
│   ├── uploads/              # dev image storage (gitignored)
│   ├── src/
│   │   ├── server.ts         # starts the HTTP server and the daily jobs
│   │   ├── app.ts            # Express app: helmet, cors, cookie-parser, routes, error handler
│   │   ├── config/env.ts     # reads and validates environment variables (§9)
│   │   ├── lib/              # prisma client, jwt, password (bcrypt), ssrfGuard
│   │   ├── middleware/       # auth (loads user), requireAdmin, validate (Zod), rateLimits, upload (Multer), errorHandler
│   │   ├── routes/           # auth, users, trees, trash, nodes, categories, explore, uploads, linkPreview, admin
│   │   ├── controllers/      # one per route file: parse request, call service, shape response
│   │   ├── services/         # business rules: Auth, User, Tree, Trash, Node, Category, Explore, Upload, LinkPreview, Admin
│   │   ├── jobs/             # purgeTrash.ts, cleanupUploads.ts (node-cron)
│   │   └── errors/           # AppError (code + HTTP status)
│   ├── tests/                # Vitest + Supertest API tests
│   └── package.json
└── frontend/
    ├── index.html
    ├── vite.config.ts        # proxy /api and /uploads to the backend
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx           # QueryClientProvider, router, AppHeader
    │   ├── router.tsx        # routes and guards (guest-only, login-required, owner redirect)
    │   ├── api/              # fetch client (401 handling, error details) and TanStack Query hooks per resource
    │   ├── pages/            # P-01 Landing … P-11 NotFound, one file per page
    │   ├── features/
    │   │   ├── auth/         # signup and login forms, session (useMe)
    │   │   ├── trees/        # tree cards, M-01 New Tree, M-02 Tree Settings, M-03 Move to Trash
    │   │   ├── canvas/       # TreeCanvas, NodeCard, NodeToolbar, MiniMap, ZoomControls, lazy details, gestures
    │   │   ├── nodes/        # M-04 Node Editor, M-05 Add Branch, M-06 Delete Node, M-10 Media Viewer
    │   │   ├── categories/   # category picker, M-07 Category Form, M-08 Delete Category
    │   │   ├── explore/      # feed, search, category chips
    │   │   ├── trash/        # trash list, restore
    │   │   ├── settings/     # Profile, Account and Categories tabs, M-11 Delete Account
    │   │   └── admin/        # M-09 Remove Tree
    │   ├── components/       # shared UI: AppHeader, Modal, ConfirmDialog, Toast, Pagination, FormField
    │   └── lib/              # helpers (dates, URLs, video embeds)
    ├── tests/e2e/            # Playwright tests
    └── package.json
```

## 9. Development Setup（開発環境構築）

### 9.1 Prerequisites

| Tool | Version |
|---|---|
| Node.js | 26 LTS |
| npm | 11 or later (bundled with Node.js) |
| Docker / Docker Compose | Current version (for PostgreSQL 18) |
| Git | Any recent version |

### 9.2 Setup Steps

1. Clone: `git clone https://github.com/kenola12345/highdea_tree_app.git && cd highdea_tree_app`
2. Install all workspaces: `npm install` (in the repo root)
3. Environment variables: `cp backend/.env.example backend/.env`, then set `JWT_SECRET` (see 9.3)
4. Start the database: `docker compose up -d`
5. Create the tables: `npm run prisma:migrate -w backend` (`prisma migrate dev`, including the partial unique index)
6. Sample data: `npm run seed -w backend`
7. Make yourself an admin (optional): `npm run make-admin -w backend -- you@example.com`. There is no API for granting the `ADMIN` role.
8. Run: `npm run dev` (root) starts the backend on <http://localhost:3000> and the frontend on <http://localhost:5173>. Open the frontend URL; `/api` and `/uploads` are proxied to the backend.

### 9.3 Environment Variables (`backend/.env`)

| Name | Example | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://highdea:highdea@localhost:5432/highdea` | PostgreSQL connection, used by `prisma.config.ts` and the app |
| `JWT_SECRET` | 64 random characters | Signs login tokens. At least 32 characters; never commit it |
| `PORT` | `3000` | Backend port |
| `NODE_ENV` | `development` | `production` turns on `Secure` cookies |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin (not needed when going through the Vite proxy, but set for safety) |
| `UPLOAD_DIR` | `./uploads` | Where uploaded images are stored in development |

The frontend needs no environment variables in development; it calls `/api` on its own origin.

### 9.4 Tests

| Command | What it runs |
|---|---|
| `npm test` | Vitest unit tests in all workspaces |
| `npm run test -w backend` | Backend API tests (Vitest + Supertest) against a test database |
| `npm run test:e2e` | Playwright E2E tests (desktop and mobile viewports). Starts the backend and frontend if they aren't running |

## 10. Future Extensions (Out of Scope)（将来の拡張）

Decided out of scope for v1:
- Avatar image upload (v1 uses an avatar URL)
- Admin undo of a tree removal
- Reactivating a deleted account
- Email sending (e.g. confirming a new email address)

Candidates — confirm or remove:
- Likes / bookmarks / "fork" someone else's tree
- Comments on public trees
- Real-time collaborative editing
- Cloud storage (S3) for uploaded images
- `UNLISTED` (link-only) tree visibility
- Cross-links between nodes (graph, not just tree)
- AI suggestions for branching ideas
- Export tree as image / PDF
