import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { purgeTrash } from "../../src/jobs/purgeTrash.js";
import { prisma, resetDb } from "../helpers/db.js";
import { createCategory, createNodes, createTree, createUser } from "../helpers/factories.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-13T03:00:00.000Z");

/** NOW から days 日前の日時 */
function daysBefore(days: number): Date {
  return new Date(NOW.getTime() - days * DAY_MS);
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("purgeTrash", () => {
  it("deletes only trees in the Trash for more than 10 days, with their nodes and tags", async () => {
    const user = await createUser();
    const category = await createCategory(user.id);
    const expired = await createTree(user.id, {
      deletedAt: new Date(daysBefore(10).getTime() - 1),
      categoryIds: [category.id],
    });
    await createNodes(expired.id, expired.rootId, 3);
    const boundary = await createTree(user.id, { deletedAt: daysBefore(10) });
    const recent = await createTree(user.id, { deletedAt: daysBefore(9) });
    const active = await createTree(user.id);

    const count = await purgeTrash(NOW);

    expect(count).toBe(1);
    const remaining = await prisma.tree.findMany({ select: { id: true } });
    expect(remaining.map((t) => t.id).sort()).toEqual([boundary.id, recent.id, active.id].sort());
    expect(await prisma.node.count({ where: { treeId: expired.id } })).toBe(0);
    expect(await prisma.treeCategory.count({ where: { treeId: expired.id } })).toBe(0);
    expect(await prisma.category.count()).toBe(1);
  });

  it("returns 0 when nothing has expired", async () => {
    const user = await createUser();
    await createTree(user.id, { deletedAt: daysBefore(1) });

    await expect(purgeTrash(NOW)).resolves.toBe(0);
  });
});
