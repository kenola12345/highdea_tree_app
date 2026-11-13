import { MAX_NODES_PER_TREE } from "@highdea/shared";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { prisma, resetDb } from "./helpers/db.js";
import { createLoggedInUser, createNodes, createTree, createUser } from "./helpers/factories.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function savePositions(treeId: string, cookie: string | undefined, body: unknown) {
  const req = request(app).patch(`/api/trees/${treeId}/nodes/positions`);
  return (cookie ? req.set("Cookie", cookie) : req).send(body as object);
}

/** ログイン済みユーザーと、ルート + 子2つのツリー */
async function setup(options: Parameters<typeof createTree>[1] = {}) {
  const { user, cookie } = await createLoggedInUser();
  const tree = await createTree(user.id, options);
  await createNodes(tree.id, tree.rootId, 2);
  const children = await prisma.node.findMany({
    where: { treeId: tree.id, parentId: tree.rootId },
    orderBy: { sortOrder: "asc" },
  });
  const [a, b] = children;
  if (!a || !b) throw new Error("children were not created");
  return { user, cookie, tree, a, b };
}

describe("PATCH /api/trees/:id/nodes/positions", () => {
  it("saves every position, keeps sortOrder when omitted, and bumps updatedAt", async () => {
    const { cookie, tree, a, b } = await setup();
    await prisma.tree.update({
      where: { id: tree.id },
      data: { updatedAt: new Date("2026-01-01T00:00:00Z") },
    });

    const res = await savePositions(tree.id, cookie, {
      nodes: [
        { id: a.id, positionX: 10.5, positionY: -20, sortOrder: 5 },
        { id: b.id, positionX: 30, positionY: 40 },
      ],
    });

    expect(res.status).toBe(200);
    const nodes = res.body.data.nodes as { id: string }[];
    expect(nodes).toHaveLength(2);
    expect(nodes.find((n) => n.id === a.id)).toEqual({
      id: a.id,
      positionX: 10.5,
      positionY: -20,
      sortOrder: 5,
      updatedAt: expect.any(String),
    });
    expect(nodes.find((n) => n.id === b.id)).toMatchObject({
      positionX: 30,
      sortOrder: b.sortOrder,
    });
    const savedB = await prisma.node.findUniqueOrThrow({ where: { id: b.id } });
    expect(savedB).toMatchObject({ positionX: 30, positionY: 40, sortOrder: b.sortOrder });
    const savedTree = await prisma.tree.findUniqueOrThrow({ where: { id: tree.id } });
    expect(savedTree.updatedAt.getTime()).toBeGreaterThan(
      new Date("2026-01-01T00:00:00Z").getTime(),
    );
  });

  it("returns 404 NODE_NOT_FOUND and saves nothing when one ID belongs to another tree", async () => {
    const { user, cookie, tree, a } = await setup();
    const other = await createTree(user.id);

    const res = await savePositions(tree.id, cookie, {
      nodes: [
        { id: a.id, positionX: 999, positionY: 999 },
        { id: other.rootId, positionX: 1, positionY: 1 },
      ],
    });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NODE_NOT_FOUND");
    const saved = await prisma.node.findUniqueOrThrow({ where: { id: a.id } });
    expect(saved.positionX).toBe(0);
  });

  it.each([
    ["missing nodes", {}],
    ["an empty list", { nodes: [] }],
    ["a non-number position", { nodes: [{ id: "x", positionX: "1", positionY: 2 }] }],
    [
      "an unknown field on an item",
      { nodes: [{ id: "x", positionX: 1, positionY: 2, parentId: "y" }] },
    ],
    [
      "a non-integer sortOrder",
      { nodes: [{ id: "x", positionX: 1, positionY: 2, sortOrder: 1.5 }] },
    ],
    [
      "more than 2,000 items",
      {
        nodes: Array.from({ length: MAX_NODES_PER_TREE + 1 }, (_, i) => ({
          id: `n${String(i)}`,
          positionX: 0,
          positionY: 0,
        })),
      },
    ],
  ])("returns 400 VALIDATION_ERROR for %s", async (_label, body) => {
    const { cookie, tree } = await setup();

    const res = await savePositions(tree.id, cookie, body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR for duplicate IDs and saves nothing", async () => {
    const { cookie, tree, a } = await setup();

    const res = await savePositions(tree.id, cookie, {
      nodes: [
        { id: a.id, positionX: 1, positionY: 1 },
        { id: a.id, positionX: 2, positionY: 2 },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    const saved = await prisma.node.findUniqueOrThrow({ where: { id: a.id } });
    expect(saved.positionX).toBe(0);
  });

  it("returns 401 UNAUTHENTICATED for guests", async () => {
    const { tree, a } = await setup();

    const res = await savePositions(tree.id, undefined, {
      nodes: [{ id: a.id, positionX: 1, positionY: 1 }],
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 404 TREE_NOT_FOUND for another user's tree", async () => {
    const owner = await createUser();
    const tree = await createTree(owner.id, { visibility: "PUBLIC" });
    const { cookie } = await createLoggedInUser();

    const res = await savePositions(tree.id, cookie, {
      nodes: [{ id: tree.rootId, positionX: 1, positionY: 1 }],
    });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TREE_NOT_FOUND");
  });

  it("returns 404 TREE_NOT_FOUND for a tree in the Trash", async () => {
    const { cookie, tree, a } = await setup({ deletedAt: new Date() });

    const res = await savePositions(tree.id, cookie, {
      nodes: [{ id: a.id, positionX: 1, positionY: 1 }],
    });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TREE_NOT_FOUND");
  });

  it("lets the owner save positions in a tree an admin removed", async () => {
    const admin = await createUser({ role: "ADMIN" });
    const { cookie, tree, a } = await setup({ removed: { byId: admin.id } });

    const res = await savePositions(tree.id, cookie, {
      nodes: [{ id: a.id, positionX: 1, positionY: 1 }],
    });

    expect(res.status).toBe(200);
  });

  it("saves 2,000 nodes in one request", async () => {
    const { user, cookie } = await createLoggedInUser();
    const tree = await createTree(user.id);
    await createNodes(tree.id, tree.rootId, MAX_NODES_PER_TREE - 1);
    const all = await prisma.node.findMany({ where: { treeId: tree.id }, select: { id: true } });

    const res = await savePositions(tree.id, cookie, {
      nodes: all.map((n, i) => ({ id: n.id, positionX: i, positionY: -i, sortOrder: i })),
    });

    expect(res.status).toBe(200);
    expect(res.body.data.nodes).toHaveLength(MAX_NODES_PER_TREE);
  });
});
