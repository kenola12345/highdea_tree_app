import { MAX_GROUPS_PER_TREE } from "@highdea/shared";
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

const box = { positionX: -40, positionY: 10, width: 320, height: 200 };

async function setup(options: Parameters<typeof createTree>[1] = {}) {
  const { user, cookie } = await createLoggedInUser();
  const tree = await createTree(user.id, options);
  return { user, cookie, tree };
}

describe("POST /api/trees/:id/groups", () => {
  it("adds a box with the default title, shows it in GET /api/trees/:id (also to visitors) and bumps updatedAt", async () => {
    const { cookie, tree } = await setup({ visibility: "PUBLIC" });
    const before = await prisma.tree.findUniqueOrThrow({ where: { id: tree.id } });

    const res = await request(app)
      .post(`/api/trees/${tree.id}/groups`)
      .set("Cookie", cookie)
      .send(box);

    expect(res.status).toBe(201);
    expect(res.body.data.group).toEqual({
      id: expect.any(String),
      kind: "BOX",
      title: "Group",
      body: null,
      color: null,
      ...box,
    });
    const visitor = await request(app).get(`/api/trees/${tree.id}`);
    expect(visitor.body.data.groups).toEqual([res.body.data.group]);
    const after = await prisma.tree.findUniqueOrThrow({ where: { id: tree.id } });
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  it("returns 400 VALIDATION_ERROR for a missing size, a too-small box, an empty title or another field", async () => {
    const { cookie, tree } = await setup();
    for (const body of [
      { positionX: 0, positionY: 0 },
      { ...box, width: 110 },
      { ...box, height: 40 },
      { ...box, title: "  " },
      { ...box, color: "green" },
      { ...box, treeId: "x" },
    ]) {
      const res = await request(app)
        .post(`/api/trees/${tree.id}/groups`)
        .set("Cookie", cookie)
        .send(body);
      expect(res.status).toBe(400);
    }
  });

  it("returns 409 GROUP_LIMIT_REACHED at 100 boxes", async () => {
    const { cookie, tree } = await setup();
    await prisma.nodeGroup.createMany({
      data: Array.from({ length: MAX_GROUPS_PER_TREE }, () => ({ treeId: tree.id, ...box })),
    });

    const res = await request(app)
      .post(`/api/trees/${tree.id}/groups`)
      .set("Cookie", cookie)
      .send(box);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("GROUP_LIMIT_REACHED");
  });

  it("returns 404 TREE_NOT_FOUND for another user's tree (also an admin) and 401 for a guest", async () => {
    const { tree } = await setup({ visibility: "PUBLIC" });
    const { cookie: other } = await createLoggedInUser();
    const { cookie: admin } = await createAdmin();
    for (const c of [other, admin]) {
      const res = await request(app)
        .post(`/api/trees/${tree.id}/groups`)
        .set("Cookie", c)
        .send(box);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("TREE_NOT_FOUND");
    }
    const guest = await request(app).post(`/api/trees/${tree.id}/groups`).send(box);
    expect(guest.status).toBe(401);
  });
});

describe("PATCH and DELETE /api/groups/:id", () => {
  async function withBox() {
    const ctx = await setup();
    const res = await request(app)
      .post(`/api/trees/${ctx.tree.id}/groups`)
      .set("Cookie", ctx.cookie)
      .send(box);
    return { ...ctx, groupId: res.body.data.group.id as string };
  }

  it("renames, recolors, moves and resizes a box", async () => {
    const { cookie, groupId } = await withBox();

    const res = await request(app)
      .patch(`/api/groups/${groupId}`)
      .set("Cookie", cookie)
      .send({ title: "Condition", color: "#7C3AED", positionX: 5, width: 400 });

    expect(res.status).toBe(200);
    expect(res.body.data.group).toMatchObject({
      title: "Condition",
      color: "#7C3AED",
      positionX: 5,
      width: 400,
      height: 200,
    });
    const empty = await request(app).patch(`/api/groups/${groupId}`).set("Cookie", cookie).send({});
    expect(empty.status).toBe(400);
  });

  it("deletes a box without touching the ideas", async () => {
    const { cookie, groupId, tree } = await withBox();
    const nodesBefore = await prisma.node.count({ where: { treeId: tree.id } });

    const res = await request(app).delete(`/api/groups/${groupId}`).set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(await prisma.nodeGroup.count()).toBe(0);
    expect(await prisma.node.count({ where: { treeId: tree.id } })).toBe(nodesBefore);
  });

  it("returns 404 GROUP_NOT_FOUND for another user's box, a missing box or a tree in the Trash", async () => {
    const { cookie, groupId, tree } = await withBox();
    const { cookie: other } = await createLoggedInUser();
    expect(
      (await request(app).patch(`/api/groups/${groupId}`).set("Cookie", other).send({ title: "x" }))
        .status,
    ).toBe(404);
    expect((await request(app).delete(`/api/groups/${groupId}`).set("Cookie", other)).status).toBe(
      404,
    );
    expect((await request(app).delete("/api/groups/nope").set("Cookie", cookie)).status).toBe(404);
    await prisma.tree.update({ where: { id: tree.id }, data: { deletedAt: new Date() } });
    const trashed = await request(app)
      .patch(`/api/groups/${groupId}`)
      .set("Cookie", cookie)
      .send({ title: "x" });
    expect(trashed.status).toBe(404);
    expect(trashed.body.error.code).toBe("GROUP_NOT_FOUND");
  });
});

describe("PATCH /api/trees/:id/nodes/positions with boxes", () => {
  it("moves a box and the ideas inside it in one request", async () => {
    const { cookie, tree } = await setup();
    const created = await request(app)
      .post(`/api/trees/${tree.id}/groups`)
      .set("Cookie", cookie)
      .send(box);
    const groupId = created.body.data.group.id as string;

    const res = await request(app)
      .patch(`/api/trees/${tree.id}/nodes/positions`)
      .set("Cookie", cookie)
      .send({
        nodes: [{ id: tree.rootId, positionX: 100, positionY: 50 }],
        groups: [{ id: groupId, positionX: 60, positionY: 30, width: 500 }],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.groups).toEqual([
      expect.objectContaining({ id: groupId, positionX: 60, positionY: 30, width: 500 }),
    ]);
    const onlyBox = await request(app)
      .patch(`/api/trees/${tree.id}/nodes/positions`)
      .set("Cookie", cookie)
      .send({ groups: [{ id: groupId, positionX: 0, positionY: 0 }] });
    expect(onlyBox.status).toBe(200);
  });

  it("returns 400 when both lists are empty and 404 GROUP_NOT_FOUND for a box of another tree (nothing saved)", async () => {
    const { cookie, tree } = await setup();
    const other = await setup();
    const foreign = await request(app)
      .post(`/api/trees/${other.tree.id}/groups`)
      .set("Cookie", other.cookie)
      .send(box);

    const empty = await request(app)
      .patch(`/api/trees/${tree.id}/nodes/positions`)
      .set("Cookie", cookie)
      .send({});
    expect(empty.status).toBe(400);
    const res = await request(app)
      .patch(`/api/trees/${tree.id}/nodes/positions`)
      .set("Cookie", cookie)
      .send({
        nodes: [{ id: tree.rootId, positionX: 999, positionY: 999 }],
        groups: [{ id: foreign.body.data.group.id as string, positionX: 1, positionY: 1 }],
      });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("GROUP_NOT_FOUND");
    const root = await prisma.node.findUniqueOrThrow({ where: { id: tree.rootId } });
    expect(root.positionX).not.toBe(999);
  });
});

describe("sticky notes and text labels", () => {
  it("adds a note with text and a label with a title, with their default titles and smaller sizes", async () => {
    const { cookie, tree } = await setup();

    const note = await request(app)
      .post(`/api/trees/${tree.id}/groups`)
      .set("Cookie", cookie)
      .send({
        kind: "NOTE",
        body: "Remember to ask Bob",
        positionX: 0,
        positionY: 0,
        width: 220,
        height: 160,
      });
    const label = await request(app)
      .post(`/api/trees/${tree.id}/groups`)
      .set("Cookie", cookie)
      .send({
        kind: "LABEL",
        title: "Phase 1",
        positionX: 0,
        positionY: 0,
        width: 280,
        height: 60,
      });

    expect(note.status).toBe(201);
    expect(note.body.data.group).toMatchObject({
      kind: "NOTE",
      title: "Note",
      body: "Remember to ask Bob",
    });
    expect(label.body.data.group).toMatchObject({ kind: "LABEL", title: "Phase 1", body: null });
    const edited = await request(app)
      .patch(`/api/groups/${note.body.data.group.id as string}`)
      .set("Cookie", cookie)
      .send({ body: "Asked." });
    expect(edited.body.data.group.body).toBe("Asked.");
  });

  it("keeps a box's label in body and clears it with null", async () => {
    const { cookie, tree } = await setup();
    const created = await request(app)
      .post(`/api/trees/${tree.id}/groups`)
      .set("Cookie", cookie)
      .send({ ...box, body: "Backend flow" });
    expect(created.status).toBe(201);
    expect(created.body.data.group).toMatchObject({ kind: "BOX", body: "Backend flow" });
    const cleared = await request(app)
      .patch(`/api/groups/${created.body.data.group.id as string}`)
      .set("Cookie", cookie)
      .send({ body: null });
    expect(cleared.body.data.group.body).toBeNull();
  });

  it("rejects text on a text label, and a box smaller than 160 × 100", async () => {
    const { cookie, tree } = await setup();
    const small = await request(app)
      .post(`/api/trees/${tree.id}/groups`)
      .set("Cookie", cookie)
      .send({ ...box, width: 130, height: 60 });
    expect(small.status).toBe(400);
    const label = await request(app)
      .post(`/api/trees/${tree.id}/groups`)
      .set("Cookie", cookie)
      .send({ kind: "LABEL", positionX: 0, positionY: 0, width: 130, height: 60 });
    expect(label.status).toBe(201);
    const labelText = await request(app)
      .patch(`/api/groups/${label.body.data.group.id as string}`)
      .set("Cookie", cookie)
      .send({ body: "x" });
    expect(labelText.status).toBe(400);
  });
});
