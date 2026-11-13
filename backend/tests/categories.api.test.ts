import { MAX_CATEGORIES_PER_USER } from "@highdea/shared";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { prisma, resetDb } from "./helpers/db.js";
import { createCategory, createLoggedInUser, createTree } from "./helpers/factories.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** 上限テスト用に count 件のカテゴリをまとめて作る */
async function createManyCategories(userId: string, count: number): Promise<void> {
  await prisma.category.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      userId,
      name: `Cat ${String(i)}`,
      nameKey: `cat ${String(i)}`,
    })),
  });
}

describe("GET /api/categories", () => {
  it("returns only own categories sorted A–Z ignoring case, with tree counts excluding the Trash", async () => {
    const { user, cookie } = await createLoggedInUser();
    const other = await createLoggedInUser();
    const work = await createCategory(user.id, "work", "#FF8800");
    const art = await createCategory(user.id, "Art");
    const books = await createCategory(user.id, "books");
    await createCategory(other.user.id, "Aaa");
    await createTree(user.id, { categoryIds: [work.id, art.id] });
    await createTree(user.id, { categoryIds: [work.id] });
    await createTree(user.id, { categoryIds: [work.id], deletedAt: new Date() });

    const res = await request(app).get("/api/categories").set("Cookie", cookie);

    expect(res.status).toBe(200);
    const categories = res.body.data.categories as { name: string; treeCount: number }[];
    expect(categories.map((c) => [c.name, c.treeCount])).toEqual([
      ["Art", 1],
      ["books", 0],
      ["work", 2],
    ]);
    expect(res.body.data.categories[2]).toEqual({
      id: work.id,
      name: "work",
      color: "#FF8800",
      treeCount: 2,
      createdAt: work.createdAt.toISOString(),
      updatedAt: work.updatedAt.toISOString(),
    });
    expect(categories.some((c) => c.name === books.name)).toBe(true);
  });

  it("returns an empty list when the user has no categories", async () => {
    const { cookie } = await createLoggedInUser();
    const res = await request(app).get("/api/categories").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { categories: [] } });
  });

  it("returns 401 for guests and deactivated users", async () => {
    const guest = await request(app).get("/api/categories");
    expect(guest.status).toBe(401);
    expect(guest.body.error.code).toBe("UNAUTHENTICATED");

    const { cookie } = await createLoggedInUser({ deactivated: true });
    const deactivated = await request(app).get("/api/categories").set("Cookie", cookie);
    expect(deactivated.status).toBe(401);
    expect(deactivated.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("POST /api/categories", () => {
  it("creates a category with a trimmed name, lowercased nameKey and the given color", async () => {
    const { user, cookie } = await createLoggedInUser();

    const res = await request(app)
      .post("/api/categories")
      .set("Cookie", cookie)
      .send({ name: "  Work Ideas ", color: "#ff8800" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      data: {
        category: {
          id: expect.any(String),
          name: "Work Ideas",
          color: "#ff8800",
          treeCount: 0,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      },
    });
    const row = await prisma.category.findUniqueOrThrow({
      where: { id: res.body.data.category.id as string },
    });
    expect(row.userId).toBe(user.id);
    expect(row.nameKey).toBe("work ideas");
  });

  it("uses the default gray color when color is omitted", async () => {
    const { cookie } = await createLoggedInUser();
    const res = await request(app)
      .post("/api/categories")
      .set("Cookie", cookie)
      .send({ name: "Work" });
    expect(res.status).toBe(201);
    expect(res.body.data.category.color).toBe("#6B7280");
  });

  it("returns 409 CATEGORY_NAME_TAKEN for a name that differs only in case", async () => {
    const { user, cookie } = await createLoggedInUser();
    await createCategory(user.id, "Work");

    const res = await request(app)
      .post("/api/categories")
      .set("Cookie", cookie)
      .send({ name: " work " });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CATEGORY_NAME_TAKEN");
    expect(await prisma.category.count({ where: { userId: user.id } })).toBe(1);
  });

  it("allows the same name as another user's category", async () => {
    const other = await createLoggedInUser();
    await createCategory(other.user.id, "Work");
    const { cookie } = await createLoggedInUser();

    const res = await request(app)
      .post("/api/categories")
      .set("Cookie", cookie)
      .send({ name: "Work" });
    expect(res.status).toBe(201);
  });

  it("returns 409 CATEGORY_LIMIT_REACHED at 100 categories and allows the 100th", async () => {
    const { user, cookie } = await createLoggedInUser();
    await createManyCategories(user.id, MAX_CATEGORIES_PER_USER - 1);

    const hundredth = await request(app)
      .post("/api/categories")
      .set("Cookie", cookie)
      .send({ name: "Last" });
    expect(hundredth.status).toBe(201);

    const over = await request(app)
      .post("/api/categories")
      .set("Cookie", cookie)
      .send({ name: "One more" });
    expect(over.status).toBe(409);
    expect(over.body.error.code).toBe("CATEGORY_LIMIT_REACHED");
    expect(await prisma.category.count({ where: { userId: user.id } })).toBe(
      MAX_CATEGORIES_PER_USER,
    );
  });

  it("does not exceed the limit with simultaneous requests", async () => {
    const { user, cookie } = await createLoggedInUser();
    await createManyCategories(user.id, MAX_CATEGORIES_PER_USER - 1);

    const results = await Promise.all(
      ["A", "B", "C"].map((name) =>
        request(app).post("/api/categories").set("Cookie", cookie).send({ name }),
      ),
    );

    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    expect(await prisma.category.count({ where: { userId: user.id } })).toBe(
      MAX_CATEGORIES_PER_USER,
    );
  });

  it.each([
    ["nameKey", { name: "Work", nameKey: "hack" }, "body"],
    ["userId", { name: "Work", userId: "someone" }, "body"],
    ["missing name", {}, "name"],
    ["blank name", { name: "   " }, "name"],
    ["name over 50 characters", { name: "a".repeat(51) }, "name"],
    ["bad color", { name: "Work", color: "red" }, "color"],
    ["short color", { name: "Work", color: "#FFF" }, "color"],
  ])("returns 400 VALIDATION_ERROR for %s", async (_label, body, field) => {
    const { cookie } = await createLoggedInUser();

    const res = await request(app).post("/api/categories").set("Cookie", cookie).send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect((res.body.error.details as { field: string }[]).map((d) => d.field)).toContain(field);
    expect(await prisma.category.count()).toBe(0);
  });

  it("accepts a 50-character name", async () => {
    const { cookie } = await createLoggedInUser();
    const res = await request(app)
      .post("/api/categories")
      .set("Cookie", cookie)
      .send({ name: "a".repeat(50) });
    expect(res.status).toBe(201);
  });

  it("returns 401 for guests", async () => {
    const res = await request(app).post("/api/categories").send({ name: "Work" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("PATCH /api/categories/:id", () => {
  it("renames and recolors the category, updating nameKey, and returns the tree count", async () => {
    const { user, cookie } = await createLoggedInUser();
    const category = await createCategory(user.id, "Work");
    await createTree(user.id, { categoryIds: [category.id] });

    const res = await request(app)
      .patch(`/api/categories/${category.id}`)
      .set("Cookie", cookie)
      .send({ name: " Projects ", color: "#00AA00" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: {
        category: {
          id: category.id,
          name: "Projects",
          color: "#00AA00",
          treeCount: 1,
          createdAt: category.createdAt.toISOString(),
          updatedAt: expect.any(String),
        },
      },
    });
    const row = await prisma.category.findUniqueOrThrow({ where: { id: category.id } });
    expect(row.nameKey).toBe("projects");
  });

  it("changes only the color and keeps the name", async () => {
    const { user, cookie } = await createLoggedInUser();
    const category = await createCategory(user.id, "Work");

    const res = await request(app)
      .patch(`/api/categories/${category.id}`)
      .set("Cookie", cookie)
      .send({ color: "#123456" });

    expect(res.status).toBe(200);
    expect(res.body.data.category).toMatchObject({ name: "Work", color: "#123456" });
  });

  it("allows a case-only rename of the same category", async () => {
    const { user, cookie } = await createLoggedInUser();
    const category = await createCategory(user.id, "work");

    const res = await request(app)
      .patch(`/api/categories/${category.id}`)
      .set("Cookie", cookie)
      .send({ name: "Work" });

    expect(res.status).toBe(200);
    expect(res.body.data.category.name).toBe("Work");
  });

  it("returns 409 CATEGORY_NAME_TAKEN when another own category has the name", async () => {
    const { user, cookie } = await createLoggedInUser();
    await createCategory(user.id, "Work");
    const category = await createCategory(user.id, "Home");

    const res = await request(app)
      .patch(`/api/categories/${category.id}`)
      .set("Cookie", cookie)
      .send({ name: "WORK" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CATEGORY_NAME_TAKEN");
    const row = await prisma.category.findUniqueOrThrow({ where: { id: category.id } });
    expect(row.name).toBe("Home");
  });

  it("returns 404 CATEGORY_NOT_FOUND for another user's category and leaves it unchanged", async () => {
    const other = await createLoggedInUser();
    const category = await createCategory(other.user.id, "Work");
    const { cookie } = await createLoggedInUser();

    const res = await request(app)
      .patch(`/api/categories/${category.id}`)
      .set("Cookie", cookie)
      .send({ name: "Mine" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CATEGORY_NOT_FOUND");
    const row = await prisma.category.findUniqueOrThrow({ where: { id: category.id } });
    expect(row.name).toBe("Work");
  });

  it("returns 404 CATEGORY_NOT_FOUND for a missing category", async () => {
    const { cookie } = await createLoggedInUser();
    const res = await request(app)
      .patch("/api/categories/does-not-exist")
      .set("Cookie", cookie)
      .send({ name: "Mine" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CATEGORY_NOT_FOUND");
  });

  it.each([
    ["an empty body", {}],
    ["nameKey", { nameKey: "hack" }],
    ["userId", { name: "Work", userId: "someone" }],
    ["a blank name", { name: "  " }],
    ["a bad color", { color: "#GGGGGG" }],
  ])("returns 400 VALIDATION_ERROR for %s", async (_label, body) => {
    const { user, cookie } = await createLoggedInUser();
    const category = await createCategory(user.id, "Work");

    const res = await request(app)
      .patch(`/api/categories/${category.id}`)
      .set("Cookie", cookie)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 401 for guests", async () => {
    const { user } = await createLoggedInUser();
    const category = await createCategory(user.id, "Work");
    const res = await request(app).patch(`/api/categories/${category.id}`).send({ name: "X" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("DELETE /api/categories/:id", () => {
  it("deletes the category, removes its tags (also from trees in the Trash) and keeps the trees", async () => {
    const { user, cookie } = await createLoggedInUser();
    const category = await createCategory(user.id, "Work");
    const keep = await createCategory(user.id, "Keep");
    const active = await createTree(user.id, { categoryIds: [category.id, keep.id] });
    const trashed = await createTree(user.id, {
      categoryIds: [category.id],
      deletedAt: new Date(),
    });

    const res = await request(app).delete(`/api/categories/${category.id}`).set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: null });
    expect(await prisma.category.findUnique({ where: { id: category.id } })).toBeNull();
    expect(await prisma.treeCategory.count({ where: { categoryId: category.id } })).toBe(0);
    expect(await prisma.tree.count({ where: { id: { in: [active.id, trashed.id] } } })).toBe(2);
    expect(await prisma.treeCategory.findMany({ where: { treeId: active.id } })).toEqual([
      expect.objectContaining({ categoryId: keep.id }),
    ]);
  });

  it("returns 404 CATEGORY_NOT_FOUND for another user's category and keeps it", async () => {
    const other = await createLoggedInUser();
    const category = await createCategory(other.user.id, "Work");
    const { cookie } = await createLoggedInUser();

    const res = await request(app).delete(`/api/categories/${category.id}`).set("Cookie", cookie);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CATEGORY_NOT_FOUND");
    expect(await prisma.category.findUnique({ where: { id: category.id } })).not.toBeNull();
  });

  it("returns 404 CATEGORY_NOT_FOUND when deleting twice", async () => {
    const { user, cookie } = await createLoggedInUser();
    const category = await createCategory(user.id, "Work");

    await request(app).delete(`/api/categories/${category.id}`).set("Cookie", cookie);
    const again = await request(app).delete(`/api/categories/${category.id}`).set("Cookie", cookie);

    expect(again.status).toBe(404);
    expect(again.body.error.code).toBe("CATEGORY_NOT_FOUND");
  });

  it("returns 401 for guests", async () => {
    const { user } = await createLoggedInUser();
    const category = await createCategory(user.id, "Work");
    const res = await request(app).delete(`/api/categories/${category.id}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});
