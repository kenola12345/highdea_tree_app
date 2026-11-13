# CLAUDE.md

## Project

**Highdea Tree** — a web app to visualize and organize ideas. A user starts with a central idea and branches it out into child nodes (text, links, videos, images). Trees can be categorized, kept private, or shared publicly for others to browse.

**The manifest in `manifests/` is the source of truth** for features, screens, data model, API and stack. Read the relevant files before implementing anything, and don't contradict them. If a change is needed, update the manifest first (or ask). `MANIFEST.md` at the root is only a pointer.

## Manifest files

```
manifests/
├── index.md    file map, old section mapping, related files, example instructions
├── common.md   overview, roles + authorization rules, data policies, ER diagram,
│               deletion policy, full Prisma schema, API policies, pagination,
│               error codes, tech stack, directory structure, setup, future ideas
├── users.md    signup/login/logout, profile, account settings (/api/auth/*, /api/users/*, users)
├── trees.md    dashboard, tree CRUD, Trash, categories (/api/trees, /api/trash,
│               /api/categories, trees, categories, tree_categories)
├── nodes.md    tree editor canvas, nodes, image upload, link preview
│               (/api/trees/:id/nodes, /api/nodes/*, /api/uploads, /api/link-preview,
│               nodes, uploads)
└── explore.md  explore feed, tree viewer, public profile, admin removal
                (/api/explore*, /api/admin/*)
```

**Reading rule:** always read `manifests/index.md` + `manifests/common.md`, then the domain file(s) for the task. When editing a manifest file, re-check the files listed for it in the "Related Files" table of `index.md`.

## Coding standards

Split by topic in `standards/` (general, frontend, backend, database, api, testing, git, environment, security, review-checklist). Path-scoped rules in `.claude/rules/` point to the right file. Read `standards/index.md` to pick the file(s) for a task; don't read them all. `CODING_STANDARDS.md` at the root is only a pointer.

## Status

Design finished (manifest v1.0, 2026-11-13). No code yet. Don't scaffold or implement features unless asked.

## Stack (summary — see manifests/common.md §7)

- Monorepo (npm workspaces): `frontend/`, `backend/`, `shared/` (Zod schemas and types used by both)
- TypeScript everywhere (`strict: true`)
- Frontend: React + Vite, React Router, TanStack Query, Tailwind CSS, custom SVG + D3 for the tree canvas
- Backend: Node.js + Express, Zod, Prisma, PostgreSQL (Docker Compose), JWT in httpOnly cookie, Multer for image uploads (local disk in dev)
- IDs: `cuid` strings

## Conventions

- No `any`; prefer explicit types for API request/response shapes.
- Validate all request input with Zod on the backend.
- API responses: `{ data }` on success, `{ error: { code, message, details? } }` on failure (`details` lists field errors for `VALIDATION_ERROR`).
- Authorization: users may only modify their own trees, nodes, and categories. Private trees are visible only to their owner — not even to admins. Admins can only remove public trees.
- Keep business logic in `services/`, not in route handlers.
- Never commit `.env` files or secrets.

## Commands

TBD — added once the project is scaffolded (Phase 1).

## Prisma Schema

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
