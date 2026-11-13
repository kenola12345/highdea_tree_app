import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { prisma, resetDb } from "./helpers/db.js";
import { createAdmin, createLoggedInUser, createTree, createUser } from "./helpers/factories.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** 非公開化のリクエストを送る */
function remove(treeId: string, cookie: string | undefined, body: object = { reason: "Spam" }) {
  const req = request(app).post(`/api/admin/trees/${treeId}/remove`);
  if (cookie) void req.set("Cookie", cookie);
  return req.send(body);
}

describe("POST /api/admin/trees/:id/remove", () => {
  it("removes a public tree, makes it private and hides it from Explore", async () => {
    const { user: admin, cookie } = await createAdmin();
    const owner = await createUser();
    const tree = await createTree(owner.id, { title: "Bad tree", visibility: "PUBLIC" });

    const res = await remove(tree.id, cookie, { reason: "  Offensive content  " });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: {
        tree: {
          id: tree.id,
          title: "Bad tree",
          visibility: "PRIVATE",
          removedAt: expect.any(String),
          removalReason: "Offensive content",
        },
      },
    });
    const saved = await prisma.tree.findUniqueOrThrow({ where: { id: tree.id } });
    expect(saved).toMatchObject({
      visibility: "PRIVATE",
      removedById: admin.id,
      removalReason: "Offensive content",
      deletedAt: null,
    });
    expect(saved.removedAt).toBeInstanceOf(Date);

    const explore = await request(app).get("/api/explore");
    expect(explore.body.data.trees).toEqual([]);
  });

  it("keeps the tree with its owner: still in the DB with nodes, owned privately", async () => {
    const { cookie } = await createAdmin();
    const owner = await createUser();
    const tree = await createTree(owner.id, { visibility: "PUBLIC" });

    await remove(tree.id, cookie).expect(200);

    const owned = await prisma.tree.findFirst({
      where: { id: tree.id, ownerId: owner.id, deletedAt: null },
      include: { nodes: true },
    });
    expect(owned?.nodes).toHaveLength(1);
  });

  it("returns 409 TREE_ALREADY_REMOVED for a tree that was already removed", async () => {
    const { cookie } = await createAdmin();
    const owner = await createUser();
    const tree = await createTree(owner.id, { visibility: "PUBLIC" });

    await remove(tree.id, cookie).expect(200);
    const res = await remove(tree.id, cookie, { reason: "Again" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("TREE_ALREADY_REMOVED");
    const saved = await prisma.tree.findUniqueOrThrow({ where: { id: tree.id } });
    expect(saved.removalReason).toBe("Spam");
  });

  it("lets only one of two concurrent removals succeed", async () => {
    const { cookie: first } = await createAdmin();
    const { cookie: second } = await createAdmin();
    const owner = await createUser();
    const tree = await createTree(owner.id, { visibility: "PUBLIC" });

    const results = await Promise.all([remove(tree.id, first), remove(tree.id, second)]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it("returns 404 TREE_NOT_FOUND for trees that aren't publicly visible", async () => {
    const { cookie } = await createAdmin();
    const owner = await createUser();
    const gone = await createUser({ deactivated: true });
    const privateTree = await createTree(owner.id);
    const trashed = await createTree(owner.id, { visibility: "PUBLIC", deletedAt: new Date() });
    const ownerGone = await createTree(gone.id, { visibility: "PUBLIC" });

    for (const id of [privateTree.id, trashed.id, ownerGone.id, "does-not-exist"]) {
      const res = await remove(id, cookie);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("TREE_NOT_FOUND");
    }
    const untouched = await prisma.tree.findUniqueOrThrow({ where: { id: privateTree.id } });
    expect(untouched.removedAt).toBeNull();
  });

  it("returns 403 FORBIDDEN for a USER", async () => {
    const { user, cookie } = await createLoggedInUser();
    const tree = await createTree(user.id, { visibility: "PUBLIC" });

    const res = await remove(tree.id, cookie);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 401 UNAUTHENTICATED for a guest", async () => {
    const owner = await createUser();
    const tree = await createTree(owner.id, { visibility: "PUBLIC" });

    const res = await remove(tree.id, undefined);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it.each([
    ["a missing reason", {}],
    ["an empty reason", { reason: "   " }],
    ["a reason over 500 characters", { reason: "a".repeat(501) }],
    ["an unknown field", { reason: "Spam", visibility: "PUBLIC" }],
  ])("returns 400 VALIDATION_ERROR for %s", async (_label, body) => {
    const { cookie } = await createAdmin();
    const owner = await createUser();
    const tree = await createTree(owner.id, { visibility: "PUBLIC" });

    const res = await remove(tree.id, cookie, body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    const saved = await prisma.tree.findUniqueOrThrow({ where: { id: tree.id } });
    expect(saved.removedAt).toBeNull();
  });
});
