import { expect, test } from "@playwright/test";

import { loginAs, resetData, treeIdByTitle } from "./helpers";

test.beforeAll(() => {
  resetData();
});

test.describe("Explore, viewer and profiles (guest)", () => {
  test("E2E-EXPLORE-01 search and category chip filter the public feed", async ({ page }) => {
    await page.goto("/explore");
    await expect(page.getByTestId("tree-card")).toHaveCount(3);

    await page.getByTestId("explore-search").fill("typescript");
    await expect(page).toHaveURL(/q=typescript/);
    await expect(page.getByTestId("tree-card")).toHaveCount(1);
    await expect(page.getByTestId("tree-card")).toContainText("Learning TypeScript");

    await page.getByRole("button", { name: "Clear search" }).click();
    await page.getByTestId("category-chips").getByRole("button", { name: /^Work/ }).click();
    await expect(page).toHaveURL(/category=work/);
    await expect(page.getByTestId("tree-card")).toHaveCount(2);
  });

  test("E2E-EXPLORE-02 open a tree in the viewer, then the owner's profile", async ({ page }) => {
    await page.goto("/explore");
    await page.getByRole("link", { name: "Startup ideas" }).click();
    await expect(page.getByTestId("viewer-title")).toHaveText("Startup ideas");
    await expect(page.getByTestId("node-card").first()).toBeVisible();
    await expect(page.getByTestId("mode-edit")).toHaveCount(0);

    await page.getByRole("link", { name: "Alice Chen" }).click();
    await expect(page).toHaveURL(/\/u\/alice$/);
    await expect(page.getByRole("heading", { name: "Alice Chen" })).toBeVisible();
    await expect(page.getByTestId("profile-trees").getByTestId("tree-card")).toHaveCount(2);
  });

  test("E2E-EXPLORE-03 a private tree URL shows Not Found to others", async ({ page, browser }) => {
    const alice = await browser.newPage();
    await loginAs(alice, "alice@example.com");
    const privateId = await treeIdByTitle(alice.request, "Personal goals");
    await alice.close();

    await page.goto(`/trees/${privateId}`);
    await expect(page.getByText("This page doesn't exist or isn't public.")).toBeVisible();
  });
});

test.describe("viewer details and links (guest)", () => {
  test("E2E-EXPLORE-04 clicking an idea opens its details; a link idea can be opened in a new tab", async ({
    page,
    context,
  }) => {
    await page.goto("/explore");
    await page.getByRole("link", { name: "Startup ideas" }).click();
    await page.getByTestId("node-card").filter({ hasText: "Pricing" }).first().click();
    await expect(page.getByTestId("node-details")).toContainText(
      "Free for personal use; team plan later.",
    );
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("node-details")).toHaveCount(0);

    await page.locator("[data-node-type=LINK]").first().click();
    const open = page.getByTestId("node-details").getByTestId("open-link");
    await expect(open).toHaveAttribute("target", "_blank");
    await expect(open).toHaveAttribute("href", /^https:\/\//);
    const href = await open.getAttribute("href");
    await context.route("**/*", (route) =>
      route.request().url().startsWith("https://")
        ? route.fulfill({ body: "ok" })
        : route.continue(),
    );
    const [popup] = await Promise.all([context.waitForEvent("page"), open.click()]);
    expect(popup.url()).toBe(href);
  });
});
