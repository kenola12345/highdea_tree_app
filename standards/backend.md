# Coding Standards — 3. Backend（バックエンド規約）

Part of the coding standards. Start from [index.md](./index.md). Section numbers (§N) refer to the files listed there.

Node.js 26 LTS, Express 5.3, Zod 4.6, Prisma 7.10.1 with `@prisma/adapter-pg` *(manifest)*.

### 3.1 Directory Structure

Follow manifest §8 exactly:

```
backend/src/
├── server.ts         # starts the HTTP server and the daily jobs
├── app.ts            # Express app: helmet, cors, cookie-parser, routes, error handler
├── config/env.ts     # reads and validates environment variables
├── lib/              # prisma client, jwt, password (bcrypt), ssrfGuard
├── middleware/       # auth (loads user), requireAdmin, validate (Zod), rateLimits, upload (Multer), errorHandler
├── routes/           # auth, users, trees, trash, nodes, categories, explore, uploads, linkPreview, admin
├── controllers/      # one per route file: parse request, call service, shape response
├── services/         # business rules: Auth, User, Tree, Trash, Node, Category, Explore, Upload, LinkPreview, Admin
├── jobs/             # purgeTrash.ts, cleanupUploads.ts (node-cron)
└── errors/           # AppError (code + HTTP status)
```

- `app.ts` builds and exports the app without listening, so Supertest can use it. Only `server.ts` calls `listen()` and starts `jobs/`.

### 3.2 Layered Architecture

```
routes  →  middleware (auth, validate, rate limit)  →  controllers  →  services  →  Prisma (lib/prisma.ts)
```

| Layer | Does | Never does |
|---|---|---|
| `routes/` | Declares path + method + middleware chain + controller | Logic, Prisma calls |
| `middleware/` | Auth (loads the user from the DB), Zod validation, rate limits, Multer, error handling | Business rules |
| `controllers/` | Reads the validated input and `req.user`, calls one service function, sends `{ data }` with the status code | Prisma calls, business rules |
| `services/` | **All business rules** *(CLAUDE.md)*: ownership checks, the 2,000-node limit, Trash rules, cycle checks, transactions. Throws `AppError` | Reading `req` / `res` |
| `lib/prisma.ts` | The one PrismaClient | — |

- There is no separate repository layer: services call Prisma directly. Shared query parts (e.g. the "public tree" filter) live in a service helper, not copied around.

❌ Bad: business rule and Prisma in the route handler.
```ts
router.post("/trees/:id/nodes", async (req, res) => {
  const count = await prisma.node.count({ where: { treeId: req.params.id } });
  if (count >= 2000) return res.status(409).json({ message: "full" });
  const node = await prisma.node.create({ data: req.body }); // unvalidated body, no owner check
  res.json(node);
});
```

✅ Good: thin route and controller, the rule lives in the service.
```ts
// routes/nodes.routes.ts
router.post(
  "/trees/:id/nodes",
  requireAuth,
  validate({ params: idParamSchema, body: createNodeSchema }),
  nodesController.create,
);

// controllers/nodes.controller.ts
export const create: RequestHandler = async (req, res) => {
  const node = await nodeService.createNode(req.user!.id, req.params.id, req.body as CreateNodeBody);
  res.status(201).json({ data: { node } });
};

// services/node.service.ts
/** ノードを追加する。ツリー行をロックしてノード数を数え、2,000件上限を同時リクエストでも超えさせない。 */
export async function createNode(userId: string, treeId: string, body: CreateNodeBody): Promise<NodeResponse> {
  const created = await prisma.$transaction(async (tx) => {
    await lockOwnedActiveTree(tx, userId, treeId); // 見つからない・他人・ゴミ箱 → TREE_NOT_FOUND
    const count = await tx.node.count({ where: { treeId } });
    if (count >= MAX_NODES_PER_TREE) throw new AppError("NODE_LIMIT_REACHED");
    await assertParentInTree(tx, treeId, body.parentId);
    const node = await tx.node.create({ data: toNodeCreateData(treeId, body) });
    await tx.tree.update({ where: { id: treeId }, data: { updatedAt: new Date() } });
    return node;
  });
  return toNodeResponse(await attachLinkPreview(created));
}
```

### 3.3 Routing

- All routes are mounted under `/api` in `app.ts`, one router per resource file in `routes/`.
- Paths match the manifest's endpoint list exactly (`/api/trees/:id/nodes/positions`, `/api/admin/trees/:id/remove`). Don't add or rename endpoints without updating the manifest first.
- The middleware order in a route is always: `requireAuth` / `optionalAuth` → `requireAdmin` (admin routes) → rate limiter → `validate(...)` / `upload` → controller.
- Express 5 passes errors from `async` handlers to the error handler automatically. Don't wrap handlers in `asyncHandler`, and don't use `try/catch` just to call `next(err)`.

### 3.4 Error Handling

- Every expected failure is an `AppError` with a code from `shared/src/errors.ts`. The HTTP status is looked up from the code, so the same code always has the same status (manifest "Error Codes" table).
- One error handler (`middleware/errorHandler.ts`) turns every error into `{ error: { code, message, details? } }`. Unknown errors become `500 INTERNAL_ERROR` with a generic message; the real error is logged on the server only.
- Known Prisma errors are converted in the service where they can happen (e.g. `P2002` on `categories(user_id, name_key)` → `CATEGORY_NAME_TAKEN`). Don't leak Prisma messages to clients.

```ts
// shared/src/errors.ts
export const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  USERNAME_RESERVED: 400,
  URL_NOT_ALLOWED: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  ALREADY_AUTHENTICATED: 403,
  FORBIDDEN: 403,
  WRONG_PASSWORD: 403,
  TREE_NOT_FOUND: 404,
  NODE_NOT_FOUND: 404,
  // ... every code in manifests/common.md "Error Codes"
  NODE_LIMIT_REACHED: 409,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_FILE_TYPE: 415,
  PREVIEW_UNAVAILABLE: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
} as const;
export type ErrorCode = keyof typeof ERROR_STATUS;

// backend/src/errors/AppError.ts
export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string = DEFAULT_MESSAGES[code],
    readonly details?: FieldError[],
  ) {
    super(message);
    this.status = ERROR_STATUS[code];
  }
}
```

```ts
// backend/src/middleware/errorHandler.ts
export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details && { details: err.details }) },
    });
    return;
  }
  logger.error({ err }, "unhandled error");
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
};
```

❌ Bad: ad-hoc shapes and statuses, internal details leaked.
```ts
catch (e) {
  res.status(400).json({ success: false, msg: (e as Error).message });
}
```

✅ Good: throw, and let the handler format it.
```ts
if (tree.deletedAt === null) throw new AppError("TREE_NOT_IN_TRASH");
```

### 3.5 Validation

- Every request input (body, params, query) is validated with Zod in `validate()` before the controller runs *(CLAUDE.md)*. Schemas live in `shared/src/schemas/`.
- Object schemas are `z.strictObject` so unknown fields are rejected. This is what makes "preview fields sent → `400`" and "`nameKey`, `userId` rejected" work *(manifest)*.
- Strings are trimmed in the schema where the manifest says "Trimmed". Usernames are lowercased in the schema.
- Zod errors are mapped to `VALIDATION_ERROR` with `details: [{ field, message }]`, where `field` is the dotted path (e.g. `nodes.3.positionX`).
- Rules that need the DB (ownership, uniqueness, "parent in the same tree") are checked in services, not in schemas.

```ts
// shared/src/schemas/auth.ts
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,30}$/, "3–30 characters: a-z, 0-9 and _");

export const signupSchema = z.strictObject({
  email: z.email().max(255),
  username: usernameSchema,
  displayName: z.string().trim().min(1).max(50),
  password: z.string().min(8).max(72), // bcrypt の入力上限は 72 バイト
});

// backend/src/middleware/validate.ts
export function validate(schemas: { body?: ZodType; params?: ZodType; query?: ZodType }): RequestHandler {
  return (req, _res, next) => {
    for (const key of ["params", "query", "body"] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (!result.success) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Some fields are invalid",
          result.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
        );
      }
      req.validated = { ...req.validated, [key]: result.data };
    }
    next();
  };
}
```

Controllers read `req.validated.body` (typed through a helper), never the raw `req.body`.

❌ Bad: passing the raw body to Prisma (mass assignment: a client could set `role` or `previewTitle`).
```ts
await prisma.user.update({ where: { id: req.user.id }, data: req.body });
```

✅ Good: only fields from the strict schema are written.
```ts
const { displayName, avatarUrl } = req.validated.body as UpdateProfileBody;
await prisma.user.update({ where: { id: userId }, data: { displayName, avatarUrl } });
```

### 3.6 Logging

- Use one logger (`lib/logger.ts`, JSON lines in production). `console.log` is not allowed (ESLint).
- Log the request ID, user ID, method, path, status and duration. Never log passwords, password hashes, JWTs, cookies, or full request bodies (§9).
