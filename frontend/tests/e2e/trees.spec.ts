import { expect, test } from "@playwright/test";

import { loginAs, resetData, treeIdByTitle } from "./helpers";

test.beforeAll(() => {
  resetData();
});

test.beforeEach(async ({ page }) => {
  await loginAs(page, "alice@example.com");
});

test.describe("My Trees and Trash", () => {
  test("E2E-TREES-01 create a tree (M-01) opens the editor with the center idea", async ({
    page,
  }) => {
    await page.goto("/me");
    await page.getByTestId("new-tree-button").first().click();
    await page.getByLabel("Title").fill("Garden plans");
    await page.getByTestId("create-tree-submit").click();

    await expect(page).toHaveURL(/\/trees\/\w+\/edit$/);
    await expect(page.getByTestId("editor-title")).toHaveText("Garden plans");
    await expect(page.getByTestId("node-card").filter({ hasText: "Garden plans" })).toBeVisible();
  });

  test("E2E-TREES-02 edit details (M-02) updates the card", async ({ page }) => {
    await page.goto("/me");
    const card = page.getByTestId("tree-card").filter({ hasText: "Personal goals" });
    await card.getByTestId("tree-card-menu").click();
    await page.getByRole("menuitem", { name: "Edit details" }).click();
    await page.getByLabel("Description (optional)").fill("Goals for next year.");
    await page.getByTestId("tree-settings-save").click();

    await expect(card).toContainText("Goals for next year.");
  });

  test("E2E-TREES-03 move to Trash (M-03) and restore from the Trash (P-09)", async ({ page }) => {
    await page.goto("/me");
    const card = page.getByTestId("tree-card").filter({ hasText: "Learning TypeScript" });
    await card.getByTestId("tree-card-menu").click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(page.getByTestId("move-to-trash-modal")).toContainText("in Trash for 10 days");
    await page.getByTestId("confirm-button").click();
    await expect(card).toHaveCount(0);

    await page.getByRole("link", { name: "Trash" }).first().click();
    const item = page.getByTestId("trash-item").filter({ hasText: "Learning TypeScript" });
    await expect(item.getByTestId("days-left")).toHaveText("10 days left");
    await item.getByTestId("restore-button").click();
    await expect(item).toHaveCount(0);

    await page.getByRole("link", { name: "My Trees" }).first().click();
    await expect(
      page.getByTestId("tree-card").filter({ hasText: "Learning TypeScript" }),
    ).toBeVisible();
  });

  test("E2E-TREES-04 delete one tree forever from the Trash (M-13)", async ({ page }) => {
    resetData();
    await page.goto("/trash");
    const item = page.getByTestId("trash-item").filter({ hasText: "Old brainstorm" });
    await item.getByTestId("delete-forever-button").click();
    const modal = page.getByTestId("delete-forever-modal");
    await expect(modal).toContainText("“Old brainstorm” will be deleted permanently");
    await expect(modal).toContainText("This can't be undone.");
    await modal.getByTestId("confirm-button").click();

    await expect(page.getByText("Trash is empty")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Trash is empty")).toBeVisible();
  });

  test("E2E-TREES-05 Empty Trash deletes every tree in the Trash (M-13)", async ({ page }) => {
    resetData();
    const id = await treeIdByTitle(page.request, "Personal goals");
    expect((await page.request.delete(`/api/trees/${id}`)).status()).toBe(200);

    await page.goto("/trash");
    await expect(page.getByTestId("trash-item")).toHaveCount(2);
    const emptyButton = page.getByTestId("empty-trash-button");
    await expect(emptyButton).toHaveCSS("cursor", "pointer");
    await emptyButton.click();
    const modal = page.getByTestId("delete-forever-modal");
    await expect(modal).toContainText("All 2 trees in the Trash will be deleted permanently.");
    await modal.getByTestId("confirm-button").click();

    await expect(page.getByText("Trash is empty")).toBeVisible();
    const res = await page.request.get("/api/trash");
    const body = (await res.json()) as { data: { pagination: { total: number } } };
    expect(body.data.pagination.total).toBe(0);
  });
});
