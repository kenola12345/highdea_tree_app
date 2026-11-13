import { type CDPSession, expect, type Page, test } from "@playwright/test";

import { loginAs, nodesByTitle, resetData, treeIdByTitle } from "./helpers";

let treeId = "";
let cdp: CDPSession;

test.beforeEach(async ({ page }) => {
  resetData();
  await loginAs(page, "alice@example.com");
  treeId = await treeIdByTitle(page.request, "Startup ideas");
  await page.goto(`/trees/${treeId}/edit`);
  await expect(page.getByTestId("node-card").first()).toBeVisible();
  cdp = await page.context().newCDPSession(page);
});

/** 実機に近いタッチ操作（Chrome DevTools Protocol 経由） */
function touch(type: "touchStart" | "touchMove" | "touchEnd", points: [number, number][]) {
  return cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: points.map(([x, y], id) => ({ x, y, id })),
  });
}

async function centerOf(page: Page, title: string): Promise<[number, number]> {
  const box = await page.getByTestId("node-card").filter({ hasText: title }).first().boundingBox();
  if (!box) throw new Error(`no card ${title}`);
  return [box.x + box.width / 2, box.y + box.height / 2];
}

test.describe("tree editor (phone)", () => {
  test("E2E-EDITOR-M01 long-press lifts the node and the drag saves its position", async ({
    page,
  }) => {
    const before = (await nodesByTitle(page.request, treeId)).Students;
    const [x, y] = await centerOf(page, "Students");

    await touch("touchStart", [[x, y]]);
    await page.waitForTimeout(450);
    for (let i = 1; i <= 10; i++) {
      await touch("touchMove", [[x + i * 6, y + i * 8]]);
    }
    await touch("touchEnd", []);

    await expect(page.getByTestId("save-status")).toHaveText("Saved ✓");
    await expect
      .poll(async () => (await nodesByTitle(page.request, treeId)).Students?.positionY)
      .not.toBe(before?.positionY);
  });

  test("E2E-EDITOR-M02 a quick swipe that starts on a node pans instead of moving it", async ({
    page,
  }) => {
    const before = (await nodesByTitle(page.request, treeId)).Market;
    const [x, y] = await centerOf(page, "Market");

    await touch("touchStart", [[x, y]]);
    for (let i = 1; i <= 8; i++) {
      await touch("touchMove", [[x - i * 10, y + i * 6]]);
    }
    await touch("touchEnd", []);

    const [x2, y2] = await centerOf(page, "Market");
    expect(Math.round(x2 - x)).toBe(-80);
    expect(Math.round(y2 - y)).toBe(48);
    const after = (await nodesByTitle(page.request, treeId)).Market;
    expect(after?.positionX).toBe(before?.positionX);
    expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1);
  });
});
