# Explore — Public Feed, Tree Viewer, Public Profiles and Moderation

Shared types, error codes and authorization rules are defined in [common.md](./common.md). Start from [index.md](./index.md).

## 1. Overview

The Explore feed with search and category filter, the read-only Tree Viewer, public user profiles, and admin removal of public trees. Related: [trees.md](./trees.md) (`GET /api/trees/:id`, tree visibility and lifecycle), [users.md](./users.md) (`GET /api/users/:username`), [nodes.md](./nodes.md) (canvas shared with the viewer).

## 2. Functional Requirements

### 3.8 Explore & Public Profiles

- Browse a feed of public trees from all users, newest first, with search (title and description, case-insensitive) and a category filter.
- The category filter lists category names used on public trees, grouped across users by name and sorted by how many public trees use them.
- View a public tree read-only, and a user's public profile with their public trees.
- **Pages/modals:** P-06, P-07, P-08. **API:** `GET /api/explore`, `GET /api/explore/categories`, `GET /api/users/:username`, `GET /api/trees/:id`, `GET /api/trees/:id/nodes`. **Tables:** `trees`, `categories`, `users`.

### 3.9 Moderation (Admin)

- Admins can remove an inappropriate **public** tree, with a required reason. The tree is hidden from the public and set to `PRIVATE`; the owner keeps it, sees the reason, and can't make it public again.
- Admins can't see or act on private trees. There's no undo of a removal in v1.
- **Pages/modals:** P-06, M-09. **API:** `POST /api/admin/trees/:id/remove`. **Tables:** `trees.removed_at`, `removed_by_id`, `removal_reason`.

## 3. Authorization

Shared rules (owner, `404` instead of `403`, what "public tree" means): see [common.md — Authorization Rules](./common.md#authorization-rules). Endpoint-specific conditions are in each cell.

| Endpoint | Guest | `USER` | `ADMIN` |
|---|---|---|---|
| `GET /api/explore` | ✅ | ✅ | ✅ |
| `GET /api/explore/categories` | ✅ | ✅ | ✅ |
| `POST /api/admin/trees/:id/remove` | ❌ | ❌ (`403`) | ✅ public trees only |

## 4. Screens

### Pages

| ID | Screen | URL | Summary | Access |
|---|---|---|---|---|
| P-06 | Tree Viewer | `/trees/:id` | Read-only canvas of a tree, with owner name, categories and description. Owners see an "Edit" button; admins see "Remove" on public trees | Anyone (public trees); Owner (own private or removed trees) |
| P-07 | Explore | `/explore` | Feed of public trees from all users: search box, popular category chips, paging. Each card links to the Tree Viewer and the owner's profile | Anyone |
| P-08 | User Profile | `/u/:username` | Avatar, display name, username, join date, and the user's public trees with paging | Anyone |

### Modals

| ID | Modal | Trigger | Main functions |
|---|---|---|---|
| M-09 | Remove Tree (Admin) | "Remove" button in the Tree Viewer (P-06), shown only to `ADMIN` on public trees | Required reason (shown to the owner). "Removes the tree from public view and makes it private." (`POST /api/admin/trees/:id/remove`). After success, the viewer shows P-11 because the tree is no longer public |

## 5. API

#### Explore

---
##### **GET /api/explore**

- **Summary（機能概要）:** Returns a page of public trees from all users, with optional category filter and search. Used by the Explore screen (`/explore`).
- **Authorization（認可）:** Anyone (Guest, `USER`, `ADMIN`). Login is optional. Only public trees are ever returned, for every caller including admins.

**Request（リクエスト）**

- **Query Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `q` | `String` | | Search text, 1–100 characters after trimming. Matches trees whose title or description contains it, ignoring upper/lower case |
| `category` | `String` | | Category **key** from `GET /api/explore/categories` (or any category name), 1–50 characters. Lowercased, then matched against `categories.name_key`, so it finds trees tagged with any user's category of that name, ignoring upper/lower case |
| `page` | `Int` | | Page number, starting at 1. Default `1` |
| `limit` | `Int` | | Trees per page, 1–50. Default `20` |

`q` and `category` can be combined; a tree must match both.

**Response（レスポンス）**

- **Success: `200 OK`**
  Follows the common format `{ "data": {...} }`.
  - `data.trees`: trees where `visibility` is `PUBLIC`, `removedAt` and `deletedAt` aren't set, and the owner isn't deactivated, newest `updatedAt` first. Each item has `id`, `title`, `description`, `categories` (`id`, `name`, `color`), `nodeCount`, `updatedAt`, and `owner` (`username`, `displayName`, `avatarUrl`).
  - `data.pagination`: `page`, `limit`, `total` (shared [Pagination](./common.md#pagination) shape).
  No matches returns an empty list, not an error.
  Search uses a simple case-insensitive "contains" match (`ILIKE`), which is fine for a small number of trees. A trigram index (`pg_trgm`) or full-text search can be added later if it gets slow.
- **Error Responses**
  Follows the common format `{ "error": { "code", "message" } }`.
  - `400` `VALIDATION_ERROR` — `q` or `category` is too long or empty after trimming, `page` or `limit` isn't a positive integer, or `limit` is over 50.
  - `500` `INTERNAL_ERROR` — Unexpected server error.
---

---
##### **GET /api/explore/categories**

- **Summary（機能概要）:** Returns the category names used on public trees, most used first, for the Explore screen's category filter. Categories belong to each user, so this groups them by name across all users.
- **Authorization（認可）:** Anyone (Guest, `USER`, `ADMIN`). Login is optional. Only categories on publicly visible trees are counted.

**Request（リクエスト）**

- **Query Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `q` | `String` | | Only names starting with this text, ignoring upper/lower case. 1–50 characters after trimming |
| `limit` | `Int` | | 1–50. Default `20` |

**Response（レスポンス）**

- **Success: `200 OK`**
  Follows the common format `{ "data": {...} }`. `data.categories`: one entry per distinct `name_key`, each with `key` (the lowercased name, passed to `GET /api/explore?category=`), `name` (the most common spelling, for display; on a tie, the spelling that starts with a capital letter, e.g. "Work" over "work") and `treeCount` (public trees that aren't removed or deleted and whose owner is active). Sorted by `treeCount`, highest first. Categories used only on private, removed or deleted trees aren't listed.
- **Error Responses**
  Follows the common format `{ "error": { "code", "message" } }`.
  - `400` `VALIDATION_ERROR` — `q` is empty after trimming or too long, or `limit` isn't an integer from 1 to 50.
  - `500` `INTERNAL_ERROR` — Unexpected server error.
---

#### Admin

---
##### **POST /api/admin/trees/:id/remove**

- **Summary（機能概要）:** Lets an admin take down an inappropriate public tree. It isn't a real delete: the tree gets `removedAt`, `removedById` and `removalReason`, and its `visibility` is set to `PRIVATE` in the same update, so the tree's data matches what the public sees. It disappears from Explore, profiles and public viewing, and stays with its owner, who can still see and edit it privately and sees the reason. The owner can't make it public again.
- **Authorization（認可）:** `ADMIN` only. Admins can act only on trees they're allowed to see, meaning public ones; a private tree returns `404`, the same as for anyone else.

**Request（リクエスト）**

- **Path Parameters**

| Name | Type | Description |
|---|---|---|
| `id` | `String` | Tree ID (cuid) |

- **Body**

| Name | Type | Required | Description |
|---|---|---|---|
| `reason` | `String` | ✅ | Why the tree was removed, shown to the owner. Trimmed. 1–500 characters |

**Response（レスポンス）**

- **Success: `200 OK`**
  Follows the common format `{ "data": {...} }`. `data.tree`: `id`, `title`, `visibility` (now `"PRIVATE"`), `removedAt`, `removalReason`.
- **Error Responses**
  Follows the common format `{ "error": { "code", "message" } }`.
  - `400` `VALIDATION_ERROR` — `reason` is missing, empty after trimming, or longer than 500 characters.
  - `401` `UNAUTHENTICATED` — No valid auth cookie, or the user is deactivated (`deletedAt` set).
  - `403` `FORBIDDEN` — The user is logged in but isn't an `ADMIN`.
  - `404` `TREE_NOT_FOUND` — The tree doesn't exist, is private, is in the Trash, or its owner is deactivated (it's not publicly visible).
  - `409` `TREE_ALREADY_REMOVED` — An admin already removed this tree.
  - `500` `INTERNAL_ERROR` — Unexpected server error.
---

## 6. Data

Full Prisma schema, ER diagram and deletion policy: [common.md — Data Modeling](./common.md#5-data-modelingデータモデリング).
