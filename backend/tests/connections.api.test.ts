import { MAX_CONNECTIONS_PER_TREE } from "@highdea/shared";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { prisma, resetDb } from "./helpers/db.js";
import { createAdmin, createLoggedInUser, createTree } from "./helpers/factories.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** 自分のツリーに、ルートの子 a・b と a の子 c を作る */
async function setup(options: Parameters<typeof createTree>[1] = {}) {
  const { user, cookie } = await createLoggedInUser();
  const tree = await createTree(user.id, options);
  const child = (title: string, parentId: string) =>
    prisma.node.create({ data: { treeId: tree.id, parentId, title } });
  const a = await child("A", tree.rootId);
  const b = await child("B", tree.rootId);
  const c = await child("C", a.id);
  return { user, cookie, tree, a, b, c };
}

const sorted = (x: string, y: string) => (x < y ? [x, y] : [y, x]);

describe("POST /api/trees/:id/connections", () => {
  it("connects two ideas, stores the IDs sorted and bumps the tree's updatedAt (201)", async () => {
    const { cookie, tree, b, c } = await setup();
    const before = await prisma.tree.findUniqueOrThrow({ where: { id: tree.id } });

    const res = await request(app)
      .post(`/api/trees/${tree.id}/connections`)
      .set("Cookie", cookie)
      .send({ nodeAId: c.id, nodeBId: b.id });

    expect(res.status).toBe(201);
    const [nodeAId, nodeBId] = sorted(b.id, c.id);
    expect(res.body).toEqual({
      data: { connection: { id: expect.any(String), nodeAId, nodeBId } },
    });
    const after = await prisma.tree.findUniqueOrThrow({ where: { id: tree.id } });
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  it("shows the connection in GET /api/trees/:id, also to visitors of a public tree", async () => {
    const { cookie, tree, b, c } = await setup({ visibility: "PUBLIC" });
    const created = await request(app)
      .post(`/api/trees/${tree.id}/connections`)
      .set("Cookie", cookie)
      .send({ nodeAId: b.id, nodeBId: c.id });

    const res = await request(app).get(`/api/trees/${tree.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.connections).toEqual([created.body.data.connection]);
  });

  it("returns 409 INVALID_CONNECTION for a pair that's already connected, in either order", async () => {
    const { cookie, tree, b, c } = await setup();
    const url = `/api/trees/${tree.id}/connections`;
    await request(app).post(url).set("Cookie", cookie).send({ nodeAId: b.id, nodeBId: c.id });

    const res = await request(app)
      .post(url)
      .set("Cookie", cookie)
      .send({ nodeAId: c.id, nodeBId: b.id });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVALID_CONNECTION");
    expect(await prisma.nodeConnection.count()).toBe(1);
  });

  it("returns 409 INVALID_CONNECTION for a parent and its child", async () => {
    const { cookie, tree, a, c } = await setup();

    const res = await request(app)
      .post(`/api/trees/${tree.id}/connections`)
      .set("Cookie", cookie)
      .send({ nodeAId: a.id, nodeBId: c.id });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVALID_CONNECTION");
  });

  it("returns 400 VALIDATION_ERROR for the same idea twice or a missing field", async () => {
    const { cookie, tree, a } = await setup();
    const url = `/api/trees/${tree.id}/connections`;

    const same = await request(app)
      .post(url)
      .set("Cookie", cookie)
      .send({ nodeAId: a.id, nodeBId: a.id });
    const missing = await request(app).post(url).set("Cookie", cookie).send({ nodeAId: a.id });

    for (const res of [same, missing]) {
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details).toEqual([{ field: "nodeBId", message: expect.any(String) }]);
    }
  });

  it("returns 404 NODE_NOT_FOUND for an idea from another tree", async () => {
    const { user, cookie, tree, a } = await setup();
    const other = await createTree(user.id);

    const res = await request(app)
      .post(`/api/trees/${tree.id}/connections`)
      .set("Cookie", cookie)
      .send({ nodeAId: a.id, nodeBId: other.rootId });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NODE_NOT_FOUND");
  });

  it("returns 404 TREE_NOT_FOUND for another user's tree (also for an admin) or a tree in the Trash", async () => {
    const { tree, b, c } = await setup({ visibility: "PUBLIC" });
    const { cookie: otherCookie } = await createLoggedInUser();
    const { cookie: adminCookie } = await createAdmin();
    const trashed = await setup({ deletedAt: new Date() });
    const body = { nodeAId: b.id, nodeBId: c.id };

    const responses = [
      await request(app)
        .post(`/api/trees/${tree.id}/connections`)
        .set("Cookie", otherCookie)
        .send(body),
      await request(app)
        .post(`/api/trees/${tree.id}/connections`)
        .set("Cookie", adminCookie)
        .send(body),
      await request(app)
        .post(`/api/trees/${trashed.tree.id}/connections`)
        .set("Cookie", trashed.cookie)
        .send({ nodeAId: trashed.b.id, nodeBId: trashed.c.id }),
    ];

    for (const res of responses) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("TREE_NOT_FOUND");
    }
    expect(await prisma.nodeConnection.count()).toBe(0);
  });

  it("returns 409 CONNECTION_LIMIT_REACHED at 500 connections", async () => {
    const { cookie, tree, a, b } = await setup();
    const ids = Array.from({ length: 33 }, (_, i) => `n${String(i).padStart(3, "0")}-${tree.id}`);
    await prisma.node.createMany({
      data: ids.map((id) => ({ id, treeId: tree.id, parentId: tree.rootId, title: id })),
    });
    // 33 ノードの組み合わせ（528組）から 500 組を作る
    const pairs: { nodeAId: string; nodeBId: string }[] = [];
    for (let i = 0; i < ids.length && pairs.length < MAX_CONNECTIONS_PER_TREE; i++) {
      for (let j = i + 1; j < ids.length && pairs.length < MAX_CONNECTIONS_PER_TREE; j++) {
        pairs.push({ nodeAId: ids[i] as string, nodeBId: ids[j] as string });
      }
    }
    await prisma.nodeConnection.createMany({
      data: pairs.map((p) => ({ treeId: tree.id, ...p })),
    });

    const res = await request(app)
      .post(`/api/trees/${tree.id}/connections`)
      .set("Cookie", cookie)
      .send({ nodeAId: a.id, nodeBId: b.id });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONNECTION_LIMIT_REACHED");
  });

  it("returns 401 UNAUTHENTICATED for a guest", async () => {
    const { tree, b, c } = await setup();

    const res = await request(app)
      .post(`/api/trees/${tree.id}/connections`)
      .send({ nodeAId: b.id, nodeBId: c.id });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("DELETE /api/connections/:id", () => {
  async function connected() {
    const ctx = await setup();
    const res = await request(app)
      .post(`/api/trees/${ctx.tree.id}/connections`)
      .set("Cookie", ctx.cookie)
      .send({ nodeAId: ctx.b.id, nodeBId: ctx.c.id });
    return { ...ctx, connectionId: res.body.data.connection.id as string };
  }

  it("removes the connection and keeps both ideas (200)", async () => {
    const { cookie, connectionId, b, c } = await connected();

    const res = await request(app).delete(`/api/connections/${connectionId}`).set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: null });
    expect(await prisma.nodeConnection.count()).toBe(0);
    expect(await prisma.node.count({ where: { id: { in: [b.id, c.id] } } })).toBe(2);
  });

  it("returns 404 CONNECTION_NOT_FOUND for another user's connection, also for an admin", async () => {
    const { connectionId } = await connected();
    const { cookie } = await createLoggedInUser();
    const { cookie: adminCookie } = await createAdmin();

    for (const c of [cookie, adminCookie]) {
      const res = await request(app).delete(`/api/connections/${connectionId}`).set("Cookie", c);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("CONNECTION_NOT_FOUND");
    }
    expect(await prisma.nodeConnection.count()).toBe(1);
  });

  it("returns 404 CONNECTION_NOT_FOUND for a missing connection or a tree in the Trash", async () => {
    const { cookie, connectionId, tree } = await connected();
    await prisma.tree.update({ where: { id: tree.id }, data: { deletedAt: new Date() } });

    const trashed = await request(app)
      .delete(`/api/connections/${connectionId}`)
      .set("Cookie", cookie);
    const missing = await request(app).delete("/api/connections/nope").set("Cookie", cookie);

    for (const res of [trashed, missing]) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("CONNECTION_NOT_FOUND");
    }
  });

  it("returns 401 UNAUTHENTICATED for a guest", async () => {
    const { connectionId } = await connected();

    const res = await request(app).delete(`/api/connections/${connectionId}`);

    expect(res.status).toBe(401);
  });
});

describe("connections and node changes", () => {
  it("deleting an idea deletes its connections", async () => {
    const { cookie, tree, a, b } = await setup();
    await request(app)
      .post(`/api/trees/${tree.id}/connections`)
      .set("Cookie", cookie)
      .send({ nodeAId: a.id, nodeBId: b.id });

    const res = await request(app).delete(`/api/nodes/${a.id}`).set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(await prisma.nodeConnection.count()).toBe(0);
  });

  it("re-parenting an idea under an idea it's connected to removes that connection", async () => {
    const { cookie, tree, b, c } = await setup();
    await request(app)
      .post(`/api/trees/${tree.id}/connections`)
      .set("Cookie", cookie)
      .send({ nodeAId: b.id, nodeBId: c.id });

    const res = await request(app)
      .patch(`/api/nodes/${c.id}`)
      .set("Cookie", cookie)
      .send({ parentId: b.id });

    expect(res.status).toBe(200);
    expect(await prisma.nodeConnection.count()).toBe(0);
  });
});
