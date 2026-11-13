---
paths: "backend/{prisma/**/*,prisma.config.ts,src/services/**/*,src/lib/prisma.ts,src/jobs/**/*,scripts/**/*}"
---

# Database Standards（ORM/データベース規約）

## トリガー（いつ参照するか）
- When changing `schema.prisma` or creating a migration
- When writing or changing Prisma queries in services, jobs or scripts
- When a change needs a transaction (check-then-write, several rows, the node and category limits)
- When filtering soft-deleted, removed or deactivated data
- When setting up or using the PrismaClient

## 目的（何のために）
- To keep the schema identical to the manifest (naming, types, `onDelete`)
- To avoid N+1 queries, unbounded lists, leaked password hashes and soft-delete leaks
- To keep business-rule limits safe under simultaneous requests

## 参照ファイル
Read `standards/database.md`. A schema change goes into `manifests/common.md` §5.4 and the `## Prisma Schema` section of `CLAUDE.md` too.
