import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma, resetDb } from "./db.js";
import { createCategory, createNodes, createTree, createUpload, createUser } from "./factories.js";

// 後続 Phase のテストが頼るファクトリ自体の確認
beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("test factories", () => {
  it("creates a tree with exactly one root node and category tags", async () => {
    const user = await createUser();
    const category = await createCategory(user.id, "Work");

    const tree = await createTree(user.id, { visibility: "PUBLIC", categoryIds: [category.id] });
    await createNodes(tree.id, tree.rootId, 3);

    const nodes = await prisma.node.findMany({ where: { treeId: tree.id } });
    expect(nodes).toHaveLength(4);
    expect(nodes.filter((n) => n.parentId === null)).toHaveLength(1);
    expect(category.nameKey).toBe("work");
    await expect(prisma.treeCategory.count({ where: { treeId: tree.id } })).resolves.toBe(1);
  });

  it("creates removed and trashed trees as private", async () => {
    const admin = await createUser({ role: "ADMIN" });
    const owner = await createUser();

    const removed = await createTree(owner.id, {
      visibility: "PUBLIC",
      removed: { byId: admin.id },
    });
    const trashed = await createTree(owner.id, { deletedAt: new Date() });

    expect(removed).toMatchObject({ visibility: "PRIVATE", removedById: admin.id });
    expect(trashed.deletedAt).toBeInstanceOf(Date);
  });

  it("the DB refuses a second root node in the same tree", async () => {
    const user = await createUser();
    const tree = await createTree(user.id);

    await expect(
      prisma.node.create({ data: { treeId: tree.id, title: "Second root" } }),
    ).rejects.toThrow();
  });

  it("creates an upload record with a random storage key", async () => {
    const user = await createUser();

    const upload = await createUpload(user.id);

    expect(upload.storageKey).toMatch(/^[0-9a-f-]{36}\.png$/);
  });
});
