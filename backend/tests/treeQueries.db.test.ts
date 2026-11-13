import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "../src/lib/prisma.js";
import { publicTreeWhere, visibleTreeWhere } from "../src/services/common/treeAccess.js";
import { treeListSelect } from "../src/services/common/treeMapper.js";

// 共通のツリー検索条件・取得列が Prisma に受け付けられることを実DB（highdea_test）で確認する。
// 公開条件の中身の検証は、テスト用ファクトリができる Phase 3 以降の各APIテストで行う。
describe("shared tree queries", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("runs publicTreeWhere with treeListSelect", async () => {
    const rows = await prisma.tree.findMany({
      where: publicTreeWhere,
      select: treeListSelect,
      take: 1,
    });

    expect(Array.isArray(rows)).toBe(true);
  });

  it("runs visibleTreeWhere for a guest and for a logged-in viewer", async () => {
    await expect(prisma.tree.count({ where: visibleTreeWhere() })).resolves.toBeGreaterThanOrEqual(
      0,
    );
    await expect(
      prisma.tree.count({ where: visibleTreeWhere("someone") }),
    ).resolves.toBeGreaterThanOrEqual(0);
  });
});
