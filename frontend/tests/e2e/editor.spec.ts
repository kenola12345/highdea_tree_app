import { expect, type Locator, type Page, test } from "@playwright/test";

import { loginAs, nodesByTitle, resetData, treeIdByTitle } from "./helpers";

let treeId = "";

test.beforeEach(async ({ page }) => {
  resetData();
  await loginAs(page, "alice@example.com");
  treeId = await treeIdByTitle(page.request, "Startup ideas");
  await page.goto(`/trees/${treeId}/edit`);
  await page.getByRole("button", { name: "Fit" }).click();
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
/** 線（つながり・枝）の中点の画面座標。最後の path が見えている線 */
async function lineMidpoint(line: Locator) {
  return line
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

const connectionMidpoint = (page: Page) =>
  lineMidpoint(page.getByTestId("connection-line").first());

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
  await page.getByRole("button", { name: "Fit" }).click();
  await expect(page.getByTestId("connection-line")).toHaveCount(1);
  await page.getByRole("link", { name: "View", exact: true }).click();
  await expect(page.getByTestId("connection-line")).toHaveCount(1);
  await page.goBack();
  await page.getByRole("button", { name: "Fit" }).click();

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

test("E2E-EDITOR-11 click a connection to change its color, kept after reload and shown in the Viewer", async ({
  page,
}) => {
  await card(page, "Students").click();
  await page.getByTestId("connect-node-button").click();
  await card(page, "Ideas get lost in Slack").click();
  await expect(page.getByTestId("connection-line")).toHaveAttribute("data-color", "#7A9283");

  const mid = await connectionMidpoint(page);
  await page.mouse.click(mid.x, mid.y);
  await page.getByTestId("connection-color-picker").fill("#ef4444");
  await expect(page.getByTestId("connection-line")).toHaveAttribute("data-color", "#EF4444");
  await expect(page.getByTestId("save-status")).toHaveText("Saved ✓");

  await page.reload();
  await expect(page.getByTestId("connection-line")).toHaveAttribute("data-color", "#EF4444");
  await page.getByRole("link", { name: "View", exact: true }).click();
  await expect(page.getByTestId("connection-line")).toHaveAttribute("data-color", "#EF4444");
  await page.goBack();
  await page.getByRole("button", { name: "Fit" }).click();

  // Default で灰色に戻す
  const again = await connectionMidpoint(page);
  await page.mouse.click(again.x, again.y);
  await page.getByTestId("connection-color-default").click();
  await expect(page.getByTestId("connection-line")).toHaveAttribute("data-color", "#7A9283");
  await expect(page.getByTestId("connection-color-default")).toHaveCount(0);
});

test("E2E-EDITOR-12 click a branch line to change its color; the lines below it follow", async ({
  page,
}) => {
  const problemId = (await nodesByTitle(page.request, treeId)).Problem?.id ?? "";
  const branch = page.locator(`[data-testid=node-link][data-branch-id="${problemId}"]`);
  const mid = await lineMidpoint(branch);
  await page.mouse.click(mid.x, mid.y);
  await expect(page.getByTestId("branch-toolbar")).toBeVisible();
  await expect(branch).toHaveAttribute("data-selected", "true");

  await page.getByTestId("branch-color-picker").fill("#ef4444");
  await expect(page.locator('[data-testid=node-link][data-color="#EF4444"]')).toHaveCount(4);
  await expect(page.getByTestId("save-status")).toHaveText("Saved ✓");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("branch-toolbar")).toHaveCount(0);

  await page.reload();
  await expect(page.locator('[data-testid=node-link][data-color="#EF4444"]')).toHaveCount(4);
});

test("E2E-EDITOR-27 click a branch line to label it; the label stays after reload, can be undone and cleared", async ({
  page,
}) => {
  const problemId = (await nodesByTitle(page.request, treeId)).Problem?.id ?? "";
  const branch = page.locator(`[data-testid=node-link][data-branch-id="${problemId}"]`);
  const mid = await lineMidpoint(branch);
  await page.mouse.click(mid.x, mid.y);
  await page.getByTestId("branch-label-input").fill("  because ");
  await page.getByTestId("branch-label-input").press("Enter");
  await expect(branch.getByTestId("line-label")).toHaveText("because");
  await expect(page.getByTestId("save-status")).toHaveText("Saved ✓");
  await expect
    .poll(async () => (await nodesByTitle(page.request, treeId)).Problem?.lineLabel)
    .toBe("because");

  // 元に戻すと消え、やり直すと戻る
  await page.getByTestId("undo-button").click();
  await expect(branch.getByTestId("line-label")).toHaveCount(0);
  await page.getByTestId("redo-button").click();
  await expect(branch.getByTestId("line-label")).toHaveText("because");
  await expect(page.getByTestId("save-status")).toHaveText("Saved ✓");

  await page.reload();
  await expect(branch.getByTestId("line-label")).toHaveText("because");

  // 札を押しても線が選べ、欄を空にすると消える
  await branch.getByTestId("line-label").click();
  await page.getByTestId("branch-label-input").fill("");
  await page.getByTestId("branch-label-input").press("Enter");
  await expect(branch.getByTestId("line-label")).toHaveCount(0);
  await expect(page.getByTestId("save-status")).toHaveText("Saved ✓");
});

test("E2E-EDITOR-13 drag a corner handle to resize a card; the size is kept after reload", async ({
  page,
}) => {
  const target = card(page, "Students");
  await target.click();
  const before = await target.boundingBox();
  const handle = page.getByTestId("resize-handle-se");
  const h = await handle.boundingBox();
  if (!before || !h) throw new Error("no boxes");

  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 + 80, h.y + h.height / 2 + 60, { steps: 8 });
  await expect(page.getByTestId("resize-size-label")).toBeVisible();
  await page.mouse.up();
  await expect(page.getByTestId("save-status")).toHaveText("Saved ✓");

  const after = await target.boundingBox();
  if (!after) throw new Error("no box");
  expect(after.width).toBeGreaterThan(before.width + 40);
  expect(after.height).toBeGreaterThan(before.height + 30);
  // 反対（左上）の角は動かない
  expect(Math.abs(after.x - before.x)).toBeLessThan(3);
  expect(Math.abs(after.y - before.y)).toBeLessThan(3);

  const res = await page.request.get(`/api/trees/${treeId}`);
  const body = (await res.json()) as {
    data: { nodes: { title: string; width: number | null; height: number | null }[] };
  };
  const students = body.data.nodes.find((n) => n.title === "Students");
  expect(students?.width).toBeGreaterThan(200);
  expect(students?.height).toBeGreaterThan(84);

  await page.reload();
  await page.getByRole("button", { name: "Fit" }).click();
  await expect(card(page, "Students")).toBeVisible();
});

test("E2E-EDITOR-14 pick a Circle shape and a size in M-04; Auto returns to the default size", async ({
  page,
}) => {
  await card(page, "Students").dblclick();
  const editor = page.getByTestId("node-editor-modal");
  await editor.getByTestId("shape-ELLIPSE").click();
  await editor.getByLabel(/^Width/).fill("140");
  await editor.getByLabel(/^Height/).fill("140");
  await editor.getByTestId("node-save").click();
  await expect(editor).toHaveCount(0);

  await page.reload();
  await page.getByRole("button", { name: "Fit" }).click();
  await expect(card(page, "Students")).toHaveAttribute("data-shape", "ELLIPSE");
  const box = await card(page, "Students").boundingBox();
  if (!box) throw new Error("no box");
  expect(Math.abs(box.width - box.height)).toBeLessThan(2);

  // 範囲外はエラーで保存しない
  await card(page, "Students").dblclick();
  await editor.getByLabel(/^Width/).fill("20");
  await editor.getByTestId("node-save").click();
  await expect(editor.getByTestId("node-width-error")).toBeVisible();
  await editor.getByTestId("node-size-auto").click();
  await editor.getByTestId("node-save").click();
  await expect(editor).toHaveCount(0);
  const nodes = await page.request.get(`/api/trees/${treeId}`);
  const data = (await nodes.json()) as {
    data: { nodes: { title: string; shape: string; width: number | null }[] };
  };
  expect(data.data.nodes.find((n) => n.title === "Students")).toMatchObject({
    shape: "ELLIPSE",
    width: null,
  });
});

test("E2E-EDITOR-15 the Canvas panel changes the grid style, color, opacity and background for visitors too", async ({
  page,
}) => {
  const grid = page.getByTestId("grid-background");
  await expect(grid).toHaveAttribute("data-grid-style", "LINES");

  await page.getByTestId("canvas-button").click();
  const panel = page.getByTestId("canvas-panel");
  await panel.getByTestId("grid-style-DOTS").click();
  await panel.locator("#canvas-grid-color").fill("#334155");
  await panel.getByTestId("canvas-grid-opacity").fill("40");
  // 変更はまとめて少し後に保存されるので、保存のリクエストを待つ
  const saved = page.waitForResponse(
    (r) => r.url().endsWith(`/api/trees/${treeId}/canvas`) && r.request().method() === "PATCH",
  );
  await panel.locator("#canvas-background").fill("#0F172A");
  await expect(grid).toHaveAttribute("data-grid-style", "DOTS");
  await expect(grid).toHaveAttribute("fill", "#0F172A");
  await expect(grid).toHaveAttribute("data-grid-opacity", "40");
  expect((await saved).request().postDataJSON()).toEqual({
    gridStyle: "DOTS",
    gridColor: "#334155",
    gridOpacity: 40,
    backgroundColor: "#0F172A",
  });

  await page.reload();
  await expect(grid).toHaveAttribute("data-grid-style", "DOTS");
  await expect(grid).toHaveAttribute("data-grid-color", "#334155");
  await page.getByRole("link", { name: "View", exact: true }).click();
  await expect(page.getByTestId("grid-background")).toHaveAttribute("fill", "#0F172A");
  await page.goBack();

  await page.getByTestId("canvas-button").click();
  await page.getByTestId("canvas-reset").click();
  await expect(grid).toHaveAttribute("data-grid-style", "LINES");
  // 閉じると、待っている変更をすぐ保存する
  const reset = page.waitForResponse(
    (r) => r.url().endsWith(`/api/trees/${treeId}/canvas`) && r.request().method() === "PATCH",
  );
  await page.getByTestId("canvas-panel-close").click();
  await expect(page.getByTestId("canvas-panel")).toHaveCount(0);
  expect((await reset).ok()).toBe(true);
  await page.reload();
  await expect(grid).toHaveAttribute("data-grid-style", "LINES");
});

test("E2E-EDITOR-16 dark mode switches the app but not the canvas, and is kept after reload; Edit | View switches pages", async ({
  page,
}) => {
  const grid = page.getByTestId("grid-background");
  const before = await grid.getAttribute("fill");
  const rootCard = page.getByTestId("node-card").filter({ hasText: "Startup ideas" }).first();
  const rootColor = await rootCard.evaluate((el) => getComputedStyle(el).backgroundColor);

  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  // キャンバスの色は所有者が決めるので、テーマでは変わらない
  await expect(grid).toHaveAttribute("fill", before ?? "");
  expect(await rootCard.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(rootColor);

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.getByTestId("mode-view").click();
  await expect(page).toHaveURL(new RegExp(`/trees/${treeId}$`));
  await page.getByTestId("mode-edit").click();
  await expect(page).toHaveURL(new RegExp(`/trees/${treeId}/edit$`));

  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("E2E-EDITOR-17 set a text size and color in M-04; the card uses them after reload", async ({
  page,
}) => {
  await card(page, "Students").dblclick();
  const editor = page.getByTestId("node-editor-modal");
  await editor.getByLabel("Note (optional)").fill("Students lose their notes between classes.");
  await editor.getByLabel("Text size").fill("18");
  await expect(editor.getByTestId("node-font-size-value")).toHaveText("18px");
  await editor.locator("#node-text-color").fill("#B91C1C");
  await editor.getByTestId("node-save").click();
  await expect(editor).toHaveCount(0);

  await page.reload();
  await page.getByRole("button", { name: "Fit" }).click();
  const students = card(page, "Students");
  await expect(students).toHaveCSS("color", "rgb(185, 28, 28)");
  const nodes = await page.request.get(`/api/trees/${treeId}`);
  const data = (await nodes.json()) as {
    data: { nodes: { title: string; fontSize: number | null; textColor: string | null }[] };
  };
  expect(data.data.nodes.find((n) => n.title === "Students")).toMatchObject({
    fontSize: 18,
    textColor: "#B91C1C",
  });
});

test("E2E-EDITOR-18 undo and redo a move with the keyboard", async ({ page }) => {
  const before = (await nodesByTitle(page.request, treeId)).Students;
  await drag(page, card(page, "Students"), { dx: -150, dy: -60 });
  await expect(page.getByTestId("save-status")).toHaveText("Saved ✓");
  const moved = (await nodesByTitle(page.request, treeId)).Students;
  expect(moved?.positionX).not.toBe(before?.positionX);
  await expect(page.getByTestId("undo-button")).toHaveAttribute("aria-label", "Undo Move idea");

  await page.keyboard.press("ControlOrMeta+z");
  await expect
    .poll(async () => (await nodesByTitle(page.request, treeId)).Students?.positionX)
    .toBe(before?.positionX);

  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect
    .poll(async () => (await nodesByTitle(page.request, treeId)).Students?.positionX)
    .toBe(moved?.positionX);
});

test("E2E-EDITOR-19 undo brings back a deleted branch with its connection; redo deletes it again", async ({
  page,
}) => {
  // 消す枝（Problem）の中のアイデアと、別の枝のアイデアをつないでおく
  await card(page, "Ideas get lost in Slack").click();
  await page.getByTestId("connect-node-button").click();
  await card(page, "Students").click();
  await expect(page.getByTestId("connection-line")).toHaveCount(1);

  await card(page, "Problem").click();
  await page.getByTestId("delete-node-button").click();
  await expect(page.getByTestId("delete-node-modal")).toContainText("You can undo this");
  await page.getByTestId("confirm-button").click();
  await expect(card(page, "Problem")).toHaveCount(0);
  await expect(page.getByTestId("node-counter")).toContainText("16 / 2,000");
  await expect(page.getByTestId("undo-button")).toHaveAttribute("aria-label", "Undo Delete branch");

  await page.getByTestId("undo-button").click();
  await expect(card(page, "Problem")).toBeVisible();
  await expect(card(page, "Ideas get lost in Slack")).toBeVisible();
  await expect(page.getByTestId("node-counter")).toContainText("20 / 2,000");
  await expect(page.getByTestId("connection-line")).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId("node-counter")).toContainText("20 / 2,000");

  // 再読み込みで履歴は消える（セッションの間だけ）
  await expect(page.getByTestId("undo-button")).toBeDisabled();
});

test("E2E-EDITOR-20 the History list jumps back and forward through edits", async ({ page }) => {
  const rename = async (from: string, to: string) => {
    await card(page, from).dblclick();
    const editor = page.getByTestId("node-editor-modal");
    await editor.getByLabel("Title").fill(to);
    await editor.getByTestId("node-save").click();
    await expect(editor).toHaveCount(0);
    await expect(page.getByTestId("save-status")).toHaveText("Saved ✓");
  };
  await rename("Students", "Learners");
  await rename("Learners", "Pupils");

  await page.getByTestId("history-button").click();
  await expect(page.getByTestId("history-step")).toHaveCount(2);
  await page.getByRole("button", { name: "Opened" }).click();
  await expect(card(page, "Students")).toBeVisible();
  await expect(page.getByTestId("redo-button")).toBeEnabled();

  // 一覧は開いたまま（Photoshop の履歴と同じ）。最後の手を押すとそこまでやり直す
  await page.getByTestId("history-step").last().click();
  await expect(card(page, "Pupils")).toBeVisible();
  await expect
    .poll(async () => Boolean((await nodesByTitle(page.request, treeId)).Pupils))
    .toBe(true);
});

test("E2E-EDITOR-21 give an idea a kind and a long sectioned note; it collapses with Show more", async ({
  page,
}) => {
  await card(page, "Students").dblclick();
  const editor = page.getByTestId("node-editor-modal");
  await editor.getByTestId("kind-IMPORTANT").click();
  const lines = Array.from({ length: 12 }, (_, i) => `Detail ${String(i)} about students.`);
  await editor
    .getByLabel("Note (optional)")
    .fill(`What: who we build for\n${lines.join("\n")}\nRemember: keep it simple`);
  await editor.getByTestId("node-save").click();
  await expect(editor).toHaveCount(0);

  const students = card(page, "Students");
  await expect(students).toHaveAttribute("data-role", "IMPORTANT");
  // カードの中身（印・メモ・Show more）は読める倍率で出るので、カードの上でホイールを回して拡大する
  const box = await students.boundingBox();
  if (!box) throw new Error("no box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -200);
  await expect(students.getByTestId("card-expand")).toBeVisible();
  await expect(students.getByTestId("card-role")).toHaveText(/Important/);
  const toggle = students.getByTestId("card-expand");
  await expect(toggle).toHaveText(/Show more/);
  const before = await students.boundingBox();
  await toggle.click();
  await expect(toggle).toHaveText(/Show less/);
  const after = await students.boundingBox();
  expect(after?.height ?? 0).toBeGreaterThan((before?.height ?? 0) + 40);
  // 広げても選択や編集にはならない
  await expect(page.getByTestId("node-editor-modal")).toHaveCount(0);
});

test("E2E-EDITOR-22 change a connection's relationship type and swap its direction", async ({
  page,
}) => {
  await card(page, "Students").click();
  await page.getByTestId("connect-node-button").click();
  await card(page, "Ideas get lost in Slack").click();
  const line = page.getByTestId("connection-line");
  await expect(line).toHaveAttribute("data-kind", "RELATED");

  const mid = await connectionMidpoint(page);
  await page.mouse.click(mid.x, mid.y);
  await page.getByTestId("connection-kind").selectOption("SEQUENCE");
  await expect(line).toHaveAttribute("data-kind", "SEQUENCE");
  await expect(line.getByTestId("connection-arrow")).toHaveCount(1);
  const tipBefore = await line.getByTestId("connection-arrow").getAttribute("d");
  await page.getByTestId("connection-swap").click();
  await expect(line.getByTestId("connection-arrow")).not.toHaveAttribute("d", tipBefore ?? "");
  await expect(page.getByTestId("save-status")).toHaveText("Saved ✓");

  await page.reload();
  await expect(page.getByTestId("connection-line")).toHaveAttribute("data-kind", "SEQUENCE");
  await expect(page.getByTestId("connection-arrow")).toHaveAttribute("d", /.+/);
});

test("E2E-EDITOR-23 a node style preset changes cards but not the canvas; selecting an idea dims the rest", async ({
  page,
}) => {
  const grid = page.getByTestId("grid-background");
  const canvasFill = await grid.getAttribute("fill");
  const plain = card(page, "Team plan");
  const before = await plain.evaluate((el) => getComputedStyle(el).backgroundColor);

  await page.getByTestId("canvas-button").click();
  const saved = page.waitForResponse(
    (r) => r.url().endsWith(`/api/trees/${treeId}/canvas`) && r.request().method() === "PATCH",
  );
  await page.getByTestId("node-style-MIDNIGHT").click();
  await page.getByTestId("canvas-grid-spacing").fill("40");
  expect((await saved).request().postDataJSON()).toEqual({
    nodeStyle: "MIDNIGHT",
    gridSpacing: 40,
  });
  await expect
    .poll(() => plain.evaluate((el) => getComputedStyle(el).backgroundColor))
    .not.toBe(before);
  await expect(grid).toHaveAttribute("fill", canvasFill ?? "");

  // Reset canvas は方眼などだけを戻し、カードのプリセットはそのまま
  await page.getByTestId("canvas-reset").click();
  await page.getByTestId("canvas-panel-close").click();
  await expect
    .poll(async () => {
      const res = await page.request.get(`/api/trees/${treeId}`);
      const body = (await res.json()) as {
        data: { canvas: { nodeStyle: string; gridSpacing: number } };
      };
      return `${body.data.canvas.nodeStyle}/${String(body.data.canvas.gridSpacing)}`;
    })
    .toBe("MIDNIGHT/24");

  await card(page, "Problem").click();
  await expect(card(page, "Problem")).not.toHaveAttribute("data-dimmed", "true");
  await expect(card(page, "Students")).toHaveAttribute("data-dimmed", "true");
  await expect(card(page, "Ideas get lost in Slack")).not.toHaveAttribute("data-dimmed", "true");
});

test("E2E-EDITOR-24 Tidy up removes overlapping cards in one undoable step", async ({ page }) => {
  // 重なりを作る: 2つのアイデアを同じ場所へ
  const nodes = await nodesByTitle(page.request, treeId);
  await page.request.patch(`/api/trees/${treeId}/nodes/positions`, {
    data: {
      nodes: [
        { id: nodes.Students?.id, positionX: 300, positionY: 300 },
        { id: nodes.Problem?.id, positionX: 310, positionY: 310 },
      ],
    },
  });
  await page.reload();
  await page.getByRole("button", { name: "Fit" }).click();

  const overlaps = async () =>
    page.evaluate(() => {
      const boxes = [...document.querySelectorAll('[data-testid="node-card"]')].map((el) =>
        el.getBoundingClientRect(),
      );
      let count = 0;
      boxes.forEach((a, i) => {
        boxes.slice(i + 1).forEach((b) => {
          if (
            a.left < b.right - 1 &&
            b.left < a.right - 1 &&
            a.top < b.bottom - 1 &&
            b.top < a.bottom - 1
          )
            count += 1;
        });
      });
      return count;
    });
  expect(await overlaps()).toBeGreaterThan(0);

  await page.getByTestId("tidy-button").click();
  await expect(page.getByTestId("save-status")).toHaveText("Saved ✓");
  await expect.poll(overlaps).toBe(0);
  await expect(page.getByTestId("undo-button")).toHaveAttribute("aria-label", "Undo Tidy up");

  await page.getByTestId("undo-button").click();
  await expect
    .poll(async () => (await nodesByTitle(page.request, treeId)).Students?.positionX)
    .toBe(300);
});

test("E2E-EDITOR-25 add a box from + Add by drawing it around an idea, label it, resize it with edge auto-scroll, drag it anywhere with the idea, delete it and undo", async ({
  page,
}) => {
  const nodesBefore = await nodesByTitle(page.request, treeId);
  const problem = await card(page, "Problem").boundingBox();
  if (!problem) throw new Error("no card");

  await page.getByTestId("add-button").click();
  await page.getByTestId("add-BOX").click();
  await expect(page.getByTestId("place-banner")).toContainText("drag to draw");
  // カードを囲むように四角を描く
  await page.mouse.move(problem.x - 40, problem.y - 60);
  await page.mouse.down();
  await page.mouse.move(problem.x + problem.width + 40, problem.y + problem.height + 40, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(page.getByTestId("place-banner")).toHaveCount(0);
  await expect(page.getByTestId("group-toolbar")).toBeVisible();
  // ボックスには題名を出さない（ツールバーにも題名の欄がない）
  await expect(page.getByTestId("group-title")).toHaveCount(0);
  await expect(page.getByTestId("group-title-input")).toHaveCount(0);
  await expect(page.getByTestId("group-label")).toHaveCount(0);
  // ラベルを付けると左上に札が出る
  await page.getByTestId("group-label-input").fill("Pain points");
  await page.getByTestId("group-label-input").press("Enter");
  await expect(page.getByTestId("group-label")).toHaveText("Pain points");
  await expect(page.getByTestId("save-status")).toHaveText("Saved ✓");

  // 下の角を画面の下端まで引っぱって止めると、キャンバスが自動でスクロールし、そのぶん大きくなる
  const canvasBox = await page.getByTestId("tree-canvas").boundingBox();
  const handle = await page.getByTestId("resize-handle-se").boundingBox();
  const before = await card(page, "Problem").boundingBox();
  if (!canvasBox || !handle || !before) throw new Error("no canvas");
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2, canvasBox.y + canvasBox.height - 4, {
    steps: 8,
  });
  await expect
    .poll(async () => (await card(page, "Problem").boundingBox())?.y ?? before.y)
    .toBeLessThan(before.y - 60);
  await page.mouse.up();
  await expect(page.getByTestId("save-status")).toHaveText("Saved ✓");

  // ボックスのどこ（中のアイデア以外）を押してもドラッグでき、中のアイデアも一緒に動く
  const body = page.locator("[data-group-header]").first();
  const h = await body.boundingBox();
  if (!h) throw new Error("no box");
  await page.mouse.move(h.x + 15, h.y + h.height - 15);
  await page.mouse.down();
  await page.mouse.move(h.x + 15 - 120, h.y + h.height - 15 + 40, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByTestId("save-status")).toHaveText("Saved ✓");
  await expect
    .poll(async () => (await nodesByTitle(page.request, treeId)).Problem?.positionX)
    .not.toBe(nodesBefore.Problem?.positionX);

  // 消してもアイデアは残り、元に戻すとボックスが戻る
  await page.keyboard.press("Escape");
  await page
    .locator("[data-group-header]")
    .first()
    .click({ position: { x: 15, y: 15 } });
  await page.getByTestId("delete-group-button").click();
  await expect(page.getByTestId("group-box")).toHaveCount(0);
  await expect(card(page, "Problem")).toBeVisible();
  await page.getByTestId("undo-button").click();
  await expect(page.getByTestId("group-box")).toHaveCount(1);
  await expect(page.getByTestId("group-label")).toHaveText("Pain points");
});

test("E2E-EDITOR-26 + Add places an idea, a sticky note and a text label where you click", async ({
  page,
}) => {
  const canvas = page.getByTestId("tree-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("no canvas");

  // アイデア: 種類を選んでクリックした場所に、題名を入れて置く
  await page.getByTestId("add-button").click();
  await page.getByTestId("add-LINK").click();
  await page.mouse.click(box.x + 120, box.y + 120);
  const modal = page.getByTestId("add-branch-modal");
  await expect(modal.getByTestId("type-LINK")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("branch-title-input").fill("Docs");
  await page.getByTestId("branch-submit").click();
  await expect(page.getByTestId("node-editor-modal")).toBeVisible();
  await page.getByTestId("node-editor-modal").getByRole("button", { name: "Cancel" }).click();
  await expect
    .poll(async () => Boolean((await nodesByTitle(page.request, treeId)).Docs))
    .toBe(true);

  // 付箋: 置いて文を書く
  await page.getByTestId("add-button").click();
  await page.getByTestId("add-NOTE").click();
  await page.mouse.click(box.x + box.width - 200, box.y + 160);
  await page.getByTestId("group-body-input").fill("Ask Bob about pricing");
  await page.getByTestId("group-body-input").blur();
  await expect(page.getByTestId("canvas-note")).toContainText("Ask Bob about pricing");

  // 文字: 置いて題名を変える。Esc で選択を外す
  await page.getByTestId("add-button").click();
  await page.getByTestId("add-LABEL").click();
  await page.mouse.click(box.x + box.width / 2, box.y + 90);
  await page.getByTestId("group-title-input").fill("Phase 1");
  await page.getByTestId("group-title-input").press("Enter");
  await expect(page.getByTestId("canvas-label")).toContainText("Phase 1");
  await expect(page.getByTestId("save-status")).toHaveText("Saved ✓");

  await page.reload();
  await expect(page.getByTestId("canvas-note")).toContainText("Ask Bob about pricing");
  await expect(page.getByTestId("canvas-label")).toContainText("Phase 1");
});
