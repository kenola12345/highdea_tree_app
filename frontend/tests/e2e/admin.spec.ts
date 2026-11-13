import { expect, test } from "@playwright/test";

import { loginAs, resetData } from "./helpers";

test.beforeAll(() => {
  resetData();
});

test("E2E-ADMIN-01 admin removes a public tree; the owner sees it removed and can't make it public", async ({
  page,
  browser,
}) => {
  await loginAs(page, "admin@example.com");
  await page.goto("/explore");
  await page.getByRole("link", { name: "Weekend projects" }).click();
  await page.getByTestId("viewer-remove").click();
  await page.getByLabel("Reason (shown to the owner)").fill("Off-topic content");
  await page.getByTestId("remove-tree-confirm").click();
  await expect(page.getByText("This page doesn't exist or isn't public.")).toBeVisible();

  await page.goto("/explore");
  await expect(page.getByTestId("tree-card").filter({ hasText: "Weekend projects" })).toHaveCount(
    0,
  );

  const bob = await browser.newPage();
  await loginAs(bob, "bob@example.com");
  await bob.goto("/me");
  const card = bob.getByTestId("tree-card").filter({ hasText: "Weekend projects" });
  await expect(card.getByTestId("visibility-badge")).toHaveText("Removed by admin");
  await card.getByTestId("tree-card-menu").click();
  await bob.getByRole("menuitem", { name: "Edit details" }).click();
  const modal = bob.getByTestId("tree-settings-modal");
  await expect(modal.getByTestId("removal-banner")).toContainText("Off-topic content");
  await expect(modal.getByRole("radio", { name: /Public/ })).toBeDisabled();
  await bob.close();
});
