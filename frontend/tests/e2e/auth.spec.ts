import { expect, test } from "@playwright/test";

import { SEED_PASSWORD } from "./env";
import { loginAs, resetData, uniqueName } from "./helpers";

test.beforeAll(() => {
  resetData();
});

test.describe("auth", () => {
  test("E2E-AUTH-01 sign up logs you in and opens My Trees", async ({ page }) => {
    const name = uniqueName("e2e");
    await page.goto("/signup");
    await page.getByLabel("Email").fill(`${name}@example.com`);
    await page.getByLabel("Username").fill(name);
    await page.getByLabel("Display name").fill("E2E User");
    await page.getByLabel("Password").fill("password123");
    await page.getByTestId("signup-submit").click();

    await expect(page).toHaveURL(/\/me$/);
    await expect(page.getByRole("heading", { name: "My Trees" })).toBeVisible();
    await expect(page.getByText("Create your first tree")).toBeVisible();
  });

  test("E2E-AUTH-02 a guest opening a login-required page logs in and comes back", async ({
    page,
  }) => {
    await page.goto("/trash");
    await expect(page).toHaveURL(/\/login\?next=%2Ftrash$/);

    await page.getByLabel("Email").fill("alice@example.com");
    await page.getByLabel("Password").fill(SEED_PASSWORD);
    await page.getByTestId("login-submit").click();

    await expect(page).toHaveURL(/\/trash$/);
    await expect(page.getByRole("heading", { name: "Trash" })).toBeVisible();
  });

  test("E2E-AUTH-03 wrong credentials show one message", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("alice@example.com");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByTestId("login-submit").click();

    await expect(page.getByTestId("login-error")).toHaveText("Email or password is incorrect");
  });

  test("E2E-AUTH-04 a logged-in user opening /login goes to My Trees", async ({ page }) => {
    await loginAs(page, "alice@example.com");
    await page.goto("/login");

    await expect(page).toHaveURL(/\/me$/);
  });

  test("E2E-AUTH-05 log out returns to the landing page as a guest", async ({ page }) => {
    await loginAs(page, "alice@example.com");
    await page.goto("/settings");
    await page.getByTestId("menu-button").click();
    await page.getByTestId("logout-button").click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("landing-signup")).toBeVisible();
  });
});
