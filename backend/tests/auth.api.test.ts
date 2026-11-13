import { Router } from "express";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { requireAuth } from "../src/middleware/auth.js";
import { requireAdmin } from "../src/middleware/requireAdmin.js";
import { prisma, resetDb } from "./helpers/db.js";
import {
  authCookie,
  createAdmin,
  createLoggedInUser,
  createUser,
  TEST_PASSWORD,
} from "./helpers/factories.js";

// requireAdmin の確認用ルート（本番には登録しない）
const adminOnly = Router();
adminOnly.get("/__test/admin-only", requireAuth, requireAdmin, (_req, res) => {
  res.status(200).json({ data: { ok: true } });
});
const app = createApp({ extraRouters: [adminOnly] });

const validSignup = {
  email: "  Alice@Example.com ",
  username: "Alice_01",
  displayName: "  Alice  ",
  password: "password123",
};

/** Set-Cookie から access_token の行を取り出す */
function authSetCookie(res: request.Response): string | undefined {
  const raw = res.headers["set-cookie"] as string[] | string | undefined;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.find((c) => c.startsWith("access_token="));
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /api/auth/signup", () => {
  it("creates the user, normalizes fields and sets the auth cookie", async () => {
    const res = await request(app).post("/api/auth/signup").send(validSignup);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      data: {
        user: {
          id: expect.any(String),
          email: "alice@example.com",
          username: "alice_01",
          displayName: "Alice",
          avatarUrl: null,
          role: "USER",
          createdAt: expect.any(String),
        },
      },
    });
    const cookie = authSetCookie(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=604800/);
    expect(JSON.stringify(res.body)).not.toContain("password");
  });

  it("returns 400 VALIDATION_ERROR with details for every invalid field", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "not-an-email", username: "a!", displayName: "", password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    const fields = (res.body.error.details as { field: string }[]).map((d) => d.field).sort();
    expect(fields).toEqual(["displayName", "email", "password", "username"]);
  });

  it("returns 400 when the password is longer than 72 characters", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ ...validSignup, password: "x".repeat(73) });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: "password", message: expect.any(String) }]);
  });

  it("returns 400 USERNAME_RESERVED for a reserved username, ignoring case", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ ...validSignup, username: "Explore" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("USERNAME_RESERVED");
  });

  it("returns 409 EMAIL_TAKEN even when the account is deactivated", async () => {
    await createUser({ email: "alice@example.com", deactivated: true });

    const res = await request(app).post("/api/auth/signup").send(validSignup);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("returns 409 USERNAME_TAKEN even when the account is deactivated", async () => {
    await createUser({ username: "alice_01", deactivated: true });

    const res = await request(app).post("/api/auth/signup").send(validSignup);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("USERNAME_TAKEN");
  });

  it("returns 403 ALREADY_AUTHENTICATED for a logged-in user", async () => {
    const { cookie } = await createLoggedInUser();

    const res = await request(app).post("/api/auth/signup").set("Cookie", cookie).send(validSignup);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ALREADY_AUTHENTICATED");
  });

  it("returns 429 RATE_LIMITED on the 6th attempt from the same IP within 15 minutes", async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post("/api/auth/signup").send({});
    }

    const res = await request(app).post("/api/auth/signup").send(validSignup);

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
  });
});

describe("POST /api/auth/login", () => {
  it("logs in by email (trimmed, any case) and sets the auth cookie", async () => {
    const user = await createUser({ email: "bob@example.com" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: " BOB@example.com", password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({
      id: user.id,
      email: "bob@example.com",
      role: "USER",
    });
    expect(authSetCookie(res)).toMatch(/HttpOnly/i);
  });

  it.each([
    ["a wrong password", { email: "bob@example.com", password: "wrong password" }],
    ["an unknown email", { email: "nobody@example.com", password: TEST_PASSWORD }],
  ])("returns the same 401 INVALID_CREDENTIALS for %s", async (_label, body) => {
    await createUser({ email: "bob@example.com" });

    const res = await request(app).post("/api/auth/login").send(body);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect" },
    });
  });

  it("returns 401 INVALID_CREDENTIALS for a deactivated account with the right password", async () => {
    await createUser({ email: "gone@example.com", deactivated: true });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "gone@example.com", password: TEST_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns 400 VALIDATION_ERROR when fields are missing", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "bob@example.com" });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: "password", message: expect.any(String) }]);
  });

  it("returns 403 ALREADY_AUTHENTICATED for a logged-in user", async () => {
    const { cookie } = await createLoggedInUser();

    const res = await request(app)
      .post("/api/auth/login")
      .set("Cookie", cookie)
      .send({ email: "x@example.com", password: "x" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ALREADY_AUTHENTICATED");
  });

  it("returns 429 after 5 failed attempts, but successful logins don't count", async () => {
    await createUser({ email: "bob@example.com" });
    const good = { email: "bob@example.com", password: TEST_PASSWORD };
    const bad = { email: "bob@example.com", password: "wrong password" };
    for (let i = 0; i < 3; i++) await request(app).post("/api/auth/login").send(good);
    for (let i = 0; i < 5; i++) await request(app).post("/api/auth/login").send(bad);

    const res = await request(app).post("/api/auth/login").send(good);

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the cookie for a logged-in user", async () => {
    const { cookie } = await createLoggedInUser();

    const res = await request(app).post("/api/auth/logout").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: null });
    expect(authSetCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it("works without a valid cookie too", async () => {
    const res = await request(app).post("/api/auth/logout").set("Cookie", "access_token=broken");

    expect(res.status).toBe(200);
    expect(authSetCookie(res)).toMatch(/HttpOnly/i);
  });
});

describe("GET /api/auth/me", () => {
  it("returns the logged-in user without the password hash", async () => {
    const { user, cookie } = await createLoggedInUser({ username: "carol" });

    const res = await request(app).get("/api/auth/me").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual({
      id: user.id,
      email: user.email,
      username: "carol",
      displayName: user.displayName,
      avatarUrl: null,
      role: "USER",
      createdAt: user.createdAt.toISOString(),
    });
  });

  it.each([
    ["no cookie", undefined],
    ["a broken token", "access_token=not-a-jwt"],
  ])("returns 401 UNAUTHENTICATED with %s", async (_label, cookie) => {
    const req = request(app).get("/api/auth/me");
    const res = await (cookie ? req.set("Cookie", cookie) : req);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
    expect(authSetCookie(res)).toBeUndefined();
  });

  it("returns 401 and clears the cookie for a deactivated user", async () => {
    const user = await createUser({ deactivated: true });

    const res = await request(app).get("/api/auth/me").set("Cookie", authCookie(user.id));

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
    expect(authSetCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});

describe("requireAdmin", () => {
  it("returns 403 FORBIDDEN for a USER and 200 for an ADMIN", async () => {
    const { cookie: userCookie } = await createLoggedInUser();
    const { cookie: adminCookie } = await createAdmin();

    const asUser = await request(app).get("/api/__test/admin-only").set("Cookie", userCookie);
    const asAdmin = await request(app).get("/api/__test/admin-only").set("Cookie", adminCookie);

    expect(asUser.status).toBe(403);
    expect(asUser.body.error.code).toBe("FORBIDDEN");
    expect(asAdmin.status).toBe(200);
  });

  it("applies a role change on the next request with the same token", async () => {
    const { user, cookie } = await createAdmin();
    await prisma.user.update({ where: { id: user.id }, data: { role: "USER" } });

    const res = await request(app).get("/api/__test/admin-only").set("Cookie", cookie);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 401 for a guest", async () => {
    const res = await request(app).get("/api/__test/admin-only");

    expect(res.status).toBe(401);
  });
});
