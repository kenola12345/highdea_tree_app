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

test("E2E-EDITOR-06 a branch line color colors that branch and is kept after reload", async ({
  page,
}) => {
  await card(page, "Problem").dblclick();
  await page.locator("#line-color").fill("#EF4444");
  await page.getByTestId("node-save").click();
  await expect(page.getByTestId("node-editor-modal")).toHaveCount(0);

  await page.reload();
  await expect(page.locator('[data-testid=node-link][data-color="#EF4444"]')).toHaveCount(4);
  const nodes = await nodesByTitle(page.request, treeId);
  expect(nodes.Problem).toBeDefined();
});

test("E2E-EDITOR-07 a card color picked in M-04 colors that card, including the center idea", async ({
  page,
}) => {
  await card(page, "Startup ideas").dblclick();
  await page.locator("#card-color").fill("#1E3A8A");
  await page.getByTestId("node-save").click();
  await expect(page.getByTestId("node-editor-modal")).toHaveCount(0);

  await page.reload();
  await expect(card(page, "Startup ideas")).toHaveCSS("background-color", "rgb(30, 58, 138)");
  await expect(card(page, "Startup ideas")).toHaveCSS("color", "rgb(255, 255, 255)");
});

test("E2E-EDITOR-08 branch lines have no end dots, and View opens the Tree Viewer", async ({
  page,
}) => {
  await expect(page.getByTestId("node-link").first()).toBeVisible();
  await expect(page.getByTestId("node-link").locator("circle")).toHaveCount(0);

  await page.getByRole("link", { name: "View", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/trees/${treeId}$`));
});

/** つながりの線の中点（画面座標）。曲線の長さの半分の点を SVG から画面へ変換する */
async function connectionMidpoint(page: Page) {
  return page
    .getByTestId("connection-line")
    .first()
    .locator("path")
    .last()
    .evaluate((el) => {
      const path = el as SVGPathElement;
      const p = path.getPointAtLength(path.getTotalLength() / 2);
      const m = path.getScreenCTM();
      if (!m) throw new Error("no CTM");
      return { x: p.x * m.a + p.y * m.c + m.e, y: p.x * m.b + p.y * m.d + m.f };
    });
}

test("E2E-EDITOR-09 connect two ideas from different branches, see it in the Viewer, then remove it", async ({
  page,
}) => {
  await card(page, "Students").click();
  await page.getByTestId("connect-node-button").click();
  await expect(page.getByTestId("connect-banner")).toContainText("connect it to “Students”");
  await card(page, "Ideas get lost in Slack").click();
  await expect(page.getByTestId("connect-banner")).toHaveCount(0);
  await expect(page.getByTestId("connection-line")).toHaveCount(1);

  // 同じ組はもう一度つながない
  await card(page, "Ideas get lost in Slack").click();
  await page.getByTestId("connect-node-button").click();
  await card(page, "Students").click();
  await expect(page.getByText("These ideas are already connected.")).toBeVisible();

  await page.reload();
  await page.getByText("Fit").click();
  await expect(page.getByTestId("connection-line")).toHaveCount(1);
  await page.getByRole("link", { name: "View", exact: true }).click();
  await expect(page.getByTestId("connection-line")).toHaveCount(1);
  await page.goBack();
  await page.getByText("Fit").click();

  const mid = await connectionMidpoint(page);
  await page.mouse.click(mid.x, mid.y);
  await page.getByTestId("remove-connection-button").click();
  await expect(page.getByTestId("connection-line")).toHaveCount(0);
  await page.reload();
  await expect(card(page, "Students")).toBeVisible();
  await expect(page.getByTestId("connection-line")).toHaveCount(0);
});

test("E2E-EDITOR-10 Esc or clicking the background cancels connecting", async ({ page }) => {
  await card(page, "Students").click();
  await page.getByTestId("connect-node-button").click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("connect-banner")).toHaveCount(0);

  await card(page, "Students").click();
  await page.getByTestId("connect-node-button").click();
  await page.getByTestId("connect-cancel").click();
  await expect(page.getByTestId("connect-banner")).toHaveCount(0);
  await expect(page.getByTestId("connection-line")).toHaveCount(0);
});
