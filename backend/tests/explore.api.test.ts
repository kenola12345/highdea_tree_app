import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { prisma, resetDb } from "./helpers/db.js";
import { createAdmin, createCategory, createTree, createUser } from "./helpers/factories.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** updatedAt を固定して並び順を確認できるようにする */
async function setUpdatedAt(treeId: string, iso: string): Promise<void> {
  await prisma.tree.update({ where: { id: treeId }, data: { updatedAt: new Date(iso) } });
}

/** 一覧のツリーIDを並び順のまま取り出す */
function ids(res: request.Response): string[] {
  return (res.body.data.trees as { id: string }[]).map((t) => t.id);
}

describe("GET /api/explore", () => {
  it("returns only public trees, newest first, with owner and categories", async () => {
    const owner = await createUser({ username: "alice", displayName: "Alice" });
    const other = await createUser();
    const deactivated = await createUser({ deactivated: true });
    const admin = await createUser({ role: "ADMIN" });
    const category = await createCategory(owner.id, "Work", "#FF0000");

    const older = await createTree(owner.id, {
      title: "Older",
      visibility: "PUBLIC",
      categoryIds: [category.id],
    });
    const newer = await createTree(other.id, { title: "Newer", visibility: "PUBLIC" });
    await createTree(owner.id, { title: "Private" });
    await createTree(owner.id, { visibility: "PUBLIC", removed: { byId: admin.id } });
    await createTree(owner.id, { visibility: "PUBLIC", deletedAt: new Date() });
    await createTree(deactivated.id, { visibility: "PUBLIC" });
    await setUpdatedAt(older.id, "2026-01-01T00:00:00Z");
    await setUpdatedAt(newer.id, "2026-02-01T00:00:00Z");

    const res = await request(app).get("/api/explore");

    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([newer.id, older.id]);
    expect(res.body.data.pagination).toEqual({ page: 1, limit: 20, total: 2 });
    expect(res.body.data.trees[1]).toEqual({
      id: older.id,
      title: "Older",
      description: null,
      categories: [{ id: category.id, name: "Work", color: "#FF0000" }],
      nodeCount: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
      owner: { username: "alice", displayName: "Alice", avatarUrl: null },
    });
  });

  it("does not show private trees to admins or their owners", async () => {
    const { user: admin, cookie: adminCookie } = await createAdmin();
    await createTree(admin.id, { title: "Admin private" });
    const owner = await createUser();
    await createTree(owner.id, { title: "Owner private" });

    const res = await request(app).get("/api/explore").set("Cookie", adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.trees).toEqual([]);
    expect(res.body.data.pagination.total).toBe(0);
  });

  it("searches title and description ignoring case", async () => {
    const owner = await createUser();
    const byTitle = await createTree(owner.id, { title: "Garden PLANS", visibility: "PUBLIC" });
    const byDescription = await createTree(owner.id, { visibility: "PUBLIC" });
    await prisma.tree.update({
      where: { id: byDescription.id },
      data: { description: "Ideas for the garden" },
    });
    await createTree(owner.id, { title: "Cooking", visibility: "PUBLIC" });
    await createTree(owner.id, { title: "Garden secret" });

    const res = await request(app).get("/api/explore").query({ q: "  gArDeN " });

    expect(res.status).toBe(200);
    expect(ids(res).sort()).toEqual([byTitle.id, byDescription.id].sort());
  });

  it("treats % and _ in q as plain characters", async () => {
    const owner = await createUser();
    const match = await createTree(owner.id, { title: "100% fun", visibility: "PUBLIC" });
    await createTree(owner.id, { title: "100 fun", visibility: "PUBLIC" });

    const res = await request(app).get("/api/explore").query({ q: "0%" });

    expect(ids(res)).toEqual([match.id]);
  });

  it("filters by category name across users ignoring case, combined with q", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const aliceWork = await createCategory(alice.id, "Work");
    const bobWork = await createCategory(bob.id, "WORK");
    const bobHome = await createCategory(bob.id, "Home");
    const a = await createTree(alice.id, {
      title: "Plan A",
      visibility: "PUBLIC",
      categoryIds: [aliceWork.id],
    });
    const b = await createTree(bob.id, {
      title: "Plan B",
      visibility: "PUBLIC",
      categoryIds: [bobWork.id, bobHome.id],
    });
    await createTree(bob.id, { title: "Plan C", visibility: "PUBLIC", categoryIds: [bobHome.id] });
    await createTree(alice.id, { title: "Plan D", categoryIds: [aliceWork.id] });

    const byCategory = await request(app).get("/api/explore").query({ category: "Work" });
    expect(byCategory.status).toBe(200);
    expect(ids(byCategory).sort()).toEqual([a.id, b.id].sort());

    const combined = await request(app).get("/api/explore").query({ category: "work", q: "b" });
    expect(ids(combined)).toEqual([b.id]);

    const none = await request(app).get("/api/explore").query({ category: "nothing" });
    expect(none.status).toBe(200);
    expect(none.body.data.trees).toEqual([]);
  });

  it("paginates with page and limit", async () => {
    const owner = await createUser();
    const created: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const tree = await createTree(owner.id, { visibility: "PUBLIC" });
      await setUpdatedAt(tree.id, `2026-01-0${String(i)}T00:00:00Z`);
      created.unshift(tree.id);
    }

    const res = await request(app).get("/api/explore").query({ page: 2, limit: 2 });

    expect(res.status).toBe(200);
    expect(ids(res)).toEqual(created.slice(2, 4));
    expect(res.body.data.pagination).toEqual({ page: 2, limit: 2, total: 5 });
  });

  it.each([
    ["empty q", { q: "   " }],
    ["q over 100 characters", { q: "a".repeat(101) }],
    ["empty category", { category: "" }],
    ["category over 50 characters", { category: "a".repeat(51) }],
    ["page 0", { page: 0 }],
    ["limit over 50", { limit: 51 }],
    ["non-integer limit", { limit: "abc" }],
  ])("returns 400 VALIDATION_ERROR for %s", async (_label, query) => {
    const res = await request(app).get("/api/explore").query(query);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/explore/categories", () => {
  it("groups names across users, counts only public trees and sorts by count", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const carol = await createUser();
    const gone = await createUser({ deactivated: true });
    const admin = await createUser({ role: "ADMIN" });
    const aliceWork = await createCategory(alice.id, "work");
    const bobWork = await createCategory(bob.id, "Work");
    const carolWork = await createCategory(carol.id, "Work");
    const aliceHome = await createCategory(alice.id, "Home");
    const aliceSecret = await createCategory(alice.id, "Secret");
    const goneWork = await createCategory(gone.id, "WORK");

    await createTree(alice.id, { visibility: "PUBLIC", categoryIds: [aliceWork.id, aliceHome.id] });
    await createTree(bob.id, { visibility: "PUBLIC", categoryIds: [bobWork.id] });
    await createTree(carol.id, { visibility: "PUBLIC", categoryIds: [carolWork.id] });
    // 以下は数えない: 非公開・非公開化済み・ゴミ箱・退会ユーザー
    await createTree(alice.id, { categoryIds: [aliceSecret.id, aliceHome.id] });
    await createTree(alice.id, {
      visibility: "PUBLIC",
      removed: { byId: admin.id },
      categoryIds: [aliceHome.id],
    });
    await createTree(alice.id, {
      visibility: "PUBLIC",
      deletedAt: new Date(),
      categoryIds: [aliceHome.id],
    });
    await createTree(gone.id, { visibility: "PUBLIC", categoryIds: [goneWork.id] });

    const res = await request(app).get("/api/explore/categories");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: {
        categories: [
          { key: "work", name: "Work", treeCount: 3 },
          { key: "home", name: "Home", treeCount: 1 },
        ],
      },
    });
  });

  it("on a tie, shows the spelling that starts with a capital letter", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const aliceWork = await createCategory(alice.id, "work");
    const bobWork = await createCategory(bob.id, "Work");
    await createTree(alice.id, { visibility: "PUBLIC", categoryIds: [aliceWork.id] });
    await createTree(bob.id, { visibility: "PUBLIC", categoryIds: [bobWork.id] });

    const res = await request(app).get("/api/explore/categories");

    expect(res.status).toBe(200);
    expect(res.body.data.categories).toEqual([{ key: "work", name: "Work", treeCount: 2 }]);
  });

  it("filters by name prefix ignoring case and applies limit", async () => {
    const owner = await createUser();
    const names = ["Travel", "Tech", "Tea_time", "Art"];
    const cats = await Promise.all(names.map((n) => createCategory(owner.id, n)));
    for (const cat of cats) {
      await createTree(owner.id, { visibility: "PUBLIC", categoryIds: [cat.id] });
    }

    const prefixed = await request(app).get("/api/explore/categories").query({ q: " T " });
    expect(prefixed.status).toBe(200);
    const keys = (prefixed.body.data.categories as { key: string }[]).map((c) => c.key);
    expect(keys).toEqual(["tea_time", "tech", "travel"]);

    // _ はワイルドカードではなく文字として扱う
    const literal = await request(app).get("/api/explore/categories").query({ q: "tea_" });
    expect(literal.body.data.categories).toEqual([
      { key: "tea_time", name: "Tea_time", treeCount: 1 },
    ]);

    const limited = await request(app).get("/api/explore/categories").query({ limit: 2 });
    expect(limited.body.data.categories).toHaveLength(2);
  });

  it.each([
    ["empty q", { q: " " }],
    ["q over 50 characters", { q: "a".repeat(51) }],
    ["limit 0", { limit: 0 }],
    ["limit over 50", { limit: 51 }],
  ])("returns 400 VALIDATION_ERROR for %s", async (_label, query) => {
    const res = await request(app).get("/api/explore/categories").query(query);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
