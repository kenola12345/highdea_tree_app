# Users — Accounts, Authentication, Profile and Settings

Shared types, error codes and authorization rules are defined in [common.md](./common.md). Start from [index.md](./index.md).

## 1. Overview

Sign up, log in, log out and the session check; public profiles; profile and account settings (email, username, password); account deletion. Related: [trees.md](./trees.md) (the Categories tab of Settings P-10 uses the category APIs), [explore.md](./explore.md) (public profile trees use the same public-tree rules).

## 2. Functional Requirements

### 3.1 Accounts & Authentication

Sign up, log in, log out, and knowing who's logged in.

- Sign up with email, username, display name and password. Email and username are unique, including against deactivated accounts. Usernames are 3–30 characters (`a-z 0-9 _`), lowercased; `admin`, `explore` and `settings` are reserved.
- Passwords are 8–72 characters (72 is bcrypt's limit), with no other strength rules.
- Log in with **email only**. Wrong email, wrong password and deactivated account all give the same error, so registered emails aren't revealed.
- Logged-in users can't sign up or log in again; they must log out first.
- A login lasts **7 days** (JWT in an httpOnly cookie). Logout clears the cookie; a copied token stays valid until it expires.
- Rate limits: more than 5 signups per IP in 15 minutes, or more than 5 **failed** logins per IP in 15 minutes, are refused (`429`).
- **Pages/modals:** P-02, P-03, AppHeader (log out). **API:** `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`. **Tables:** `users`.

### 3.2 Profile & Account Settings

- Public profile: username, display name, avatar (an external image URL in v1), join date, and the user's public trees.
- Change display name and avatar URL.
- Change email and/or username, and change password. Each needs the current password. A changed username releases the old one right away; old profile links show Not Found.
- Delete account (deactivation): needs the password. The user is logged out; their profile and public trees disappear; email and username stay taken; no reactivation in v1.
- More than 5 wrong passwords per user in 15 minutes across these actions are refused (`429`).
- **Pages/modals:** P-08, P-10 (Profile and Account tabs), M-11. **API:** `GET /api/users/:username`, `PATCH /api/users/me`, `PATCH /api/users/me/account`, `PATCH /api/users/me/password`, `POST /api/users/me/deactivate`. **Tables:** `users`.

## 3. Authorization

Shared rules (owner, `404` instead of `403`, what "public tree" means): see [common.md — Authorization Rules](./common.md#authorization-rules). Endpoint-specific conditions are in each cell.

| Endpoint | Guest | `USER` | `ADMIN` |
|---|---|---|---|
| `POST /api/auth/signup` | ✅ | ❌ (`403`, must log out first) | ❌ (`403`) |
| `POST /api/auth/login` | ✅ | ❌ (`403`, must log out first) | ❌ (`403`) |
| `POST /api/auth/logout` | ✅ | ✅ | ✅ |
| `GET /api/auth/me` | ❌ (`401` = guest) | ✅ | ✅ |
| `GET /api/users/:username` | ✅ (public data only) | ✅ (public data only) | ✅ (public data only) |
| `PATCH /api/users/me` | ❌ | ✅ own account | ✅ own account |
| `PATCH /api/users/me/account` | ❌ | ✅ own account, current password | ✅ own account, current password |
| `PATCH /api/users/me/password` | ❌ | ✅ own account, current password | ✅ own account, current password |
| `POST /api/users/me/deactivate` | ❌ | ✅ own account, password | ✅ own account, password |

## 4. Screens

### Pages

| ID | Screen | URL | Summary | Access |
|---|---|---|---|---|
| P-02 | Sign up | `/signup` | Email, username, display name, password. On success, logged in and sent to `/me`. Field errors shown under each field (`details`) | Not logged in |
| P-03 | Log in | `/login` | Email and password. On success, sent to `?next=` or `/me` | Not logged in |
| P-10 | Settings | `/settings` | Three tabs: **Profile** (display name, avatar URL), **Account** (change email and username, change password, each with the current password; "Delete account" button) and **Categories** (list with color, tree count, create, edit, delete) | `USER`, `ADMIN` |

### Modals

| ID | Modal | Trigger | Main functions |
|---|---|---|---|
| M-11 | Delete Account | "Delete account" button on the Settings Account tab (P-10) | Explains what happens (profile and public trees disappear, email and username stay taken, no undo), asks for the password, then deletes the account (`POST /api/users/me/deactivate`) and goes to the Landing page (P-01) as a guest |

## 5. API

#### Auth

---
##### **POST /api/auth/signup**

- **Summary（機能概要）:** Creates a new user account, then logs the user in by setting the auth cookie.
- **Authorization（認可）:** Guest only (not logged in). A logged-in user must log out before creating another account; a request with a valid auth cookie is rejected with `403`.

**Request（リクエスト）**

- **Body**

| Name | Type | Required | Description |
|---|---|---|---|
| `email` | `String` | ✅ | Login email. Trimmed and lowercased before saving. Valid email format, max 255 characters |
| `username` | `String` | ✅ | Public handle used in `/u/:username`. Lowercased before saving. 3–30 characters, only `a-z 0-9 _` |
| `displayName` | `String` | ✅ | Name shown on the profile and trees. Trimmed. 1–50 characters |
| `password` | `String` | ✅ | 8–72 characters (72 is bcrypt's input limit). No other strength rules |

**Response（レスポンス）**

- **Success: `201 Created`**
  Follows the common format `{ "data": {...} }`. `data.user` contains `id`, `email`, `username`, `displayName`, `avatarUrl` (`null`), `role` (`"USER"`) and `createdAt`. `passwordHash` is never included.
  Also sets the auth cookie: `access_token` (JWT), `HttpOnly`, `Secure` in production, `SameSite=Lax`, `Path=/`, `Max-Age` 7 days. The JWT also expires after 7 days (`exp`), after which the user must log in again.
- **Error Responses**
  Follows the common format `{ "error": { "code", "message" } }`.
  - `400` `VALIDATION_ERROR` — A field is missing or breaks the rules above (email format, username characters or length, displayName length, password length). `details` lists each invalid field.
  - `400` `USERNAME_RESERVED` — The username is reserved: `admin`, `explore`, `settings`.
  - `403` `ALREADY_AUTHENTICATED` — The request already has a valid auth cookie.
  - `409` `EMAIL_TAKEN` — The email is already registered, including by a deactivated account.
  - `409` `USERNAME_TAKEN` — The username is already in use, including by a deactivated account.
  - `429` `RATE_LIMITED` — More than 5 signup attempts from the same IP within 15 minutes.
  - `500` `INTERNAL_ERROR` — Unexpected server error.
---

---
##### **POST /api/auth/login**

- **Summary（機能概要）:** Logs a user in with email and password and sets the auth cookie.
- **Authorization（認可）:** Guest only (not logged in). To switch accounts, a user must log out first; a request with a valid auth cookie is rejected with `403`.

**Request（リクエスト）**

- **Body**

| Name | Type | Required | Description |
|---|---|---|---|
| `email` | `String` | ✅ | Login email. Trimmed and lowercased before lookup. Login is by email only (not username) |
| `password` | `String` | ✅ | 1–72 characters. Compared with the stored bcrypt hash |

**Response（レスポンス）**

- **Success: `200 OK`**
  Follows the common format `{ "data": {...} }`. `data.user` contains `id`, `email`, `username`, `displayName`, `avatarUrl`, `role` and `createdAt`. `passwordHash` is never included.
  Also sets the auth cookie, with the same settings as signup: `access_token` (JWT), `HttpOnly`, `Secure` in production, `SameSite=Lax`, `Path=/`, `Max-Age` 7 days, JWT `exp` 7 days.
- **Error Responses**
  Follows the common format `{ "error": { "code", "message" } }`.
  - `400` `VALIDATION_ERROR` — `email` or `password` is missing, or breaks the length and format rules.
  - `401` `INVALID_CREDENTIALS` — The email isn't registered, the password is wrong, or the account is deactivated (`deletedAt` set). All three return the same code and message, so the response doesn't reveal which emails are registered.
  - `403` `ALREADY_AUTHENTICATED` — The request already has a valid auth cookie.
  - `429` `RATE_LIMITED` — More than 5 failed login attempts from the same IP within 15 minutes. Successful logins don't count.
  - `500` `INTERNAL_ERROR` — Unexpected server error.
---

---
##### **POST /api/auth/logout**

- **Summary（機能概要）:** Logs the user out by clearing the auth cookie in this browser.
- **Authorization（認可）:** Anyone. It works without a valid cookie too, so a browser with an expired or broken cookie can still clear it. Logout is stateless: the server keeps no session, so a copied token stays valid until its 7-day `exp`.

**Request（リクエスト）**

No parameters and no body.

**Response（レスポンス）**

- **Success: `200 OK`**
  Follows the common format: `{ "data": null }`.
  Clears the `access_token` cookie (`Max-Age=0`, with the same `Path`, `HttpOnly`, `Secure` and `SameSite` settings it was set with, so the browser actually removes it).
- **Error Responses**
  Follows the common format `{ "error": { "code", "message" } }`.
  - `500` `INTERNAL_ERROR` — Unexpected server error.
---

---
##### **GET /api/auth/me**

- **Summary（機能概要）:** Returns the logged-in user. The frontend calls it when the app loads to know whether someone is logged in, and who.
- **Authorization（認可）:** Logged-in users (`USER`, `ADMIN`) with a valid auth cookie.

**Request（リクエスト）**

No parameters and no body. The user is identified by the `access_token` cookie.

**Response（レスポンス）**

- **Success: `200 OK`**
  Follows the common format `{ "data": {...} }`. `data.user` contains `id`, `email`, `username`, `displayName`, `avatarUrl`, `role` and `createdAt`. `passwordHash` is never included. The frontend uses `role` to show admin-only controls.
- **Error Responses**
  Follows the common format `{ "error": { "code", "message" } }`.
  - `401` `UNAUTHENTICATED` — No cookie, or the token is invalid or expired (older than 7 days). For a guest this is the normal answer, and the frontend treats it as "logged out" rather than as an error.
  - `401` `UNAUTHENTICATED` — The token is valid but the user no longer exists or is deactivated (`deletedAt` set). The response also clears the `access_token` cookie.
  - `500` `INTERNAL_ERROR` — Unexpected server error.
---

#### Users

---
##### **GET /api/users/:username**

- **Summary（機能概要）:** Returns a user's public profile and a page of their public trees. Used by the User Profile screen (`/u/:username`).
- **Authorization（認可）:** Anyone (Guest, `USER`, `ADMIN`). Only public information is returned, even when the user views their own profile or an admin views it.

**Request（リクエスト）**

- **Path Parameters**

| Name | Type | Description |
|---|---|---|
| `username` | `String` | The user's handle. Lowercased before lookup |

- **Query Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `page` | `Int` | | Page number, starting at 1. Default `1` |
| `limit` | `Int` | | Trees per page, 1–50. Default `20` |

**Response（レスポンス）**

- **Success: `200 OK`**
  Follows the common format `{ "data": {...} }`.
  - `data.user`: `id`, `username`, `displayName`, `avatarUrl`, `createdAt`. `email`, `role` and `passwordHash` are never included.
  - `data.trees`: the user's trees where `visibility` is `PUBLIC` and neither `removedAt` nor `deletedAt` is set, newest `updatedAt` first. Each item has `id`, `title`, `description`, `categories` (`id`, `name`, `color`), `nodeCount` and `updatedAt`.
  - `data.pagination`: `page`, `limit`, `total`. This is the shared paging shape for every list (My Trees, Trash, Explore); the frontend computes the page count as `ceil(total / limit)`.
- **Error Responses**
  Follows the common format `{ "error": { "code", "message" } }`.
  - `400` `VALIDATION_ERROR` — `page` or `limit` isn't a positive integer, or `limit` is over 50.
  - `404` `USER_NOT_FOUND` — No user has this username, or the user is deactivated (`deletedAt` set).
  - `500` `INTERNAL_ERROR` — Unexpected server error.
---

---
##### **PATCH /api/users/me**

- **Summary（機能概要）:** Updates the logged-in user's own profile. Used by the Settings screen.
- **Authorization（認可）:** Logged-in users (`USER`, `ADMIN`), on their own account only. The account is taken from the auth cookie, never from the request.

**Request（リクエスト）**

- **Body**
  Send only the fields to change; at least one is required. Any other field (e.g. `role`, `email`, `username`, `password`) is rejected, so users can't change their own role. Email and username are changed with `PATCH /api/users/me/account`, the password with `PATCH /api/users/me/password`.

| Name | Type | Required | Description |
|---|---|---|---|
| `displayName` | `String` | | Trimmed. 1–50 characters |
| `avatarUrl` | `String \| null` | | An `http` or `https` image URL, or `null` to remove the avatar. Avatar upload is a future extension |

**Response（レスポンス）**

- **Success: `200 OK`**
  Follows the common format `{ "data": {...} }`. `data.user` is the updated user, with the same fields as `GET /api/auth/me`: `id`, `email`, `username`, `displayName`, `avatarUrl`, `role`, `createdAt`. `passwordHash` is never included.
- **Error Responses**
  Follows the common format `{ "error": { "code", "message" } }`.
  - `400` `VALIDATION_ERROR` — The body is empty, has a field that isn't allowed, or breaks a rule above (displayName length, avatarUrl not an http/https URL).
  - `401` `UNAUTHENTICATED` — No valid auth cookie, or the user is deactivated (`deletedAt` set).
  - `500` `INTERNAL_ERROR` — Unexpected server error.
---

---
##### **PATCH /api/users/me/account**

- **Summary（機能概要）:** Changes the logged-in user's email (used to log in) and/or username (the public handle in `/u/:username`). Used by the Settings Account tab.
- **Authorization（認可）:** Logged-in users (`USER`, `ADMIN`), on their own account only, and only with their current password.

**Request（リクエスト）**

- **Body**
  At least one of `email` and `username` is required.

| Name | Type | Required | Description |
|---|---|---|---|
| `email` | `String` | | New login email. Same rules as signup: trimmed, lowercased, valid format, max 255 characters |
| `username` | `String` | | New username. Same rules as signup: lowercased, 3–30 characters, only `a-z 0-9 _`, not reserved (`admin`, `explore`, `settings`) |
| `currentPassword` | `String` | ✅ | The user's current password, 1–72 characters |

**Processing（処理）**

- The old username is released right away and isn't redirected: old `/u/:username` links show Not Found, and another user may take the old name.
- No confirmation email is sent for a new email address (the app sends no email in v1).

**Response（レスポンス）**

- **Success: `200 OK`**
  Follows the common format `{ "data": {...} }`. `data.user`: `id`, `email`, `username`, `displayName`, `avatarUrl`, `role`, `createdAt`.
- **Error Responses**
  Follows the common format `{ "error": { "code", "message", "details"? } }`.
  - `400` `VALIDATION_ERROR` — Neither `email` nor `username` was sent, `currentPassword` is missing, or a field breaks the rules above. `details` lists each invalid field.
  - `400` `USERNAME_RESERVED` — The new username is reserved: `admin`, `explore`, `settings`.
  - `401` `UNAUTHENTICATED` — No valid auth cookie, or the user is deactivated (`deletedAt` set).
  - `403` `WRONG_PASSWORD` — `currentPassword` is wrong. (Not `401`, because the frontend treats `401` as "logged out".)
  - `409` `EMAIL_TAKEN` — Another account, including a deactivated one, uses this email.
  - `409` `USERNAME_TAKEN` — Another account, including a deactivated one, uses this username.
  - `429` `RATE_LIMITED` — More than 5 wrong passwords for this user within 15 minutes (counted together with the password and delete-account endpoints).
  - `500` `INTERNAL_ERROR` — Unexpected server error.
---

---
##### **PATCH /api/users/me/password**

- **Summary（機能概要）:** Changes the logged-in user's password. Used by the Settings Account tab.
- **Authorization（認可）:** Logged-in users (`USER`, `ADMIN`), on their own account only, and only with their current password.

**Request（リクエスト）**

- **Body**

| Name | Type | Required | Description |
|---|---|---|---|
| `currentPassword` | `String` | ✅ | The current password, 1–72 characters |
| `newPassword` | `String` | ✅ | 8–72 characters, same rule as signup. Must be different from `currentPassword` |

**Processing（処理）**

- The new password is hashed with bcrypt and replaces `password_hash`. The user stays logged in on this browser. Login tokens on other devices stay valid until their 7-day expiry, because tokens can't be revoked.

**Response（レスポンス）**

- **Success: `200 OK`**
  Follows the common format: `{ "data": null }`.
- **Error Responses**
  Follows the common format `{ "error": { "code", "message", "details"? } }`.
  - `400` `VALIDATION_ERROR` — A field is missing, `newPassword` isn't 8–72 characters, or it's the same as `currentPassword`. `details` lists each invalid field.
  - `401` `UNAUTHENTICATED` — No valid auth cookie, or the user is deactivated (`deletedAt` set).
  - `403` `WRONG_PASSWORD` — `currentPassword` is wrong.
  - `429` `RATE_LIMITED` — More than 5 wrong passwords for this user within 15 minutes (shared with the account and delete-account endpoints).
  - `500` `INTERNAL_ERROR` — Unexpected server error.
---

---
##### **POST /api/users/me/deactivate**

- **Summary（機能概要）:** Deletes the logged-in user's account. It's a deactivation: `deletedAt` is set, the user is logged out, and their profile and public trees disappear for everyone. Used by the "Delete account" button in the Settings Account tab, after a confirmation.
- **Authorization（認可）:** Logged-in users (`USER`, `ADMIN`), on their own account only, and only with their password.

**Request（リクエスト）**

- **Body**

| Name | Type | Required | Description |
|---|---|---|---|
| `password` | `String` | ✅ | The user's current password, 1–72 characters |

**Processing（処理）**

- Sets `users.deleted_at`. Trees, nodes, categories and uploads are kept in the database but hidden from everyone (see the deletion policy in §5). The email and username stay taken. There's no reactivation in v1.
- Clears the `access_token` cookie, the same way as logout. Any other token for this user stops working at once, because the auth middleware rejects deactivated users on every request.

**Response（レスポンス）**

- **Success: `200 OK`**
  Follows the common format: `{ "data": null }`.
- **Error Responses**
  Follows the common format `{ "error": { "code", "message", "details"? } }`.
  - `400` `VALIDATION_ERROR` — `password` is missing or longer than 72 characters.
  - `401` `UNAUTHENTICATED` — No valid auth cookie, or the user is already deactivated.
  - `403` `WRONG_PASSWORD` — `password` is wrong.
  - `429` `RATE_LIMITED` — More than 5 wrong passwords for this user within 15 minutes (shared with the account and password endpoints).
  - `500` `INTERNAL_ERROR` — Unexpected server error.
---

## 6. Data

Full Prisma schema, ER diagram and deletion policy: [common.md — Data Modeling](./common.md#5-data-modelingデータモデリング).

#### users（ユーザー）

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PK, DEFAULT cuid() | User ID |
| email | VARCHAR(255) | NOT NULL, UNIQUE | Login email, stored in lowercase |
| username | VARCHAR(30) | NOT NULL, UNIQUE | Public handle used in `/u/:username`. Allowed characters: `a-z 0-9 _` |
| display_name | VARCHAR(50) | NOT NULL | Name shown on the profile and on trees |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt hash |
| avatar_url | TEXT | NULL | Profile image URL (an external `http`/`https` link in v1; avatar upload is a future extension) |
| role | UserRole | NOT NULL, DEFAULT 'USER' | `USER` / `ADMIN` |
| created_at | TIMESTAMPTZ(3) | NOT NULL, DEFAULT now() | Created at |
| updated_at | TIMESTAMPTZ(3) | NOT NULL | Updated at (set by Prisma `@updatedAt`) |
| deleted_at | TIMESTAMPTZ(3) | NULL | Set when the account is deactivated |

**Business rules and constraints**
- Email and username are unique. Enforced in the **DB** (UNIQUE) and the **app layer** (AuthService lowercases the email and checks the username format before saving).
- `password_hash` is never included in an API response. Enforced in the **app layer**: services always use an explicit `select` without it.
- A deactivated user (`deleted_at` set) can't log in, and their profile and public trees are hidden. Enforced in the **app layer** (AuthService, UserService, ExploreService filter on `deleted_at IS NULL`).
- Only `ADMIN` users can call `/api/admin/*`. Enforced in the **app layer** (role-check middleware).
- Users can't change their own `role` through any endpoint. Enforced in the **app layer** (no Zod schema accepts `role`).
- Changing email, username or password, and deleting the account, all require the current password. Enforced in the **app layer** (UserService compares it with `password_hash`; more than 5 wrong passwords per user in 15 minutes → `429`).
- When a user changes their username, the old one is released right away: it isn't reserved or redirected, so old `/u/:username` links show Not Found, and another user may take the old name. Enforced in the **app layer** (UserService).
- Deleting an account sets `deleted_at` (deactivation). The user is logged out, their profile and public trees disappear, and their email and username stay taken. Enforced in the **app layer** (UserService).
