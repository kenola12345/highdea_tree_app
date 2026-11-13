# Coding Standards — 9. Security（セキュリティガイドライン）

Part of the coding standards. Start from [index.md](./index.md). Section numbers (§N) refer to the files listed there.

### 9.1 Authentication (JWT in an httpOnly Cookie)

- The JWT is in the `access_token` cookie: `httpOnly`, `SameSite=Lax`, `Secure` when `NODE_ENV=production`, 7 days *(manifest)*. Never put the token in `localStorage`, the response body or a URL.
- The token payload is `sub` and `exp` only, signed with HS256 using `JWT_SECRET`. The auth middleware loads the user from the DB on every request; a missing or deactivated user gets `401 UNAUTHENTICATED`. `role` always comes from the DB, never from the token *(manifest)*.
- `jwt.verify` is called with `algorithms: ["HS256"]`.

```ts
// backend/src/lib/jwt.ts
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
} as const;

export function setAuthCookie(res: Response, userId: string): void {
  const token = jwt.sign({}, env.JWT_SECRET, { subject: userId, expiresIn: "7d", algorithm: "HS256" });
  res.cookie("access_token", token, COOKIE_OPTIONS);
}
```

❌ Bad: trusts the role inside the token, so a demoted admin keeps admin rights for 7 days.
```ts
const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string; role: string };
if (payload.role === "ADMIN") next();
```

✅ Good
```ts
const { sub } = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] }) as JwtPayload;
const user = await prisma.user.findUnique({ where: { id: sub }, select: { id: true, role: true, deletedAt: true } });
if (!user || user.deletedAt) throw new AppError("UNAUTHENTICATED");
req.user = { id: user.id, role: user.role };
```

### 9.2 Passwords

- Hash with `bcrypt` at cost 12. Passwords are 8–72 characters *(manifest)*.
- Login returns the same `401 INVALID_CREDENTIALS` whether the email or the password is wrong, so it doesn't reveal which accounts exist.
- Account changes need the current password: wrong → `403 WRONG_PASSWORD`; more than 5 wrong tries per user in 15 minutes → `429` *(manifest)*.

### 9.3 Authorization on Every Endpoint

- Every non-public route has `requireAuth`; admin routes also have `requireAdmin`.
- Ownership is checked in the service, inside the query (`where: { id, ownerId: userId }`). The resource ID from the URL is never trusted on its own (IDOR).
- Anything the caller may not see returns `404` *(manifest)*. Private trees are visible only to their owner, **not even to admins**. Admins can only remove public trees *(CLAUDE.md)*.
- Trees in the Trash can't be edited; removed trees can still be edited by their owner but can't be made public again *(manifest)*.

❌ Bad: loads by ID, then forgets the owner check (any user can edit any node).
```ts
const node = await prisma.node.update({ where: { id: nodeId }, data });
```

✅ Good
```ts
const node = await tx.node.findFirst({
  where: { id: nodeId, tree: { ownerId: userId, deletedAt: null } },
  select: { id: true, treeId: true, parentId: true, type: true },
});
if (!node) throw new AppError("NODE_NOT_FOUND");
```

### 9.4 Input Validation and Injection

- All input goes through Zod strict schemas (§3.5). Server-only fields (`role`, `nameKey`, `preview*`, `removedAt`, `ownerId`) are never accepted from clients.
- SQL: Prisma queries or `$queryRaw` tagged templates only (§4.4).
- **SSRF:** link preview fetches go through `lib/ssrfGuard.ts`: `http`/`https` only, resolve DNS and refuse private, loopback and link-local addresses, re-check after every redirect, 5-second timeout, response size limit *(manifest)*.
- **Uploads:** Multer memory storage with a 5 MB limit; the real type is detected with `file-type` from the first bytes (PNG, JPEG, WebP, GIF only, never SVG); the storage file name is `crypto.randomUUID()` + extension, never the client's file name *(manifest)*.
- Rate limits with `express-rate-limit`: signup, login (5 failed / 15 min / IP), link preview (30 / user / min), uploads (60 / user / hour), password checks *(manifest)*.

### 9.5 XSS

- React escapes text by default. **`dangerouslySetInnerHTML` is not allowed.** Node notes are shown as plain text (`whitespace-pre-wrap`).
- Link `href` values are rendered only after checking the protocol is `http:` or `https:`, with `rel="noopener noreferrer"` and `target="_blank"`.
- Video embeds are built from a parsed YouTube or Vimeo video ID into a fixed embed URL (`lib/videoEmbed.ts`). Never use a user URL as an iframe `src`.

❌ Bad
```tsx
<div dangerouslySetInnerHTML={{ __html: node.body ?? "" }} />
<iframe src={node.url} />
```

✅ Good
```tsx
<p className="whitespace-pre-wrap break-words">{node.body}</p>
{embed && <iframe src={embed.src} title={node.title} allow="encrypted-media; picture-in-picture" allowFullScreen />}
```

```ts
// frontend/src/lib/videoEmbed.ts
/** YouTube / Vimeo の URL から動画IDを取り出し、固定の埋め込みURLを返す。それ以外は null。 */
export function toEmbed(url: string): { src: string } | null {
  const u = safeUrl(url);
  if (!u) return null;
  const yt = u.hostname.endsWith("youtube.com") ? u.searchParams.get("v") : u.hostname === "youtu.be" ? u.pathname.slice(1) : null;
  if (yt && /^[\w-]{11}$/.test(yt)) return { src: `https://www.youtube-nocookie.com/embed/${yt}` };
  const vimeo = u.hostname.endsWith("vimeo.com") ? u.pathname.match(/^\/(\d+)/)?.[1] : null;
  if (vimeo) return { src: `https://player.vimeo.com/video/${vimeo}` };
  return null;
}
```

### 9.6 Headers and CORS

- `helmet()` on every response. `cors({ origin: env.CORS_ORIGIN, credentials: true })`. Never use `origin: "*"` with credentials.
- Frontend and API are served from the same origin so the `SameSite=Lax` cookie is sent *(manifest)*. The production hosting setup is still **[To confirm]** in the manifest.

### 9.7 Secrets and Logging

- Secrets live only in `.env` files and the hosting provider's secret store (§8). Never in code, tests, commit messages or logs.
- Don't log passwords, hashes, JWTs, cookies, email addresses or full request bodies. Log the user ID instead of personal data.
- Error responses never include stack traces or Prisma messages (§3.4).
