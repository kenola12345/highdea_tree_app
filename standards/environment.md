# Coding Standards — 8. Environment Variables（環境変数管理）

Part of the coding standards. Start from [index.md](./index.md). Section numbers (§N) refer to the files listed there.

### 8.1 Files

| File | Committed | Contents |
|---|---|---|
| `backend/.env.example` | ✅ | Every variable with a safe example value |
| `backend/.env` | ❌ (gitignored) | Real local values |
| `backend/.env.test` | ❌ (gitignored) | Test database URL and test secret |
| `frontend/.env*` | — | Not needed in v1 *(manifest)* |

`.gitignore` must contain `.env`, `.env.*` and `!.env.example`. **Never commit `.env` files or secrets** *(CLAUDE.md)*.

`backend/.env.example` (variables from manifest §9.3):

```bash
# PostgreSQL 接続先（docker compose の値）
DATABASE_URL=postgresql://highdea:highdea@localhost:5432/highdea
# ログイン用 JWT の署名鍵。32文字以上のランダム値（例: openssl rand -hex 32）
JWT_SECRET=change-me-to-at-least-32-random-characters
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
UPLOAD_DIR=./uploads
```

### 8.2 Naming and Loading

- `UPPER_SNAKE_CASE`. Backend code reads variables **only** through `config/env.ts`, which validates them with Zod at startup and exits with a clear message if one is missing. Nowhere else reads `process.env`.
- New variables are added to the manifest's §9.3 table, `.env.example` and `config/env.ts` in the same change.

❌ Bad
```ts
const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET || "secret");
```

✅ Good
```ts
// backend/src/config/env.ts
const envSchema = z.object({
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CORS_ORIGIN: z.url(),
  UPLOAD_DIR: z.string().default("./uploads"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:", z.treeifyError(parsed.error));
  process.exit(1);
}
/** 検証済みの環境変数。アプリ内で process.env を直接読まない */
export const env = parsed.data;
```

### 8.3 Frontend

- The frontend has no variables in v1; it calls `/api` on its own origin. If one is ever added, it must be a non-secret value with the `VITE_` prefix. Anything with a `VITE_` prefix ends up in the browser bundle, so a secret must never get that prefix.
