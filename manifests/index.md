# Highdea Tree — Manifest Index

> Status: Final (v1.0, 2026-11-13). Split from the single `MANIFEST.md` by domain.

**Highdea Tree** is a web app for visualizing ideas: a user starts with one central idea and branches it out into a tree of text, link, video and image nodes on a canvas. Trees can be private or public, organized with categories, and browsed by others on Explore. Stack: React + Vite + TanStack Query + Tailwind + D3 (frontend), Node.js + Express + Zod + Prisma + PostgreSQL (backend), TypeScript everywhere.

## Reading Rule

Always read **`index.md` + `common.md`**, then the domain file(s) for the task. Never just "read the manifest"; name the files.

## File Map

| File | Covers | Read it when… |
|---|---|---|
| [index.md](./index.md) | This map, section mapping, related files, example instructions | Always, first |
| [common.md](./common.md) | Overview, roles and shared authorization rules, role × page summary, background jobs, shared pages (P-01, P-11) and routing rules, cross-cutting SPA points, data policies, ER diagram, deletion policy, **full Prisma schema**, API policies and endpoint list, pagination, error codes, tech stack, directory structure, setup, future extensions | Always, second |
| [users.md](./users.md) | Sign up, log in, log out, session (`/api/auth/*`); profiles and account settings (`/api/users/*`); pages P-02, P-03, P-10; modal M-11; `users` table | Working on auth, the session, profiles, Settings (Profile/Account tabs) or account deletion |
| [trees.md](./trees.md) | Trees (`/api/trees`, `/api/trees/:id`), Trash (`/api/trash`, restore, permanent delete), categories (`/api/categories`); pages P-04, P-09; modals M-01, M-02, M-03, M-07, M-08, M-13; tree lifecycle; `trees`, `categories`, `tree_categories` tables | Working on My Trees, creating/editing/deleting trees, the Trash, categories or the Settings Categories tab |
| [nodes.md](./nodes.md) | Nodes (`/api/trees/:id/nodes`, `/api/nodes/*`, positions), connections between ideas (`/api/trees/:id/connections`, `/api/connections/:id`), uploads, link preview; page P-05 (Tree Editor); modals M-04, M-05, M-06, M-10; editor layout and canvas SPA points (lazy loading, drag, touch); `nodes`, `node_connections`, `uploads` tables | Working on the editor canvas, nodes, connections, drag and drop, mobile gestures, image upload or link previews |
| [explore.md](./explore.md) | Explore feed and category filter (`/api/explore*`), admin removal (`/api/admin/*`); pages P-06, P-07, P-08; modals M-09, M-12 | Working on Explore, the read-only Tree Viewer, public profile pages or moderation |

## Old MANIFEST.md Section Mapping（旧MANIFEST.mdセクション対応表）

| Old section | Now in |
|---|---|
| 1. Project Overview（プロジェクト概要） | common.md |
| 2. User Roles (RBAC)（ユーザーロール定義）: role table, shared rules | common.md (`## Authorization Rules`) |
| 2.1 Role × API Access Matrix | Each domain file's `## 3. Authorization` (rows for its own endpoints) |
| 2.2 Role × Page Summary | common.md |
| 3. Functional Requirements（機能要件） | 3.1, 3.2 → users.md · 3.3, 3.4, 3.7 → trees.md · 3.5, 3.6 → nodes.md · 3.8, 3.9 → explore.md · intro, 3.10 → common.md |
| 4. Screens & Navigation（画面遷移・構成）: intro, access legend, routing rules | common.md |
| 4.1 Page List（ページ一覧） | P-01, P-11 → common.md · P-02, P-03, P-10 → users.md · P-04, P-09 → trees.md · P-05 → nodes.md · P-06, P-07, P-08 → explore.md |
| 4.2 Modal List（モーダル一覧） | M-11 → users.md · M-01, M-02, M-03, M-07, M-08, M-13 → trees.md · M-04, M-05, M-06, M-10 → nodes.md · M-09, M-12 → explore.md |
| 4.3 Main Screen Layout (Tree Editor) | nodes.md |
| 4.3 Tree Lifecycle | trees.md |
| 4.3 SPA UI/UX Points | Canvas and node points → nodes.md · cross-cutting points (errors, session, cache, business rules, not-found) → common.md |
| 5. Data Modeling（データモデリング）: policies, 5.1 ER diagram, 5.3 deletion policy, 5.4 Prisma schema | common.md |
| 5.2 Table Definitions（テーブル定義） | `users` → users.md · `trees`, `categories`, `tree_categories` → trees.md · `nodes`, `node_connections`, `uploads` → nodes.md |
| 6. API Design（API設計）: policies, endpoint list | common.md (plus `## Pagination`, `## Error Codes`) |
| 6. Endpoint specs | Auth, Users → users.md · Trees, Trash, Categories → trees.md · Nodes, Connections, Uploads, Link preview → nodes.md · Explore, Admin → explore.md |
| 7. Tech Stack（技術スタック） | common.md |
| 8. Directory Structure（ディレクトリ構成） | common.md |
| 9. Development Setup（開発環境構築） | common.md |
| 10. Future Extensions（将来の拡張） | common.md |

## Related Files（関連ファイル表）

When you change a file, re-check these:

| File you change | Also check | What to check |
|---|---|---|
| common.md | All domain files | Authorization rules, response and error format, error codes, pagination, Prisma schema fields used by each table definition |
| users.md | common.md, explore.md, trees.md | `users` columns vs. the Prisma schema; deactivated-user rules (they hide profiles and public trees in explore.md); Settings page P-10 also hosts the Categories tab (trees.md) |
| trees.md | common.md, nodes.md, explore.md | `trees` / `categories` columns vs. the schema; tree visibility, removal and Trash rules (used by nodes.md for "tree not in Trash" and by explore.md for public trees); `GET /api/trees/:id` node skeleton fields (nodes.md lazy loading) |
| nodes.md | common.md, trees.md | `nodes` / `node_connections` / `uploads` columns vs. the schema; 2,000-node and 500-connection limits; `data.connections` in `GET /api/trees/:id` (trees.md); node skeleton vs. `GET /api/trees/:id`; uploads cleanup job (common.md §3.10) |
| explore.md | common.md, trees.md, users.md | Public-tree definition; admin removal rules vs. tree lifecycle (trees.md); `GET /api/users/:username` profile data (users.md) |

## Example Instructions for AI（AIへの指示例）

- "Read manifests/index.md, common.md and users.md, then implement the auth API (`/api/auth/*`)."
- "Read manifests/index.md, common.md and trees.md, then implement the Trash: `GET /api/trash`, `POST /api/trees/:id/restore` and page P-09."
- "Read manifests/index.md, common.md, nodes.md and trees.md, then build the Tree Editor canvas (P-05) with lazy loading and touch drag."
- "Read manifests/index.md, common.md and explore.md, then build the Explore page (P-07) with the category filter."
- "Read manifests/index.md and common.md, then set up Prisma with the schema in common.md §5.4."
