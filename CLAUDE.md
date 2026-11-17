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

v1 is implemented: every task in `backend-tasks.md` and `frontend-tasks.md` is done (later additions such as connections between ideas are tracked as extra Phases in `frontend-tasks.md`), with API, unit and Playwright E2E tests. Still open: the production hosting setup (manifests/common.md §7.4, **[To confirm]**) and CI. New features or behavior changes go into the manifest first.

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

Run from the repo root (npm workspaces). Requires Node ≥ 26 and Docker.

```bash
npm install
docker compose up -d --wait           # PostgreSQL (dev DB `highdea`; `highdea_test` is created on first start)
cp backend/.env.example backend/.env  # first time only; set JWT_SECRET
npm run prisma:migrate -w backend     # apply migrations (prisma migrate dev)
npm run seed -w backend               # sample data; all seed users use password `password123`
npm run make-admin -w backend -- you@example.com

npm run dev        # backend http://localhost:3000 + frontend http://localhost:5173 (Vite proxies /api)
npm test           # unit + API tests in every workspace (backend tests use backend/.env.test)
npm run test:e2e   # Playwright, desktop + mobile; starts its own servers on :3100/:5174 with DB `highdea_e2e`
npm run typecheck
npm run lint
npm run format
```

Seed accounts: `alice@example.com`, `bob@example.com` (USER), `admin@example.com` (ADMIN).

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

enum NodeShape {
  ROUNDED
  RECTANGLE
  PILL
  ELLIPSE
}

enum GridStyle {
  LINES
  DOTS
  NONE
}

enum NodeRole {
  CORE
  SUPPORTING
  IMPORTANT
  EXAMPLE
  QUESTION
}

enum NodeStylePreset {
  MINIMAL
  MIDNIGHT
  ORGANIC
  EDITORIAL
}

enum ConnectionKind {
  RELATED
  SEQUENCE
  DEPENDENCY
  CONTRAST
}

enum ConnectionArrow {
  A_TO_B
  B_TO_A
}

enum GroupKind {
  BOX
  NOTE
  LABEL
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
  id              String          @id @default(cuid())
  ownerId         String          @map("owner_id")
  title           String          @db.VarChar(100)
  description     String?         @db.VarChar(500)
  visibility      TreeVisibility  @default(PRIVATE)
  removedAt       DateTime?       @map("removed_at") @db.Timestamptz(3)
  removedById     String?         @map("removed_by_id")
  removalReason   String?         @map("removal_reason") @db.VarChar(500)
  // Canvas look (manifests/nodes.md §3.5 Canvas look). NULL colors = the frontend's defaults
  gridStyle       GridStyle       @default(LINES) @map("grid_style")
  gridColor       String?         @map("grid_color") @db.VarChar(7)
  gridOpacity     Int             @default(100) @map("grid_opacity")
  gridSpacing     Int             @default(24) @map("grid_spacing")
  nodeStyle       NodeStylePreset @default(MINIMAL) @map("node_style")
  backgroundColor String?         @map("background_color") @db.VarChar(7)
  createdAt       DateTime        @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt       DateTime        @updatedAt @map("updated_at") @db.Timestamptz(3)
  deletedAt       DateTime?       @map("deleted_at") @db.Timestamptz(3)

  owner       User             @relation("TreeOwner", fields: [ownerId], references: [id], onDelete: Restrict)
  removedBy   User?            @relation("TreeRemovedBy", fields: [removedById], references: [id], onDelete: Restrict)
  nodes       Node[]
  categories  TreeCategory[]
  connections NodeConnection[]
  groups      NodeGroup[]

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
  lineColor          String?   @map("line_color") @db.VarChar(7)
  cardColor          String?   @map("card_color") @db.VarChar(7)
  shape              NodeShape @default(ROUNDED)
  // Card size in canvas units; NULL = the frontend's default size
  width              Int?
  height             Int?
  // Text size (px, for the note) and color; NULL = default size / automatic contrast
  fontSize           Int?      @map("font_size")
  textColor          String?   @map("text_color") @db.VarChar(7)
  role               NodeRole?
  createdAt          DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt          DateTime  @updatedAt @map("updated_at") @db.Timestamptz(3)

  tree         Tree             @relation(fields: [treeId], references: [id], onDelete: Cascade)
  parent       Node?            @relation("NodeChildren", fields: [parentId], references: [id], onDelete: Cascade)
  children     Node[]           @relation("NodeChildren")
  imageUpload  Upload?          @relation(fields: [imageUploadId], references: [id], onDelete: Restrict)
  connectionsA NodeConnection[] @relation("ConnectionNodeA")
  connectionsB NodeConnection[] @relation("ConnectionNodeB")

  @@index([treeId])
  @@index([parentId, sortOrder])
  @@index([imageUploadId])
  @@map("nodes")
}

// Extra line between two ideas of the same tree (besides parent → child). Undirected:
// node_a_id < node_b_id (DB CHECK added with raw SQL in the migration), so each pair is stored once.
model NodeConnection {
  id        String           @id @default(cuid())
  treeId    String           @map("tree_id")
  nodeAId   String           @map("node_a_id")
  nodeBId   String           @map("node_b_id")
  color     String?          @db.VarChar(7)
  kind      ConnectionKind   @default(RELATED)
  arrow     ConnectionArrow?
  createdAt DateTime         @default(now()) @map("created_at") @db.Timestamptz(3)

  tree  Tree @relation(fields: [treeId], references: [id], onDelete: Cascade)
  nodeA Node @relation("ConnectionNodeA", fields: [nodeAId], references: [id], onDelete: Cascade)
  nodeB Node @relation("ConnectionNodeB", fields: [nodeBId], references: [id], onDelete: Cascade)

  @@unique([nodeAId, nodeBId])
  @@index([treeId])
  @@index([nodeBId])
  @@map("node_connections")
}

// Canvas item placed with the Add menu: a box around ideas, a sticky note or a text label
// (manifests/nodes.md §3.5). Box membership isn't stored: an idea is in a box when its center is inside it.
model NodeGroup {
  id        String    @id @default(cuid())
  treeId    String    @map("tree_id")
  kind      GroupKind @default(BOX)
  title     String    @default("Group") @db.VarChar(100)
  body      String?   @db.VarChar(2000)
  color     String?   @db.VarChar(7)
  positionX Float     @map("position_x")
  positionY Float     @map("position_y")
  width     Int
  height    Int
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime  @updatedAt @map("updated_at") @db.Timestamptz(3)

  tree Tree @relation(fields: [treeId], references: [id], onDelete: Cascade)

  @@index([treeId])
  @@map("node_groups")
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
