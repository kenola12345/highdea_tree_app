import { expect, type Locator, type Page, test } from "@playwright/test";

import { loginAs, nodesByTitle, resetData, treeIdByTitle } from "./helpers";

let treeId = "";

test.beforeEach(async ({ page }) => {
  resetData();
  await loginAs(page, "alice@example.com");
  treeId = await treeIdByTitle(page.request, "Startup ideas");
  await page.goto(`/trees/${treeId}/edit`);
  await page.getByText("Fit").click();
});

const card = (page: Page, title: string) =>
  page.getByTestId("node-card").filter({ hasText: title }).first();

/** マウスでカードの中心から別の位置（またはカード）までドラッグする */
async function drag(page: Page, from: Locator, to: Locator | { dx: number; dy: number }) {
  const a = await from.boundingBox();
  if (!a) throw new Error("no source box");
  const start = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  let end: { x: number; y: number };
  if ("dx" in to) end = { x: start.x + to.dx, y: start.y + to.dy };
  else {
    const b = await to.boundingBox();
    if (!b) throw new Error("no target box");
    end = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
}

test.describe("tree editor (desktop)", () => {
  test("E2E-EDITOR-01 add a branch (M-05 → M-04) as a link with a preview", async ({ page }) => {
    await card(page, "Startup ideas").click();
    await page.keyboard.press("Tab");
    await page.getByTestId("type-LINK").click();
    await page.getByTestId("branch-title-input").fill("Competitors");
    await page.getByTestId("branch-submit").click();

    const editor = page.getByTestId("node-editor-modal");
    await expect(editor.getByTestId("type-LINK")).toHaveAttribute("aria-checked", "true");
    await editor.getByLabel("URL").fill("https://example.com/");
    // プレビューは外部サイトの取得結果次第なので、カードが出ること（取得できなくても表示される）だけを確認する
    await expect(editor.getByTestId("link-preview")).toBeVisible({ timeout: 10_000 });
    await editor.getByTestId("node-save").click();
    await expect(editor).toHaveCount(0);

    await expect(card(page, "Competitors")).toHaveAttribute("data-node-type", "LINK");
    const nodes = await nodesByTitle(page.request, treeId);
    expect(nodes.Competitors).toBeDefined();
  });

  test("E2E-EDITOR-02 drag a node: the new position is kept after reload", async ({ page }) => {
    const before = (await nodesByTitle(page.request, treeId)).Students;
    await drag(page, card(page, "Students"), { dx: -150, dy: -60 });
    await expect(page.getByTestId("save-status")).toHaveText("Saved ✓");

    await page.reload();
    const after = (await nodesByTitle(page.request, treeId)).Students;
    expect(after?.positionX).not.toBe(before?.positionX);
    expect(after?.positionY).not.toBe(before?.positionY);
  });

  test("E2E-EDITOR-03 drop a node onto another to re-parent it", async ({ page }) => {
    await drag(page, card(page, "Free tier"), card(page, "Market"));
    await expect(page.getByTestId("save-status")).toHaveText("Saved ✓");

    const nodes = await nodesByTitle(page.request, treeId);
    expect(nodes["Free tier"]?.parentId).toBe(nodes.Market?.id);
  });

  test("E2E-EDITOR-04 delete a branch (M-06) after the count confirmation", async ({ page }) => {
    await card(page, "Problem").click();
    await page.getByTestId("delete-node-button").click();
    await expect(page.getByTestId("delete-node-modal")).toContainText(
      "Delete this idea and 3 ideas under it?",
    );
    await page.getByTestId("confirm-button").click();

    await expect(card(page, "Problem")).toHaveCount(0);
    await expect(page.getByTestId("node-counter")).toContainText("16 / 2,000");
  });

  test("E2E-EDITOR-05 the center idea has no Delete action", async ({ page }) => {
    await card(page, "Startup ideas").click();

    await expect(page.getByTestId("node-toolbar")).toBeVisible();
    await expect(page.getByTestId("delete-node-button")).toHaveCount(0);
  });
});
