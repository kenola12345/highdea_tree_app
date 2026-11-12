# Highdea Tree — Application Manifest

> Status: Draft (skeleton). Details marked "TBD" will be filled in later phases.
> Section headings carry the Japanese name in parentheses so the manifest-flow skills can find them.

## 1. Project Overview（プロジェクト概要）

**Highdea Tree** is a web app for visualizing ideas so people can organize their thoughts.

- A user starts with **one central idea** ("highdea") and **branches it out** into child ideas, forming a visual tree / mind map.
- Each node can hold anything: **raw text thoughts, website links, videos**, etc.
- Users can **categorize** their idea trees.
- Users can **browse other people's public highdeas** for inspiration.

**Target users:** anyone who wants to think visually — students, creators, developers, planners.
**Problem solved:** linear notes make it hard to see how ideas connect. Highdea Tree makes structure visible.

## 2. User Roles (RBAC)（ユーザーロール定義）

| Role | Description |
|---|---|
| Guest | Not logged in. Can browse public trees only. |
| User | Registered account. Creates and manages their own trees. |
| Admin | **[TBD]** Moderation of public content. |

| Action | Guest | User | Admin |
|---|---|---|---|
| View public trees | ✅ | ✅ | ✅ |
| Sign up / log in | ✅ | — | — |
| Create / edit / delete own trees & nodes | ❌ | ✅ (own only) | ✅ |
| Manage own categories | ❌ | ✅ | ✅ |
| View others' private trees | ❌ | ❌ | **[TBD]** |
| Remove inappropriate public content | ❌ | ❌ | ✅ |

## 3. Functional Requirements（機能要件）

### 3.1 Authentication
Sign up, log in, log out. Each user has a public profile (username, display name, avatar).

### 3.2 Idea Trees (Boards)
- Create a tree with a title and a **root (center) idea**.
- Each tree has a **visibility**: `PRIVATE` (default) or `PUBLIC`. **[TBD]** `UNLISTED` (link-only).
- Edit / delete own trees.

### 3.3 Idea Nodes
- Add child nodes branching from any node (rule: every node except the root has exactly one parent).
- Node types: `TEXT` (raw thought), `LINK` (website), `VIDEO` (e.g. YouTube URL, embedded).
  **[TBD]** `IMAGE` upload.
- For `LINK`, show a preview (title/thumbnail). **[TBD]** whether previews are fetched server-side.
- Drag nodes to reposition; node positions are saved.
- Deleting a node deletes its subtree (with confirmation).

### 3.4 Categories
- Users create their own categories (name + color) and assign them to trees.
- **[TBD]** One category per tree vs. multiple (tags).

### 3.5 Explore
- Browse a feed of public trees from all users, filter by category / search by title.
- View a public tree read-only, and view a user's profile with their public trees.

## 4. Screens & Navigation（画面遷移・構成）

| Screen | Path | Purpose |
|---|---|---|
| Landing | `/` | Intro + links to Explore / Sign up |
| Sign up / Log in | `/signup`, `/login` | Authentication |
| My Trees (Dashboard) | `/me` | List own trees, filter by category |
| Tree Editor (canvas) | `/trees/:id/edit` | Visual branching editor |
| Tree Viewer | `/trees/:id` | Read-only view (public or own) |
| Explore | `/explore` | Public trees feed |
| User Profile | `/u/:username` | A user's public trees |
| Settings | `/settings` | Profile & category management |

> Details TBD (screen design phase)

## 5. Data Modeling（データモデリング）

Main entities:

- **User** 1—N **Tree**
- **User** 1—N **Category**
- **Tree** N—1 **Category** (nullable) — **[TBD]** N—N if multiple tags
- **Tree** 1—N **Node**
- **Node** 1—N **Node** (self-relation via `parentId`; root has `parentId = null`)

Key decisions:
- Primary keys: `cuid` strings (**[TBD]** confirm).
- `Tree.visibility`: enum `PRIVATE | PUBLIC`.
- `Node.type`: enum `TEXT | LINK | VIDEO`.
- `Node.positionX / positionY`: float, stored for the canvas layout.

> Full schema TBD (DB design phase)

## 6. API Design（API設計）

Policies:
- REST, JSON, base path `/api`.
- Auth: JWT (access token) via `Authorization: Bearer` header. **[TBD]** httpOnly cookie instead.
- Common response shape: `{ "data": ... }` on success, `{ "error": { "code", "message" } }` on failure.
- Request validation with Zod; shared types between frontend and backend.

| Resource | Main endpoints |
|---|---|
| Auth | `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me` |
| Users | `GET /api/users/:username`, `PATCH /api/users/me` |
| Trees | `GET /api/trees` (mine), `POST /api/trees`, `GET /api/trees/:id`, `PATCH /api/trees/:id`, `DELETE /api/trees/:id` |
| Nodes | `POST /api/trees/:id/nodes`, `PATCH /api/nodes/:id`, `DELETE /api/nodes/:id` |
| Categories | `GET /api/categories`, `POST /api/categories`, `PATCH /api/categories/:id`, `DELETE /api/categories/:id` |
| Explore | `GET /api/explore` (public trees, paginated, `?category=&q=`) |

> Request/response details TBD (API design phase)

## 7. Tech Stack（技術スタック）

| Layer | Technology |
|---|---|
| Language | TypeScript (frontend & backend) |
| Frontend | React + Vite, React Router |
| Canvas / tree visualization | React Flow (`@xyflow/react`) — **[TBD]** confirm |
| Frontend data fetching | TanStack Query |
| Styling | **[TBD]** (Tailwind CSS / CSS Modules) |
| Backend | Node.js + Express |
| Validation | Zod |
| ORM | Prisma |
| Database | PostgreSQL |
| Auth | JWT + bcrypt |
| Dev environment | Docker Compose (PostgreSQL) |
| Testing | Vitest (unit), Playwright (E2E) |

> Exact versions TBD.

## 8. Directory Structure（ディレクトリ構成）

Monorepo:

```
highdea_tree_app/
├── CLAUDE.md
├── MANIFEST.md
├── docker-compose.yml
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── features/      # tree-editor, explore, auth, ...
│   │   ├── api/
│   │   └── types/
│   └── package.json
└── backend/
    ├── src/
    │   ├── routes/
    │   ├── controllers/
    │   ├── services/
    │   ├── middleware/
    │   └── lib/
    ├── prisma/
    │   └── schema.prisma
    └── package.json
```

## 9. Development Setup（開発環境構築）

1. Requirements: Node.js (LTS), npm, Docker.
2. `docker compose up -d` — start PostgreSQL.
3. `backend/`: copy `.env.example` → `.env`, `npm install`, `npx prisma migrate dev`, `npm run dev`.
4. `frontend/`: `npm install`, `npm run dev`.

> Details TBD (Phase 1 setup).

## 10. Future Extensions (Out of Scope)（将来の拡張）

Candidates — confirm or remove:
- Likes / bookmarks / "fork" someone else's tree
- Comments on public trees
- Real-time collaborative editing
- Image / file uploads on nodes
- Cross-links between nodes (graph, not just tree)
- AI suggestions for branching ideas
- Export tree as image / PDF
