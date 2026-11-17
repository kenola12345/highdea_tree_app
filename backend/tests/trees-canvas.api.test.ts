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

describe("PATCH /api/trees/:id/canvas", () => {
  it("changes the canvas look, shows it in GET /api/trees/:id (also to visitors) and bumps updatedAt (200)", async () => {
    const { user, cookie } = await createLoggedInUser();
    const tree = await createTree(user.id, { visibility: "PUBLIC" });
    const before = await prisma.tree.findUniqueOrThrow({ where: { id: tree.id } });

    const res = await request(app)
      .patch(`/api/trees/${tree.id}/canvas`)
      .set("Cookie", cookie)
      .send({
        gridStyle: "DOTS",
        gridColor: "#334155",
        gridOpacity: 40,
        gridSpacing: 32,
        backgroundColor: "#0F172A",
        nodeStyle: "MIDNIGHT",
      });

    const canvas = {
      gridStyle: "DOTS",
      gridColor: "#334155",
      gridOpacity: 40,
      gridSpacing: 32,
      backgroundColor: "#0F172A",
      nodeStyle: "MIDNIGHT",
    };
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { canvas } });
    const visitor = await request(app).get(`/api/trees/${tree.id}`);
    expect(visitor.body.data.canvas).toEqual(canvas);
    const after = await prisma.tree.findUniqueOrThrow({ where: { id: tree.id } });
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  it("changes only the fields sent and resets colors with null", async () => {
    const { user, cookie } = await createLoggedInUser();
    const tree = await createTree(user.id);
    await prisma.tree.update({
      where: { id: tree.id },
      data: { gridColor: "#334155", backgroundColor: "#0F172A", gridOpacity: 50 },
    });

    const res = await request(app)
      .patch(`/api/trees/${tree.id}/canvas`)
      .set("Cookie", cookie)
      .send({ gridColor: null, backgroundColor: null });

    expect(res.body.data.canvas).toEqual({
      gridStyle: "LINES",
      gridColor: null,
      gridOpacity: 50,
      gridSpacing: 24,
      backgroundColor: null,
      nodeStyle: "MINIMAL",
    });
  });

  it("returns 400 VALIDATION_ERROR for an empty body, a bad value or another field", async () => {
    const { user, cookie } = await createLoggedInUser();
    const tree = await createTree(user.id);

    for (const body of [
      {},
      { gridStyle: "STRIPES" },
      { gridColor: "blue" },
      { gridOpacity: 101 },
      { gridOpacity: -1 },
      { gridOpacity: 50.5 },
      { gridSpacing: 11 },
      { gridSpacing: 65 },
      { nodeStyle: "NEON" },
      { title: "x" },
    ]) {
      const res = await request(app)
        .patch(`/api/trees/${tree.id}/canvas`)
        .set("Cookie", cookie)
        .send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("returns 404 TREE_NOT_FOUND for another user's tree (also an admin), a missing tree or a tree in the Trash", async () => {
    const { user, cookie } = await createLoggedInUser();
    const tree = await createTree(user.id, { visibility: "PUBLIC" });
    const { cookie: otherCookie } = await createLoggedInUser();
    const { cookie: adminCookie } = await createAdmin();

    for (const c of [otherCookie, adminCookie]) {
      const res = await request(app)
        .patch(`/api/trees/${tree.id}/canvas`)
        .set("Cookie", c)
        .send({ gridStyle: "NONE" });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("TREE_NOT_FOUND");
    }
    const missing = await request(app)
      .patch("/api/trees/nope/canvas")
      .set("Cookie", cookie)
      .send({ gridStyle: "NONE" });
    expect(missing.status).toBe(404);
    await prisma.tree.update({ where: { id: tree.id }, data: { deletedAt: new Date() } });
    const trashed = await request(app)
      .patch(`/api/trees/${tree.id}/canvas`)
      .set("Cookie", cookie)
      .send({ gridStyle: "NONE" });
    expect(trashed.status).toBe(404);
    const stored = await prisma.tree.findUniqueOrThrow({ where: { id: tree.id } });
    expect(stored.gridStyle).toBe("LINES");
  });

  it("lets the owner change a tree an admin removed", async () => {
    const { user, cookie } = await createLoggedInUser();
    const tree = await createTree(user.id);
    await prisma.tree.update({
      where: { id: tree.id },
      data: { removedAt: new Date(), removalReason: "Spam" },
    });

    const res = await request(app)
      .patch(`/api/trees/${tree.id}/canvas`)
      .set("Cookie", cookie)
      .send({ gridStyle: "DOTS" });

    expect(res.status).toBe(200);
  });

  it("returns 401 UNAUTHENTICATED for a guest", async () => {
    const { user } = await createLoggedInUser();
    const tree = await createTree(user.id);

    const res = await request(app)
      .patch(`/api/trees/${tree.id}/canvas`)
      .send({ gridStyle: "DOTS" });

    expect(res.status).toBe(401);
  });
});
