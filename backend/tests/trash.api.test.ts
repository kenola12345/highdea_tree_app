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
} from "./helpers/factories.js";

const app = createApp();
const DAY_MS = 24 * 60 * 60 * 1000;

/** 今から days 日前の日時 */
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/trash", () => {
  it("lists the user's deleted trees, most recently deleted first, with purgeAt", async () => {
    const { user, cookie } = await createLoggedInUser();
    const other = await createUser();
    const category = await createCategory(user.id, "Work");
    const deletedAt = daysAgo(3);
    const older = await createTree(user.id, { deletedAt: daysAgo(5) });
    const newer = await createTree(user.id, {
      title: "Recent",
      visibility: "PUBLIC",
      deletedAt,
      categoryIds: [category.id],
    });
    await createTree(user.id);
    await createTree(other.id, { deletedAt: daysAgo(1) });

    const res = await request(app).get("/api/trash").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect((res.body.data.trees as { id: string }[]).map((t) => t.id)).toEqual([
      newer.id,
      older.id,
    ]);
    expect(res.body.data.pagination).toEqual({ page: 1, limit: 20, total: 2 });
    expect(res.body.data.trees[0]).toEqual({
      id: newer.id,
      title: "Recent",
      description: null,
      visibility: "PUBLIC",
      categories: [{ id: category.id, name: "Work", color: "#6B7280" }],
      nodeCount: 1,
      removedAt: null,
      deletedAt: deletedAt.toISOString(),
      purgeAt: new Date(deletedAt.getTime() + 10 * DAY_MS).toISOString(),
    });
  });

  it("leaves out trees past the 10-day retention that the job hasn't purged yet", async () => {
    const { user, cookie } = await createLoggedInUser();
    await createTree(user.id, { deletedAt: daysAgo(11) });

    const res = await request(app).get("/api/trash").set("Cookie", cookie);

    expect(res.body.data.trees).toEqual([]);
    expect(res.body.data.pagination.total).toBe(0);
  });

  it("doesn't show other users' Trash to an admin", async () => {
    const other = await createUser();
    await createTree(other.id, { deletedAt: daysAgo(1) });
    const { cookie } = await createAdmin();

    const res = await request(app).get("/api/trash").set("Cookie", cookie);

    expect(res.body.data.trees).toEqual([]);
  });

  it("pages the results", async () => {
    const { user, cookie } = await createLoggedInUser();
    for (let i = 1; i <= 3; i++) await createTree(user.id, { deletedAt: daysAgo(i) });

    const res = await request(app).get("/api/trash?page=2&limit=2").set("Cookie", cookie);

    expect(res.body.data.trees).toHaveLength(1);
    expect(res.body.data.pagination).toEqual({ page: 2, limit: 2, total: 3 });
  });

  it("returns 400 VALIDATION_ERROR for a bad limit", async () => {
    const { cookie } = await createLoggedInUser();

    const res = await request(app).get("/api/trash?limit=51").set("Cookie", cookie);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual([{ field: "limit", message: expect.any(String) }]);
  });

  it("returns 401 UNAUTHENTICATED for a guest", async () => {
    const res = await request(app).get("/api/trash");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("POST /api/trees/:id/restore", () => {
  it("restores the tree with its visibility, categories and nodes (200)", async () => {
    const { user, cookie } = await createLoggedInUser();
    const category = await createCategory(user.id, "Work");
    const tree = await createTree(user.id, {
      title: "Back again",
      visibility: "PUBLIC",
      deletedAt: daysAgo(2),
      categoryIds: [category.id],
    });

    const res = await request(app).post(`/api/trees/${tree.id}/restore`).set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.tree).toEqual({
      id: tree.id,
      title: "Back again",
      description: null,
      visibility: "PUBLIC",
      categories: [{ id: category.id, name: "Work", color: "#6B7280" }],
      nodeCount: 1,
      removedAt: null,
      removalReason: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    const list = await request(app).get("/api/trees").set("Cookie", cookie);
    expect((list.body.data.trees as { id: string }[]).map((t) => t.id)).toEqual([tree.id]);
  });

  it("keeps a removed tree removed and private", async () => {
    const { user, cookie } = await createLoggedInUser();
    const admin = await createUser({ role: "ADMIN" });
    const tree = await createTree(user.id, {
      removed: { byId: admin.id, reason: "Spam" },
      deletedAt: daysAgo(1),
    });

    const res = await request(app).post(`/api/trees/${tree.id}/restore`).set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.tree.visibility).toBe("PRIVATE");
    expect(res.body.data.tree.removedAt).toEqual(expect.any(String));
    expect(res.body.data.tree.removalReason).toBe("Spam");
  });

  it("returns 409 TREE_NOT_IN_TRASH for a tree that isn't deleted", async () => {
    const { user, cookie } = await createLoggedInUser();
    const tree = await createTree(user.id);

    const res = await request(app).post(`/api/trees/${tree.id}/restore`).set("Cookie", cookie);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "TREE_NOT_IN_TRASH", message: expect.any(String) } });
  });

  it("returns 404 TREE_NOT_FOUND for another user's tree, also for an admin", async () => {
    const owner = await createUser();
    const tree = await createTree(owner.id, { deletedAt: daysAgo(1) });
    const { cookie } = await createLoggedInUser();
    const { cookie: adminCookie } = await createAdmin();

    const userRes = await request(app).post(`/api/trees/${tree.id}/restore`).set("Cookie", cookie);
    const adminRes = await request(app)
      .post(`/api/trees/${tree.id}/restore`)
      .set("Cookie", adminCookie);

    for (const res of [userRes, adminRes]) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("TREE_NOT_FOUND");
    }
    const stored = await prisma.tree.findUniqueOrThrow({ where: { id: tree.id } });
    expect(stored.deletedAt).not.toBeNull();
  });

  it("returns 404 TREE_NOT_FOUND for a missing or expired tree", async () => {
    const { user, cookie } = await createLoggedInUser();
    const expired = await createTree(user.id, { deletedAt: daysAgo(11) });

    const missing = await request(app).post("/api/trees/nope/restore").set("Cookie", cookie);
    const expiredRes = await request(app)
      .post(`/api/trees/${expired.id}/restore`)
      .set("Cookie", cookie);

    for (const res of [missing, expiredRes]) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("TREE_NOT_FOUND");
    }
  });

  it("returns 401 UNAUTHENTICATED for a guest", async () => {
    const owner = await createUser();
    const tree = await createTree(owner.id, { deletedAt: daysAgo(1) });

    const res = await request(app).post(`/api/trees/${tree.id}/restore`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("DELETE /api/trash/:id", () => {
  it("deletes a tree in the Trash permanently, with its nodes and category tags (200)", async () => {
    const { user, cookie } = await createLoggedInUser();
    const category = await createCategory(user.id, "Work");
    const tree = await createTree(user.id, { deletedAt: daysAgo(2), categoryIds: [category.id] });

    const res = await request(app).delete(`/api/trash/${tree.id}`).set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: null });
    expect(await prisma.tree.findUnique({ where: { id: tree.id } })).toBeNull();
    expect(await prisma.node.count({ where: { treeId: tree.id } })).toBe(0);
    expect(await prisma.treeCategory.count({ where: { treeId: tree.id } })).toBe(0);
    expect(await prisma.category.count({ where: { id: category.id } })).toBe(1);
  });

  it("returns 409 TREE_NOT_IN_TRASH for a tree that isn't deleted, and keeps it", async () => {
    const { user, cookie } = await createLoggedInUser();
    const tree = await createTree(user.id);

    const res = await request(app).delete(`/api/trash/${tree.id}`).set("Cookie", cookie);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "TREE_NOT_IN_TRASH", message: expect.any(String) } });
    expect(await prisma.tree.findUnique({ where: { id: tree.id } })).not.toBeNull();
  });

  it("returns 404 TREE_NOT_FOUND for another user's tree, also for an admin", async () => {
    const owner = await createUser();
    const tree = await createTree(owner.id, { deletedAt: daysAgo(1) });
    const { cookie } = await createLoggedInUser();
    const { cookie: adminCookie } = await createAdmin();

    const userRes = await request(app).delete(`/api/trash/${tree.id}`).set("Cookie", cookie);
    const adminRes = await request(app).delete(`/api/trash/${tree.id}`).set("Cookie", adminCookie);

    for (const res of [userRes, adminRes]) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("TREE_NOT_FOUND");
    }
    expect(await prisma.tree.findUnique({ where: { id: tree.id } })).not.toBeNull();
  });

  it("returns 404 TREE_NOT_FOUND for a missing or expired tree", async () => {
    const { user, cookie } = await createLoggedInUser();
    const expired = await createTree(user.id, { deletedAt: daysAgo(11) });

    const missing = await request(app).delete("/api/trash/nope").set("Cookie", cookie);
    const expiredRes = await request(app).delete(`/api/trash/${expired.id}`).set("Cookie", cookie);

    for (const res of [missing, expiredRes]) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("TREE_NOT_FOUND");
    }
  });

  it("returns 401 UNAUTHENTICATED for a guest", async () => {
    const owner = await createUser();
    const tree = await createTree(owner.id, { deletedAt: daysAgo(1) });

    const res = await request(app).delete(`/api/trash/${tree.id}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("DELETE /api/trash", () => {
  it("deletes every tree in the user's Trash and returns the count (200)", async () => {
    const { user, cookie } = await createLoggedInUser();
    const other = await createUser();
    const a = await createTree(user.id, { deletedAt: daysAgo(1) });
    const b = await createTree(user.id, { deletedAt: daysAgo(4) });
    const live = await createTree(user.id);
    const othersTrashed = await createTree(other.id, { deletedAt: daysAgo(1) });

    const res = await request(app).delete("/api/trash").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { deletedCount: 2 } });
    const remaining = await prisma.tree.findMany({ select: { id: true } });
    expect(remaining.map((t) => t.id).sort()).toEqual([live.id, othersTrashed.id].sort());
    expect(await prisma.node.count({ where: { treeId: { in: [a.id, b.id] } } })).toBe(0);
  });

  it("returns deletedCount 0 when the Trash is already empty", async () => {
    const { cookie } = await createLoggedInUser();

    const res = await request(app).delete("/api/trash").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { deletedCount: 0 } });
  });

  it("returns 401 UNAUTHENTICATED for a guest", async () => {
    const res = await request(app).delete("/api/trash");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});
