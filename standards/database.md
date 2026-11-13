# Coding Standards — 4. ORM / Database（ORM/データベース規約）

Part of the coding standards. Start from [index.md](./index.md). Section numbers (§N) refer to the files listed there.

PostgreSQL 18, Prisma 7.10.1 *(manifest)*. The full schema is in `manifests/common.md` §5.4 and `CLAUDE.md`.

### 4.1 Schema Design

- Models are singular `PascalCase` (`Tree`), fields `camelCase` (`removedById`). Tables are plural `snake_case` with `@@map("trees")`, columns `snake_case` with `@map("removed_by_id")` *(manifest)*.
- IDs: `String @id @default(cuid())` *(manifest)*.
- Timestamps: `@db.Timestamptz(3)`, stored in UTC; every model has `createdAt` and, if rows change, `updatedAt @updatedAt` *(manifest)*.
- State columns are Prisma enums (`UserRole`, `TreeVisibility`, `NodeType`) *(manifest)*.
- Soft deletes use `deletedAt DateTime?` (users, trees). Admin removal uses `removedAt` / `removedById` / `removalReason`, kept separate from `deletedAt` *(manifest)*.
- `onDelete`: links to `User` are `Restrict`; owned children (`Node.tree`, `Node.parent`, `TreeCategory.*`) are `Cascade`; `Node.imageUpload` is `Restrict` *(manifest)*.
- Length limits that are business rules use `@db.VarChar(n)` and match the Zod schema.
- Every schema change goes into the manifest first, then `schema.prisma`, then a migration, in the same PR. Update the `## Prisma Schema` section of `CLAUDE.md` too.

❌ Bad
```prisma
model trees {
  ID        Int      @id @default(autoincrement())
  OwnerId   String
  status    String   // "public" | "private"
  createdAt DateTime @default(now())
}
```

✅ Good (matches the manifest)
```prisma
model Tree {
  id         String         @id @default(cuid())
  ownerId    String         @map("owner_id")
  visibility TreeVisibility @default(PRIVATE)
  createdAt  DateTime       @default(now()) @map("created_at") @db.Timestamptz(3)
  deletedAt  DateTime?      @map("deleted_at") @db.Timestamptz(3)

  owner User @relation("TreeOwner", fields: [ownerId], references: [id], onDelete: Restrict)

  @@map("trees")
}
```

### 4.2 Migrations

- Create migrations with `npm run prisma:migrate -w backend -- --name <snake_case_description>` (e.g. `add_tree_removal_fields`). Commit the generated SQL.
- Never edit a migration that is already on `main`. Add a new one.
- Things Prisma can't express are added as raw SQL in the migration, with a comment. The first migration must include the one-root-per-tree index *(manifest)*:

```sql
-- 各ツリーのルートノード（parent_id IS NULL）は1つだけ（Prisma では部分インデックスを表現できないため手書き）
CREATE UNIQUE INDEX nodes_one_root_per_tree ON nodes(tree_id) WHERE parent_id IS NULL;
```

### 4.3 Client Setup

- One `PrismaClient` for the whole process, created in `lib/prisma.ts` with the pg adapter. Never create a client per request or per service.
- The connection URL comes from the validated env (`config/env.ts`), never from `process.env` directly.
- Query logging (`log: ["query"]`) only in development.

❌ Bad
```ts
export async function getTree(id: string) {
  const prisma = new PrismaClient(); // new connection pool on every call
  return prisma.tree.findUnique({ where: { id } });
}
```

✅ Good
```ts
// backend/src/lib/prisma.ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { env } from "../config/env.js";

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

/** アプリ全体で共有する唯一の PrismaClient */
export const prisma = new PrismaClient({
  adapter,
  log: env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["warn", "error"],
});
```

### 4.4 Queries

- **Always filter soft-deleted and hidden rows.** Use one helper per rule, so no query forgets a condition:

```ts
// services/tree.service.ts
/** 「公開ツリー」の定義（共通認可ルール）: PUBLIC・未削除・ゴミ箱外・所有者が有効 */
export const publicTreeWhere = {
  visibility: "PUBLIC",
  removedAt: null,
  deletedAt: null,
  owner: { deletedAt: null },
} satisfies Prisma.TreeWhereInput;
```

- Select only the fields you return. `passwordHash` is never selected outside AuthService and UserService password checks.
- No unbounded `findMany`: list endpoints use `take` / `skip` from the [pagination](../manifests/common.md#pagination) params (`limit` 1–50). The tree skeleton is bounded by the 2,000-node limit.
- No N+1 queries: use `include` / `select` with relations, or `_count` (e.g. `nodeCount` on tree cards).
- Ownership is part of the `where` clause (`{ id, ownerId: userId }`), not a check after loading the row.
- Raw SQL only through `$queryRaw` tagged templates (parameterized). `$queryRawUnsafe` and `$executeRawUnsafe` are not allowed.

❌ Bad: N+1 and the hash leaks into the response.
```ts
const trees = await prisma.tree.findMany({ where: { ownerId } });
for (const t of trees) {
  t.nodeCount = await prisma.node.count({ where: { treeId: t.id } });
  t.owner = await prisma.user.findUnique({ where: { id: t.ownerId } });
}
```

✅ Good
```ts
const trees = await prisma.tree.findMany({
  where: { ownerId: userId, deletedAt: null },
  orderBy: { updatedAt: "desc" },
  skip: (page - 1) * limit,
  take: limit,
  select: {
    id: true, title: true, description: true, visibility: true, removedAt: true, updatedAt: true,
    categories: { select: { category: { select: { id: true, name: true, color: true } } } },
    _count: { select: { nodes: true } },
  },
});
```

### 4.5 Transactions

Use `prisma.$transaction(async (tx) => ...)` whenever a check and a write must agree, or more than one row changes. Inside it, use `tx`, never the global `prisma`. Required cases from the manifest:

| Operation | Why |
|---|---|
| `POST /api/trees` (tree + root node + category tags) | All or nothing |
| `POST /api/trees/:id/nodes` | Count + insert under `SELECT ... FOR UPDATE` on the tree row (2,000-node limit) + bump `trees.updated_at` |
| `PATCH /api/nodes/:id` | Cycle check + update + bump `updated_at` |
| `PATCH /api/trees/:id/nodes/positions` | Every node saved or none |
| `PATCH /api/trees/:id` with categories | Replace all `tree_categories` rows |
| `POST /api/categories` | Count (100 limit) + insert |

- Keep transactions short. Never call the network (link preview fetch) inside one. Fetch first or afterwards, as in `createNode` above.

```ts
/** ツリー行をロックする。所有者以外・ゴミ箱内は存在を隠して TREE_NOT_FOUND。 */
async function lockOwnedActiveTree(tx: Prisma.TransactionClient, userId: string, treeId: string): Promise<void> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM trees
    WHERE id = ${treeId} AND owner_id = ${userId} AND deleted_at IS NULL
    FOR UPDATE`;
  if (rows.length === 0) throw new AppError("TREE_NOT_FOUND");
}
```
