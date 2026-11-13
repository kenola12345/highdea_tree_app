import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { prisma, resetDb } from "./helpers/db.js";
import {
  createAdmin,
  createCategory,
  createLoggedInUser,
  createTree,
  createUser,
  TEST_PASSWORD,
} from "./helpers/factories.js";

const app = createApp();

/** Set-Cookie から access_token の行を取り出す */
function authSetCookie(res: request.Response): string | undefined {
  const raw = res.headers["set-cookie"] as string[] | string | undefined;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.find((c) => c.startsWith("access_token="));
}

/** レスポンスの details からフィールド名だけを取り出す */
function detailFields(res: request.Response): string[] {
  return (res.body.error.details as { field: string }[]).map((d) => d.field).sort();
}

/** レスポンスのツリー一覧からIDだけを取り出す */
function treeIds(res: request.Response): string[] {
  return (res.body.data.trees as { id: string }[]).map((t) => t.id);
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/users/:username", () => {
  it("returns the public profile and only public trees, without email or role", async () => {
    const owner = await createUser({ username: "alice", displayName: "Alice" });
    const admin = await createUser({ role: "ADMIN" });
    const category = await createCategory(owner.id, "Work", "#FF0000");
    const visible = await createTree(owner.id, {
      title: "Public",
      visibility: "PUBLIC",
      categoryIds: [category.id],
    });
    await createTree(owner.id, { title: "Private" });
    await createTree(owner.id, { title: "Removed", removed: { byId: admin.id } });
    await createTree(owner.id, { title: "Trash", visibility: "PUBLIC", deletedAt: new Date() });

    const res = await request(app).get("/api/users/alice");

    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual({
      id: owner.id,
      username: "alice",
      displayName: "Alice",
      avatarUrl: null,
      createdAt: owner.createdAt.toISOString(),
    });
    expect(res.body.data.trees).toEqual([
      {
        id: visible.id,
        title: "Public",
        description: null,
        categories: [{ id: category.id, name: "Work", color: "#FF0000" }],
        nodeCount: 1,
        updatedAt: expect.any(String),
      },
    ]);
    expect(res.body.data.pagination).toEqual({ page: 1, limit: 20, total: 1 });
    const text = JSON.stringify(res.body);
    expect(text).not.toContain("email");
    expect(text).not.toContain("role");
    expect(text).not.toContain("password");
  });

  it("returns only public data even to the owner and to an admin", async () => {
    const { user, cookie } = await createLoggedInUser({ username: "bob" });
    await createTree(user.id, { title: "Mine only" });
    const { cookie: adminCookie } = await createAdmin();

    for (const c of [cookie, adminCookie]) {
      const res = await request(app).get("/api/users/bob").set("Cookie", c);
      expect(res.status).toBe(200);
      expect(res.body.data.trees).toEqual([]);
      expect(res.body.data.user).not.toHaveProperty("email");
    }
  });

  it("finds the user with an uppercase username", async () => {
    await createUser({ username: "carol" });

    const res = await request(app).get("/api/users/CaRoL");

    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe("carol");
  });

  it("returns 404 USER_NOT_FOUND for an unknown user", async () => {
    const res = await request(app).get("/api/users/nobody");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("USER_NOT_FOUND");
  });

  it("returns 404 USER_NOT_FOUND for a deactivated user", async () => {
    const user = await createUser({ username: "gone", deactivated: true });
    await createTree(user.id, { visibility: "PUBLIC" });

    const res = await request(app).get("/api/users/gone");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("USER_NOT_FOUND");
  });

  it("pages trees newest updatedAt first", async () => {
    const user = await createUser({ username: "dave" });
    const trees = [];
    for (let i = 0; i < 3; i++) {
      const tree = await createTree(user.id, { visibility: "PUBLIC" });
      await prisma.tree.update({
        where: { id: tree.id },
        data: { updatedAt: new Date(Date.UTC(2026, 0, i + 1)) },
      });
      trees.push(tree);
    }

    const first = await request(app).get("/api/users/dave?page=1&limit=2");
    const second = await request(app).get("/api/users/dave?page=2&limit=2");

    expect(first.status).toBe(200);
    expect(treeIds(first)).toEqual([trees[2]?.id, trees[1]?.id]);
    expect(first.body.data.pagination).toEqual({ page: 1, limit: 2, total: 3 });
    expect(treeIds(second)).toEqual([trees[0]?.id]);
  });

  it("returns 400 VALIDATION_ERROR for a bad page or limit", async () => {
    await createUser({ username: "erin" });

    for (const query of ["page=0", "limit=51", "page=abc"]) {
      const res = await request(app).get(`/api/users/erin?${query}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });
});

describe("PATCH /api/users/me", () => {
  it("updates displayName and avatarUrl and returns the user", async () => {
    const { user, cookie } = await createLoggedInUser();

    const res = await request(app)
      .patch("/api/users/me")
      .set("Cookie", cookie)
      .send({ displayName: "  New Name ", avatarUrl: "https://example.com/a.png" });

    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual({
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: "New Name",
      avatarUrl: "https://example.com/a.png",
      role: "USER",
      createdAt: user.createdAt.toISOString(),
    });
    expect(JSON.stringify(res.body)).not.toContain("password");
  });

  it("removes the avatar with null and leaves other fields unchanged", async () => {
    const { user, cookie } = await createLoggedInUser({ displayName: "Keep" });
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: "https://example.com/a.png" },
    });

    const res = await request(app).patch("/api/users/me").set("Cookie", cookie).send({
      avatarUrl: null,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.user.avatarUrl).toBeNull();
    expect(res.body.data.user.displayName).toBe("Keep");
  });

  it("returns 400 for an empty body, an unknown field or a bad value", async () => {
    const { user, cookie } = await createLoggedInUser();

    const bodies = [
      {},
      { role: "ADMIN" },
      { displayName: "x", role: "ADMIN" },
      { displayName: "   " },
      { avatarUrl: "javascript:alert(1)" },
      { avatarUrl: "ftp://example.com/a.png" },
    ];
    for (const body of bodies) {
      const res = await request(app).patch("/api/users/me").set("Cookie", cookie).send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(saved.role).toBe("USER");
  });

  it("returns 401 for a guest", async () => {
    const res = await request(app).patch("/api/users/me").send({ displayName: "x" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("PATCH /api/users/me/account", () => {
  it("changes the email (normalized) and the user can log in with it", async () => {
    const { cookie } = await createLoggedInUser();

    const res = await request(app)
      .patch("/api/users/me/account")
      .set("Cookie", cookie)
      .send({ email: "  New@Example.com ", currentPassword: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe("new@example.com");
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "new@example.com", password: TEST_PASSWORD });
    expect(login.status).toBe(200);
  });

  it("changes the username and releases the old one at once", async () => {
    const { cookie } = await createLoggedInUser({ username: "oldname" });

    const res = await request(app)
      .patch("/api/users/me/account")
      .set("Cookie", cookie)
      .send({ username: "NewName", currentPassword: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe("newname");
    expect((await request(app).get("/api/users/oldname")).status).toBe(404);
    expect((await request(app).get("/api/users/newname")).status).toBe(200);

    const { cookie: otherCookie } = await createLoggedInUser();
    const taken = await request(app)
      .patch("/api/users/me/account")
      .set("Cookie", otherCookie)
      .send({ username: "oldname", currentPassword: TEST_PASSWORD });
    expect(taken.status).toBe(200);
    expect(taken.body.data.user.username).toBe("oldname");
  });

  it("allows sending the user's own current username", async () => {
    const { cookie } = await createLoggedInUser({ username: "same" });

    const res = await request(app)
      .patch("/api/users/me/account")
      .set("Cookie", cookie)
      .send({ username: "same", currentPassword: TEST_PASSWORD });

    expect(res.status).toBe(200);
  });

  it("returns 403 WRONG_PASSWORD and changes nothing", async () => {
    const { user, cookie } = await createLoggedInUser();

    const res = await request(app)
      .patch("/api/users/me/account")
      .set("Cookie", cookie)
      .send({ email: "new@example.com", currentPassword: "wrong password" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("WRONG_PASSWORD");
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(saved.email).toBe(user.email);
  });

  it("returns 400 USERNAME_RESERVED for a reserved username", async () => {
    const { cookie } = await createLoggedInUser();

    const res = await request(app)
      .patch("/api/users/me/account")
      .set("Cookie", cookie)
      .send({ username: "Settings", currentPassword: TEST_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("USERNAME_RESERVED");
  });

  it("returns 409 EMAIL_TAKEN, including for a deactivated account's email", async () => {
    await createUser({ email: "active@example.com" });
    await createUser({ email: "gone@example.com", deactivated: true });
    const { cookie } = await createLoggedInUser();

    for (const email of ["active@example.com", "GONE@example.com"]) {
      const res = await request(app)
        .patch("/api/users/me/account")
        .set("Cookie", cookie)
        .send({ email, currentPassword: TEST_PASSWORD });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("EMAIL_TAKEN");
    }
  });

  it("returns 409 USERNAME_TAKEN, including for a deactivated account's username", async () => {
    await createUser({ username: "active" });
    await createUser({ username: "gone", deactivated: true });
    const { cookie } = await createLoggedInUser();

    for (const username of ["active", "gone"]) {
      const res = await request(app)
        .patch("/api/users/me/account")
        .set("Cookie", cookie)
        .send({ username, currentPassword: TEST_PASSWORD });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("USERNAME_TAKEN");
    }
  });

  it("returns 400 VALIDATION_ERROR with details for bad input", async () => {
    const { cookie } = await createLoggedInUser();

    const none = await request(app)
      .patch("/api/users/me/account")
      .set("Cookie", cookie)
      .send({ currentPassword: TEST_PASSWORD });
    expect(none.status).toBe(400);
    expect(none.body.error.code).toBe("VALIDATION_ERROR");

    const bad = await request(app)
      .patch("/api/users/me/account")
      .set("Cookie", cookie)
      .send({ email: "nope", username: "a!" });
    expect(bad.status).toBe(400);
    expect(detailFields(bad)).toEqual(["currentPassword", "email", "username"]);
  });

  it("returns 401 for a guest", async () => {
    const res = await request(app)
      .patch("/api/users/me/account")
      .send({ email: "x@example.com", currentPassword: TEST_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("PATCH /api/users/me/password", () => {
  it("changes the password; the user stays logged in and can log in with the new one", async () => {
    const { user, cookie } = await createLoggedInUser();

    const res = await request(app)
      .patch("/api/users/me/password")
      .set("Cookie", cookie)
      .send({ currentPassword: TEST_PASSWORD, newPassword: "brand new password" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: null });
    expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(200);
    const oldLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: TEST_PASSWORD });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "brand new password" });
    expect(newLogin.status).toBe(200);
  });

  it("returns 400 when the new password is the same as the current one", async () => {
    const { cookie } = await createLoggedInUser();

    const res = await request(app)
      .patch("/api/users/me/password")
      .set("Cookie", cookie)
      .send({ currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(detailFields(res)).toEqual(["newPassword"]);
  });

  it("returns 400 when the new password is too short or fields are missing", async () => {
    const { cookie } = await createLoggedInUser();

    const short = await request(app)
      .patch("/api/users/me/password")
      .set("Cookie", cookie)
      .send({ currentPassword: TEST_PASSWORD, newPassword: "short" });
    expect(short.status).toBe(400);
    expect(detailFields(short)).toEqual(["newPassword"]);

    const missing = await request(app)
      .patch("/api/users/me/password")
      .set("Cookie", cookie)
      .send({});
    expect(missing.status).toBe(400);
    expect(detailFields(missing)).toEqual(["currentPassword", "newPassword"]);
  });

  it("returns 403 WRONG_PASSWORD", async () => {
    const { cookie } = await createLoggedInUser();

    const res = await request(app)
      .patch("/api/users/me/password")
      .set("Cookie", cookie)
      .send({ currentPassword: "wrong password", newPassword: "brand new password" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("WRONG_PASSWORD");
  });

  it("returns 401 for a guest", async () => {
    const res = await request(app)
      .patch("/api/users/me/password")
      .send({ currentPassword: TEST_PASSWORD, newPassword: "brand new password" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("POST /api/users/me/deactivate", () => {
  it("deactivates the account, clears the cookie and hides the profile", async () => {
    const { user, cookie } = await createLoggedInUser({ username: "leaving" });
    await createTree(user.id, { visibility: "PUBLIC" });

    const res = await request(app)
      .post("/api/users/me/deactivate")
      .set("Cookie", cookie)
      .send({ password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: null });
    expect(authSetCookie(res)).toMatch(/access_token=;/);
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(saved.deletedAt).not.toBeNull();
    expect(await prisma.tree.count({ where: { ownerId: user.id } })).toBe(1);

    // 古いトークンは使えない
    expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(401);
    // ログインもできない
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: TEST_PASSWORD });
    expect(login.status).toBe(401);
    expect(login.body.error.code).toBe("INVALID_CREDENTIALS");
    // プロフィールは見えない
    expect((await request(app).get("/api/users/leaving")).status).toBe(404);
    // メール・ユーザー名は確保されたまま
    const signup = await request(app).post("/api/auth/signup").send({
      email: user.email,
      username: "someone_else",
      displayName: "X",
      password: "password123",
    });
    expect(signup.status).toBe(409);
    expect(signup.body.error.code).toBe("EMAIL_TAKEN");
    const signup2 = await request(app).post("/api/auth/signup").send({
      email: "fresh@example.com",
      username: "leaving",
      displayName: "X",
      password: "password123",
    });
    expect(signup2.status).toBe(409);
    expect(signup2.body.error.code).toBe("USERNAME_TAKEN");
  });

  it("returns 403 WRONG_PASSWORD and keeps the account active", async () => {
    const { user, cookie } = await createLoggedInUser();

    const res = await request(app)
      .post("/api/users/me/deactivate")
      .set("Cookie", cookie)
      .send({ password: "wrong password" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("WRONG_PASSWORD");
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(saved.deletedAt).toBeNull();
  });

  it("returns 400 VALIDATION_ERROR when the password is missing or too long", async () => {
    const { cookie } = await createLoggedInUser();

    for (const body of [{}, { password: "x".repeat(73) }]) {
      const res = await request(app)
        .post("/api/users/me/deactivate")
        .set("Cookie", cookie)
        .send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("returns 401 for a guest", async () => {
    const res = await request(app)
      .post("/api/users/me/deactivate")
      .send({ password: TEST_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("wrong-password rate limit", () => {
  it("returns 429 RATE_LIMITED on the 6th wrong password across the three endpoints", async () => {
    const { cookie } = await createLoggedInUser();
    const wrong = "wrong password";
    const wrongAccount = () =>
      request(app)
        .patch("/api/users/me/account")
        .set("Cookie", cookie)
        .send({ email: "x@example.com", currentPassword: wrong });
    const wrongPassword = () =>
      request(app)
        .patch("/api/users/me/password")
        .set("Cookie", cookie)
        .send({ currentPassword: wrong, newPassword: "brand new password" });
    const wrongDeactivate = () =>
      request(app).post("/api/users/me/deactivate").set("Cookie", cookie).send({ password: wrong });

    // 正しいパスワードでの成功や 400 は数えない
    const ok = await request(app)
      .patch("/api/users/me/account")
      .set("Cookie", cookie)
      .send({ email: "ok@example.com", currentPassword: TEST_PASSWORD });
    expect(ok.status).toBe(200);
    const invalid = await request(app)
      .patch("/api/users/me/password")
      .set("Cookie", cookie)
      .send({});
    expect(invalid.status).toBe(400);

    for (const attempt of [
      wrongAccount,
      wrongPassword,
      wrongDeactivate,
      wrongAccount,
      wrongPassword,
    ]) {
      expect((await attempt()).status).toBe(403);
    }

    const sixth = await wrongDeactivate();
    expect(sixth.status).toBe(429);
    expect(sixth.body.error.code).toBe("RATE_LIMITED");
  });

  it("counts wrong passwords per user, not across users", async () => {
    const { cookie } = await createLoggedInUser();
    const { cookie: otherCookie } = await createLoggedInUser();

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/users/me/deactivate")
        .set("Cookie", cookie)
        .send({ password: "wrong password" });
    }
    const other = await request(app)
      .post("/api/users/me/deactivate")
      .set("Cookie", otherCookie)
      .send({ password: "wrong password" });

    expect(other.status).toBe(403);
  });
});
