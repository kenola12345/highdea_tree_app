# Coding Standards — 5. API Design（API設計規約）

Part of the coding standards. Start from [index.md](./index.md). Section numbers (§N) refer to the files listed there.

### 5.1 RESTful Naming

- Base path `/api`. Resources are plural nouns: `/api/trees`, `/api/categories`, `/api/nodes/:id` *(manifest)*.
- Multi-word path segments are kebab-case: `/api/link-preview`.
- Path parameters are `:id` for the resource itself, `:username` for profiles.
- Actions that aren't plain CRUD are a `POST` to a verb sub-resource, as the manifest does: `POST /api/trees/:id/restore`, `POST /api/admin/trees/:id/remove`, `POST /api/users/me/deactivate`.
- `PATCH` for partial updates (send only changed fields). There are no `PUT` endpoints.
- `DELETE /api/trees/:id` means "move to Trash" (soft delete), as in the manifest.

❌ Bad
```
POST /api/deleteTree?id=abc
GET  /api/getUserTrees
PUT  /api/tree/abc/restoreFromTrash
```

✅ Good
```
DELETE /api/trees/abc
GET    /api/trees?page=1&limit=20
POST   /api/trees/abc/restore
```

### 5.2 Response Format

Exactly as the manifest decides:

```json
{ "data": { "tree": { "id": "clx…", "title": "Startup ideas", "visibility": "PRIVATE" } } }
```

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields are invalid",
    "details": [{ "field": "title", "message": "Must be 1–100 characters" }]
  }
}
```

- `data` is always an object with named keys (`data.tree`, `data.trees`, `data.node`), never a bare array, so fields can be added later.
- Paged lists add `data.pagination: { page, limit, total }` (see the manifest's [Pagination](../manifests/common.md#pagination)).
- `details` appears only on `VALIDATION_ERROR`.
- JSON keys are `camelCase`; timestamps are ISO 8601 strings in UTC (`"2026-11-13T04:05:06.789Z"`).
- Response objects are built by mapper functions (`toTreeResponse`, `toNodeResponse`), typed with the `shared/` response types. Don't return Prisma rows directly.

❌ Bad
```json
{ "success": true, "result": [{ "owner_id": "…", "password_hash": "…" }] }
```

✅ Good
```ts
res.status(200).json({ data: { trees: trees.map(toTreeResponse), pagination: { page, limit, total } } });
```

### 5.3 HTTP Status Codes

| Status | When | Example |
|---|---|---|
| `200 OK` | Read, update, soft delete, action endpoints | `GET /api/trees/:id`, `PATCH /api/nodes/:id`, `DELETE /api/trees/:id`, `POST /api/trees/:id/restore` |
| `201 Created` | A new resource was created | `POST /api/auth/signup`, `POST /api/trees`, `POST /api/trees/:id/nodes`, `POST /api/categories`, `POST /api/uploads` |
| `400` | Input invalid (`VALIDATION_ERROR`, `USERNAME_RESERVED`, `URL_NOT_ALLOWED`) | title too long |
| `401` | Not logged in or deactivated (`UNAUTHENTICATED`), wrong login (`INVALID_CREDENTIALS`) | expired cookie |
| `403` | Logged in but not allowed: `FORBIDDEN` (not admin), `ALREADY_AUTHENTICATED`, `WRONG_PASSWORD` | a `USER` calling the admin API |
| `404` | Not found **or not visible to the caller** | someone else's private tree |
| `409` | Business rule conflict | `NODE_LIMIT_REACHED`, `CANNOT_DELETE_ROOT`, `INVALID_MOVE`, `TREE_NOT_IN_TRASH` |
| `413` / `415` | Upload too large / not an allowed image | 6 MB PNG, SVG |
| `422` | Link preview couldn't be fetched (`PREVIEW_UNAVAILABLE`) | page timed out |
| `429` | Rate limit (`RATE_LIMITED`) | 6th failed login in 15 min |
| `500` | Unexpected error (`INTERNAL_ERROR`) | — |

- **`404`, not `403`, for resources the caller may not see** *(manifest)*. `403` is only for the cases in the table above.
- Every endpoint documents and implements the exact codes listed in its manifest spec. A new error code is added to the manifest's Error Codes table and `shared/src/errors.ts` first.
