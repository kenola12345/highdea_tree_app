# Coding Standards — 1. General Language Rules（全般的な言語規約）

Part of the coding standards. Start from [index.md](./index.md). Section numbers (§N) refer to the files listed there.

### 1.1 Compiler and Linter Settings

TypeScript 6.0 everywhere, `strict: true` *(manifest)*. All packages are ES modules (`"type": "module"`).

`tsconfig.base.json` (repo root). Each workspace extends it:

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "lib": ["ES2024"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "useUnknownInCatchVariables": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  }
}
```

`backend/tsconfig.json`:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "types": ["node"],
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["src", "prisma", "scripts", "tests", "prisma.config.ts"]
}
```

`frontend/tsconfig.json`:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2024", "DOM", "DOM.Iterable"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "types": ["vite/client"],
    "noEmit": true
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

`shared/tsconfig.json` uses the backend settings (`nodenext`), so both sides can import it. `shared/` is imported by its package name, `@highdea/shared`. Don't use relative paths across workspaces.

ESLint (flat config) at the repo root, `eslint.config.js`:

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "backend/uploads/**", "**/playwright-report/**"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      // Express のエラーハンドラーは引数4つが必須など、使わない引数を _ で明示できるようにする
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always"],
    },
  },
  {
    // テストでは Supertest のレスポンス本文（any）をそのまま検証するため、any 由来の警告だけ外す
    files: ["**/tests/**/*.{ts,tsx}", "**/*.test.{ts,tsx}", "**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
    },
  },
  {
    files: ["frontend/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  prettier,
);
```

Prettier, `.prettierrc.json`:

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

- `npm run lint` and `npm run typecheck` must pass before every push. Never commit `// @ts-ignore`. If a suppression is truly needed, use `// @ts-expect-error` with a reason.

### 1.2 Type Rules

- No `any` *(CLAUDE.md)*. Use `unknown` and narrow it.
- API request and response shapes are **defined once** in `shared/` (§2, §3.5) and imported by both sides. Don't redefine them locally.
- Request types are inferred from the Zod schemas (`z.infer`). Don't write a request interface by hand.
- Use string-literal unions or the Prisma enums (`UserRole`, `TreeVisibility`, `NodeType`). Don't use TypeScript `enum`.
- Exported functions declare their return type.
- Use `type` for object shapes and unions. Use `interface` only when declaration merging is needed (e.g. extending Express `Request`).

❌ Bad: a hand-written type that can drift from the validator.
```ts
// frontend/src/api/nodes.ts
interface CreateNodeBody {
  type: string; // any string is accepted
  title: string;
  url?: any;
}
```

✅ Good: inferred from the shared Zod schema, so both sides agree.
```ts
// shared/src/schemas/nodes.ts
export const createNodeSchema = z.discriminatedUnion("type", [textNode, linkNode, videoNode, imageNode]);
export type CreateNodeBody = z.infer<typeof createNodeSchema>;

// frontend/src/api/nodes.ts
import type { CreateNodeBody } from "@highdea/shared";
```

❌ Bad: casting away the problem.
```ts
const node = data as any;
console.log(node.previewTitle.length);
```

✅ Good: narrow `unknown` and handle `null`.
```ts
function previewLabel(node: NodeDetails): string {
  return node.previewTitle ?? node.title;
}
```

### 1.3 Naming

| Target | Rule | Example |
|---|---|---|
| Variables, functions | `camelCase`; functions start with a verb | `nodeCount`, `moveToTrash()` |
| Booleans | `is` / `has` / `can` prefix | `isOwner`, `hasChildren`, `canAddNode` |
| Types, React components, classes | `PascalCase` | `TreeResponse`, `NodeCard`, `AppError` |
| Constants (module-level, fixed values) | `UPPER_SNAKE_CASE` | `MAX_NODES_PER_TREE = 2000`, `TRASH_RETENTION_DAYS = 10` |
| Zod schemas | `camelCase` + `Schema` | `createTreeSchema`, `updateNodeSchema` |
| Error codes | `UPPER_SNAKE_CASE`, from `shared/src/errors.ts` | `NODE_LIMIT_REACHED` |
| JSON fields | `camelCase` *(manifest)* | `positionX`, `removedAt` |
| DB tables / columns | plural `snake_case` via `@@map` / `@map` *(manifest)* | `tree_categories.category_id` |
| React component files | `PascalCase.tsx`, one component per file | `features/canvas/NodeCard.tsx` |
| Hook files | `useXxx.ts` | `features/auth/useMe.ts` |
| Other TS files | `camelCase.ts` | `lib/ssrfGuard.ts`, `jobs/purgeTrash.ts` |
| Backend layer files | `<resource>.<layer>.ts`, resource names as in the manifest | `routes/trees.routes.ts`, `controllers/trees.controller.ts`, `services/tree.service.ts` |
| CLI scripts | `kebab-case.ts` *(manifest)* | `scripts/make-admin.ts` |
| Directories | `camelCase` (lowercase in practice) | `features/canvas/`, `middleware/` |
| Tests | same name as the target + `.test.ts(x)`; E2E `.spec.ts` | `tree.service.test.ts`, `editor.spec.ts` |

- Business limits are named constants in `shared/src/constants.ts` and imported by both sides. Don't write `2000`, `10`, `100` or `5 * 1024 * 1024` inline.

```ts
// shared/src/constants.ts
export const MAX_NODES_PER_TREE = 2000;
export const MAX_CATEGORIES_PER_USER = 100;
export const TRASH_RETENTION_DAYS = 10;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const NODE_TITLE_MAX = 200;
export const NODE_BODY_MAX = 10_000;
export const RESERVED_USERNAMES = ["admin", "explore", "settings"] as const;
```

❌ Bad
```ts
if (count >= 2000) throw new Error("full");
```

✅ Good
```ts
if (count >= MAX_NODES_PER_TREE) throw new AppError("NODE_LIMIT_REACHED");
```

### 1.4 Import Order

Enforced by `simple-import-sort`. Groups, separated by a blank line:

1. Node built-ins (`node:crypto`, `node:path`). Always use the `node:` prefix.
2. External packages (`express`, `react`, `@tanstack/react-query`)
3. Workspace packages (`@highdea/shared`)
4. Relative imports (`../services/tree.service.js`, `./NodeCard`)

Type-only imports use `import type`. In the backend (`nodenext`), relative imports end in `.js`.

```ts
import { randomUUID } from "node:crypto";

import type { Request, Response } from "express";

import { createTreeSchema } from "@highdea/shared";

import { treeService } from "../services/tree.service.js";
```

### 1.5 Comments

- Write code comments in **Japanese**. Identifiers and log messages are in English.
- Each exported function or class gets a one-line summary at the top. Add a WHY comment where a business rule is the reason for the code. Don't write comments that repeat what the code says.

```ts
/** ツリーをゴミ箱へ移動する（論理削除）。10日後に日次ジョブで完全削除される。 */
export async function moveToTrash(userId: string, treeId: string): Promise<void> {
  // 他人のツリーは存在を隠すため 403 ではなく 404 を返す（共通認可ルール）
  ...
}
```
