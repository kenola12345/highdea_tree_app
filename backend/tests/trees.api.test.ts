import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { prisma, resetDb } from "./helpers/db.js";
import {
  createAdmin,
  createCategory,
  createLoggedInUser,
  createNodes,
  createTree,
  createUser,
} from "./helpers/factories.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/trees", () => {
  it("returns only the user's own non-deleted trees, newest updatedAt first", async () => {
    const { user, cookie } = await createLoggedInUser();
    const other = await createUser();
    const older = await createTree(user.id, { title: "Older" });
    const newer = await createTree(user.id, { title: "Newer", visibility: "PUBLIC" });
    await prisma.tree.update({
      where: { id: older.id },
      data: { updatedAt: new Date("2026-01-01T00:00:00Z") },
    });
    await createTree(user.id, { deletedAt: new Date() });
    await createTree(other.id, { visibility: "PUBLIC" });

    const res = await request(app).get("/api/trees").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect((res.body.data.trees as { id: string }[]).map((t) => t.id)).toEqual([
      newer.id,
      older.id,
    ]);
    expect(res.body.data.pagination).toEqual({ page: 1, limit: 20, total: 2 });
    expect(res.body.data.trees[0]).toEqual({
      id: newer.id,
      title: "Newer",
      description: null,
      visibility: "PUBLIC",
      categories: [],
      nodeCount: 1,
      removedAt: null,
      removalReason: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it("lists removed trees with the removal reason for the owner", async () => {
    const { user, cookie } = await createLoggedInUser();
    const admin = await createUser({ role: "ADMIN" });
    await createTree(user.id, { removed: { byId: admin.id, reason: "Spam links" } });

    const res = await request(app).get("/api/trees").set("Cookie", cookie);

    expect(res.body.data.trees[0].removedAt).toEqual(expect.any(String));
    expect(res.body.data.trees[0].removalReason).toBe("Spam links");
  });

  it("filters by one of the user's categories", async () => {
    const { user, cookie } = await createLoggedInUser();
    const work = await createCategory(user.id, "Work", "#FF8800");
    const tagged = await createTree(user.id, { categoryIds: [work.id] });
    await createTree(user.id);

    const res = await request(app).get(`/api/trees?categoryId=${work.id}`).set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.trees).toHaveLength(1);
    expect(res.body.data.trees[0].id).toBe(tagged.id);
    expect(res.body.data.trees[0].categories).toEqual([
      { id: work.id, name: "Work", color: "#FF8800" },
    ]);
    expect(res.body.data.pagination.total).toBe(1);
  });

  it("returns 404 CATEGORY_NOT_FOUND for another user's or a missing category", async () => {
    const { cookie } = await createLoggedInUser();
    const other = await createUser();
    const foreign = await createCategory(other.id);

    const foreignRes = await request(app)
      .get(`/api/trees?categoryId=${foreign.id}`)
      .set("Cookie", cookie);
    const missingRes = await request(app).get("/api/trees?categoryId=nope").set("Cookie", cookie);

    for (const res of [foreignRes, missingRes]) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        error: { code: "CATEGORY_NOT_FOUND", message: expect.any(String) },
      });
    }
  });

  it("pages the results", async () => {
    const { user, cookie } = await createLoggedInUser();
    for (let i = 0; i < 3; i++) await createTree(user.id);

    const res = await request(app).get("/api/trees?page=2&limit=2").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.trees).toHaveLength(1);
    expect(res.body.data.pagination).toEqual({ page: 2, limit: 2, total: 3 });
  });

  it("returns 400 VALIDATION_ERROR for a bad page or limit", async () => {
    const { cookie } = await createLoggedInUser();

    const res = await request(app).get("/api/trees?page=0&limit=51").set("Cookie", cookie);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    const fields = (res.body.error.details as { field: string }[]).map((d) => d.field).sort();
    expect(fields).toEqual(["limit", "page"]);
  });

  it("returns only the admin's own trees to an admin", async () => {
    const { user: admin, cookie } = await createAdmin();
    const other = await createUser();
    await createTree(other.id, { visibility: "PUBLIC" });
    const own = await createTree(admin.id);

    const res = await request(app).get("/api/trees").set("Cookie", cookie);

    expect((res.body.data.trees as { id: string }[]).map((t) => t.id)).toEqual([own.id]);
  });

  it("returns 401 UNAUTHENTICATED for a guest", async () => {
    const res = await request(app).get("/api/trees");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("POST /api/trees", () => {
  it("creates the tree, its root node and the category tags (201)", async () => {
    const { user, cookie } = await createLoggedInUser();
    const a = await createCategory(user.id, "Alpha");
    const b = await createCategory(user.id, "Beta");

    const res = await request(app)
      .post("/api/trees")
      .set("Cookie", cookie)
      .send({
        title: "  Startup ideas  ",
        description: " Things to try ",
        visibility: "PUBLIC",
        categoryIds: [b.id, a.id, b.id],
        rootTitle: " My startup ",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.tree).toEqual({
      id: expect.any(String),
      title: "Startup ideas",
      description: "Things to try",
      visibility: "PUBLIC",
      categories: [
        { id: a.id, name: "Alpha", color: "#6B7280" },
        { id: b.id, name: "Beta", color: "#6B7280" },
      ],
      removedAt: null,
      removalReason: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(res.body.data.rootNode).toEqual({
      id: expect.any(String),
      treeId: res.body.data.tree.id,
      parentId: null,
      type: "TEXT",
      title: "My startup",
      body: null,
      positionX: 0,
      positionY: 0,
      sortOrder: 0,
      lineColor: null,
      cardColor: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    const stored = await prisma.tree.findUniqueOrThrow({
      where: { id: res.body.data.tree.id },
      include: { nodes: true },
    });
    expect(stored.ownerId).toBe(user.id);
    expect(stored.nodes).toHaveLength(1);
  });

  it("defaults visibility to PRIVATE and the root title to the tree title", async () => {
    const { cookie } = await createLoggedInUser();

    const res = await request(app)
      .post("/api/trees")
      .set("Cookie", cookie)
      .send({ title: "Ideas" });

    expect(res.status).toBe(201);
    expect(res.body.data.tree.visibility).toBe("PRIVATE");
    expect(res.body.data.tree.description).toBeNull();
    expect(res.body.data.rootNode.title).toBe("Ideas");
  });

  it("returns 400 VALIDATION_ERROR when the title is missing or a rule is broken", async () => {
    const { cookie } = await createLoggedInUser();

    const res = await request(app)
      .post("/api/trees")
      .set("Cookie", cookie)
      .send({
        description: "x".repeat(501),
        visibility: "SECRET",
        categoryIds: Array.from({ length: 11 }, (_, i) => `c${String(i)}`),
        rootTitle: "x".repeat(201),
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    const fields = (res.body.error.details as { field: string }[]).map((d) => d.field).sort();
    expect(fields).toEqual(["categoryIds", "description", "rootTitle", "title", "visibility"]);
  });

  it("returns 400 VALIDATION_ERROR for a title over 100 characters or a field not allowed", async () => {
    const { cookie } = await createLoggedInUser();

    const longTitle = await request(app)
      .post("/api/trees")
      .set("Cookie", cookie)
      .send({ title: "x".repeat(101) });
    const extraField = await request(app)
      .post("/api/trees")
      .set("Cookie", cookie)
      .send({ title: "Ok", ownerId: "someone" });

    expect(longTitle.status).toBe(400);
    expect(longTitle.body.error.code).toBe("VALIDATION_ERROR");
    expect(extraField.status).toBe(400);
    expect(extraField.body.error.code).toBe("VALIDATION_ERROR");
    expect(await prisma.tree.count()).toBe(0);
  });

  it("returns 404 CATEGORY_NOT_FOUND for another user's category and creates nothing", async () => {
    const { user, cookie } = await createLoggedInUser();
    const own = await createCategory(user.id);
    const other = await createUser();
    const foreign = await createCategory(other.id);

    const res = await request(app)
      .post("/api/trees")
      .set("Cookie", cookie)
      .send({ title: "Ideas", categoryIds: [own.id, foreign.id] });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: "CATEGORY_NOT_FOUND", message: expect.any(String) },
    });
    expect(await prisma.tree.count()).toBe(0);
    expect(await prisma.node.count()).toBe(0);
  });

  it("returns 401 UNAUTHENTICATED for a guest", async () => {
    const res = await request(app).post("/api/trees").send({ title: "Ideas" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("GET /api/trees/:id", () => {
  it("lets the owner see a private tree with the full node skeleton", async () => {
    const { user, cookie } = await createLoggedInUser({ username: "alice", displayName: "Alice" });
    const tree = await createTree(user.id, { title: "Secret plan" });
    await createNodes(tree.id, tree.rootId, 2);
    await prisma.node.updateMany({
      where: { treeId: tree.id, parentId: tree.rootId },
      data: { body: "heavy body", url: "https://example.com" },
    });

    const res = await request(app).get(`/api/trees/${tree.id}`).set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.isOwner).toBe(true);
    expect(res.body.data.owner).toEqual({
      username: "alice",
      displayName: "Alice",
      avatarUrl: null,
    });
    expect(res.body.data.tree).toEqual({
      id: tree.id,
      title: "Secret plan",
      description: null,
      visibility: "PRIVATE",
      categories: [],
      removedAt: null,
      removalReason: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(res.body.data.nodes).toHaveLength(3);
    for (const node of res.body.data.nodes) {
      expect(Object.keys(node).sort()).toEqual(
        [
          "cardColor",
          "id",
          "lineColor",
          "parentId",
          "positionX",
          "positionY",
          "sortOrder",
          "title",
          "type",
          "updatedAt",
        ].sort(),
      );
    }
    const roots = (res.body.data.nodes as { parentId: string | null }[]).filter(
      (n) => n.parentId === null,
    );
    expect(roots).toEqual([expect.objectContaining({ id: tree.rootId })]);
  });

  it("shows a removed tree with its reason to the owner", async () => {
    const { user, cookie } = await createLoggedInUser();
    const admin = await createUser({ role: "ADMIN" });
    const tree = await createTree(user.id, { removed: { byId: admin.id, reason: "Spam" } });

    const res = await request(app).get(`/api/trees/${tree.id}`).set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.tree.removalReason).toBe("Spam");
    expect(res.body.data.tree.removedAt).toEqual(expect.any(String));
  });

  it("shows a public tree to a guest and to another user, with isOwner false", async () => {
    const owner = await createUser();
    const tree = await createTree(owner.id, { visibility: "PUBLIC" });
    const { cookie } = await createLoggedInUser();

    const guest = await request(app).get(`/api/trees/${tree.id}`);
    const otherUser = await request(app).get(`/api/trees/${tree.id}`).set("Cookie", cookie);

    for (const res of [guest, otherUser]) {
      expect(res.status).toBe(200);
      expect(res.body.data.isOwner).toBe(false);
      expect(res.body.data.tree.removedAt).toBeNull();
      expect(res.body.data.tree.removalReason).toBeNull();
      expect(res.body.data.nodes).toHaveLength(1);
    }
  });

  it("treats an invalid cookie as a guest", async () => {
    const owner = await createUser();
    const tree = await createTree(owner.id, { visibility: "PUBLIC" });

    const res = await request(app)
      .get(`/api/trees/${tree.id}`)
      .set("Cookie", "access_token=garbage");

    expect(res.status).toBe(200);
    expect(res.body.data.isOwner).toBe(false);
  });

  it("returns 404 TREE_NOT_FOUND to a guest, another user and an admin for a private tree", async () => {
    const owner = await createUser();
    const tree = await createTree(owner.id);
    const { cookie: userCookie } = await createLoggedInUser();
    const { cookie: adminCookie } = await createAdmin();

    const responses = [
      await request(app).get(`/api/trees/${tree.id}`),
      await request(app).get(`/api/trees/${tree.id}`).set("Cookie", userCookie),
      await request(app).get(`/api/trees/${tree.id}`).set("Cookie", adminCookie),
    ];

    for (const res of responses) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: { code: "TREE_NOT_FOUND", message: expect.any(String) } });
    }
  });

  it("returns 404 to others for a removed tree", async () => {
    const owner = await createUser();
    const admin = await createUser({ role: "ADMIN" });
    const tree = await createTree(owner.id, { removed: { byId: admin.id } });
    const { cookie } = await createLoggedInUser();

    const guest = await request(app).get(`/api/trees/${tree.id}`);
    const otherUser = await request(app).get(`/api/trees/${tree.id}`).set("Cookie", cookie);

    expect(guest.status).toBe(404);
    expect(otherUser.status).toBe(404);
    expect(otherUser.body.error.code).toBe("TREE_NOT_FOUND");
  });

  it("returns 404 to everyone, including the owner, for a tree in the Trash", async () => {
    const { user, cookie } = await createLoggedInUser();
    const tree = await createTree(user.id, { visibility: "PUBLIC", deletedAt: new Date() });

    const owner = await request(app).get(`/api/trees/${tree.id}`).set("Cookie", cookie);
    const guest = await request(app).get(`/api/trees/${tree.id}`);

    expect(owner.status).toBe(404);
    expect(owner.body.error.code).toBe("TREE_NOT_FOUND");
    expect(guest.status).toBe(404);
  });

  it("returns 404 for a public tree whose owner is deactivated", async () => {
    const owner = await createUser({ deactivated: true });
    const tree = await createTree(owner.id, { visibility: "PUBLIC" });
    const { cookie } = await createLoggedInUser();

    const guest = await request(app).get(`/api/trees/${tree.id}`);
    const otherUser = await request(app).get(`/api/trees/${tree.id}`).set("Cookie", cookie);

    expect(guest.status).toBe(404);
    expect(otherUser.status).toBe(404);
    expect(otherUser.body.error.code).toBe("TREE_NOT_FOUND");
  });

  it("returns 404 TREE_NOT_FOUND for a missing tree", async () => {
    const res = await request(app).get("/api/trees/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TREE_NOT_FOUND");
  });
});

describe("PATCH /api/trees/:id", () => {
  it("updates title, description and visibility (200)", async () => {
    const { user, cookie } = await createLoggedInUser();
    const tree = await createTree(user.id);

    const res = await request(app)
      .patch(`/api/trees/${tree.id}`)
      .set("Cookie", cookie)
      .send({ title: " Renamed ", description: "About it", visibility: "PUBLIC" });

    expect(res.status).toBe(200);
    expect(res.body.data.tree).toEqual({
      id: tree.id,
      title: "Renamed",
      description: "About it",
      visibility: "PUBLIC",
      categories: [],
      removedAt: null,
      removalReason: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it("clears the description with null", async () => {
    const { user, cookie } = await createLoggedInUser();
    const tree = await createTree(user.id);
    await prisma.tree.update({ where: { id: tree.id }, data: { description: "Old" } });

    const res = await request(app)
      .patch(`/api/trees/${tree.id}`)
      .set("Cookie", cookie)
      .send({ description: null });

    expect(res.status).toBe(200);
    expect(res.body.data.tree.description).toBeNull();
  });

  it("replaces all categories, and [] removes them", async () => {
    const { user, cookie } = await createLoggedInUser();
    const a = await createCategory(user.id, "Alpha");
    const b = await createCategory(user.id, "Beta");
    const tree = await createTree(user.id, { categoryIds: [a.id] });

    const replaced = await request(app)
      .patch(`/api/trees/${tree.id}`)
      .set("Cookie", cookie)
      .send({ categoryIds: [b.id, b.id] });
    const cleared = await request(app)
      .patch(`/api/trees/${tree.id}`)
      .set("Cookie", cookie)
      .send({ categoryIds: [] });

    expect(replaced.status).toBe(200);
    expect(replaced.body.data.tree.categories).toEqual([
      { id: b.id, name: "Beta", color: "#6B7280" },
    ]);
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.tree.categories).toEqual([]);
  });

  it("returns 404 CATEGORY_NOT_FOUND for a foreign category and changes nothing", async () => {
    const { user, cookie } = await createLoggedInUser();
    const own = await createCategory(user.id);
    const other = await createUser();
    const foreign = await createCategory(other.id);
    const tree = await createTree(user.id, { title: "Before", categoryIds: [own.id] });

    const res = await request(app)
      .patch(`/api/trees/${tree.id}`)
      .set("Cookie", cookie)
      .send({ title: "After", categoryIds: [foreign.id] });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CATEGORY_NOT_FOUND");
    const stored = await prisma.tree.findUniqueOrThrow({
      where: { id: tree.id },
      include: { categories: true },
    });
    expect(stored.title).toBe("Before");
    expect(stored.categories.map((c) => c.categoryId)).toEqual([own.id]);
  });

  it("returns 409 TREE_REMOVED when making a removed tree public, but allows private edits", async () => {
    const { user, cookie } = await createLoggedInUser();
    const admin = await createUser({ role: "ADMIN" });
    const tree = await createTree(user.id, { removed: { byId: admin.id } });

    const toPublic = await request(app)
      .patch(`/api/trees/${tree.id}`)
      .set("Cookie", cookie)
      .send({ visibility: "PUBLIC" });
    const rename = await request(app)
      .patch(`/api/trees/${tree.id}`)
      .set("Cookie", cookie)
      .send({ title: "Fixed", visibility: "PRIVATE" });

    expect(toPublic.status).toBe(409);
    expect(toPublic.body).toEqual({ error: { code: "TREE_REMOVED", message: expect.any(String) } });
    expect(rename.status).toBe(200);
    expect(rename.body.data.tree.title).toBe("Fixed");
    expect(rename.body.data.tree.visibility).toBe("PRIVATE");
  });

  it("returns 400 VALIDATION_ERROR for an empty body or a field not allowed", async () => {
    const { user, cookie } = await createLoggedInUser();
    const tree = await createTree(user.id);

    const empty = await request(app).patch(`/api/trees/${tree.id}`).set("Cookie", cookie).send({});
    const extra = await request(app)
      .patch(`/api/trees/${tree.id}`)
      .set("Cookie", cookie)
      .send({ removedAt: null });
    const tooMany = await request(app)
      .patch(`/api/trees/${tree.id}`)
      .set("Cookie", cookie)
      .send({ categoryIds: Array.from({ length: 11 }, (_, i) => `c${String(i)}`) });

    for (const res of [empty, extra, tooMany]) {
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details.length).toBeGreaterThan(0);
    }
  });

  it("returns 404 TREE_NOT_FOUND for another user's tree, also for an admin", async () => {
    const owner = await createUser();
    const tree = await createTree(owner.id, { visibility: "PUBLIC" });
    const { cookie } = await createLoggedInUser();
    const { cookie: adminCookie } = await createAdmin();

    const userRes = await request(app)
      .patch(`/api/trees/${tree.id}`)
      .set("Cookie", cookie)
      .send({ title: "Hacked" });
    const adminRes = await request(app)
      .patch(`/api/trees/${tree.id}`)
      .set("Cookie", adminCookie)
      .send({ title: "Hacked" });

    for (const res of [userRes, adminRes]) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("TREE_NOT_FOUND");
    }
  });

  it("returns 404 TREE_NOT_FOUND for a tree in the Trash", async () => {
    const { user, cookie } = await createLoggedInUser();
    const tree = await createTree(user.id, { deletedAt: new Date() });

    const res = await request(app)
      .patch(`/api/trees/${tree.id}`)
      .set("Cookie", cookie)
      .send({ title: "Edit" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TREE_NOT_FOUND");
  });

  it("returns 401 UNAUTHENTICATED for a guest", async () => {
    const owner = await createUser();
    const tree = await createTree(owner.id);

    const res = await request(app).patch(`/api/trees/${tree.id}`).send({ title: "x" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("DELETE /api/trees/:id", () => {
  it("moves the tree to the Trash and keeps nodes, tags and removal info (200)", async () => {
    const { user, cookie } = await createLoggedInUser();
    const admin = await createUser({ role: "ADMIN" });
    const category = await createCategory(user.id);
    const tree = await createTree(user.id, {
      categoryIds: [category.id],
      removed: { byId: admin.id, reason: "Spam" },
    });

    const res = await request(app).delete(`/api/trees/${tree.id}`).set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: null });
    const stored = await prisma.tree.findUniqueOrThrow({
      where: { id: tree.id },
      include: { nodes: true, categories: true },
    });
    expect(stored.deletedAt).not.toBeNull();
    expect(stored.removalReason).toBe("Spam");
    expect(stored.nodes).toHaveLength(1);
    expect(stored.categories).toHaveLength(1);
  });

  it("returns 404 TREE_NOT_FOUND on a second delete", async () => {
    const { user, cookie } = await createLoggedInUser();
    const tree = await createTree(user.id);
    await request(app).delete(`/api/trees/${tree.id}`).set("Cookie", cookie);

    const res = await request(app).delete(`/api/trees/${tree.id}`).set("Cookie", cookie);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TREE_NOT_FOUND");
  });

  it("returns 404 TREE_NOT_FOUND for another user's tree and leaves it alone", async () => {
    const owner = await createUser();
    const tree = await createTree(owner.id, { visibility: "PUBLIC" });
    const { cookie } = await createAdmin();

    const res = await request(app).delete(`/api/trees/${tree.id}`).set("Cookie", cookie);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TREE_NOT_FOUND");
    const stored = await prisma.tree.findUniqueOrThrow({ where: { id: tree.id } });
    expect(stored.deletedAt).toBeNull();
  });

  it("returns 401 UNAUTHENTICATED for a guest", async () => {
    const owner = await createUser();
    const tree = await createTree(owner.id);

    const res = await request(app).delete(`/api/trees/${tree.id}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});
