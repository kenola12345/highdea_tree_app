import { expect, test } from "@playwright/test";

import { loginAs, resetData, uniqueName } from "./helpers";

test.beforeAll(() => {
  resetData();
});

test.describe("settings", () => {
  test("E2E-SETTINGS-01 change the display name", async ({ page }) => {
    await loginAs(page, "alice@example.com");
    await page.goto("/settings");
    await page.getByLabel("Display name").fill("Alice C.");
    await page.getByTestId("profile-save").click();

    await expect(page.getByText("Profile saved")).toBeVisible();
    // ヘッダーのアカウントのアイコン（アバター）の名前に新しい表示名が入る
    await expect(page.getByRole("banner").getByRole("link", { name: /Alice C\./ })).toBeVisible();
  });

  test("E2E-SETTINGS-02 create, rename and delete a category", async ({ page }) => {
    await loginAs(page, "alice@example.com");
    await page.goto("/settings?tab=categories");
    await page.getByTestId("new-category-button").click();
    await page.getByLabel("Name").fill("Travel");
    await page.getByTestId("category-save").click();
    const row = page.getByTestId("category-row").filter({ hasText: "Travel" });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Name").fill("Trips");
    await page.getByTestId("category-save").click();
    const renamed = page.getByTestId("category-row").filter({ hasText: "Trips" });
    await expect(renamed).toBeVisible();

    await renamed.getByRole("button", { name: "Delete" }).click();
    await page.getByTestId("confirm-button").click();
    await expect(page.getByTestId("category-row").filter({ hasText: "Trips" })).toHaveCount(0);
  });

  test("E2E-SETTINGS-03 change the password, log in with it, then delete the account (M-11)", async ({
    page,
  }) => {
    const name = uniqueName("e2e");
    const signup = await page.request.post("/api/auth/signup", {
      data: {
        email: `${name}@example.com`,
        username: name,
        displayName: "Settings User",
        password: "password123",
      },
    });
    expect(signup.status()).toBe(201);

    await page.goto("/settings?tab=account");
    const passwordForm = page.getByTestId("password-form");
    await passwordForm.getByLabel("Current password").fill("password123");
    await passwordForm.getByLabel("New password").fill("newpassword456");
    await page.getByTestId("password-save").click();
    await expect(page.getByText("Password changed")).toBeVisible();

    await page.getByTestId("menu-button").click();
    await page.getByTestId("logout-button").click();
    await expect(page.getByTestId("landing-signup")).toBeVisible();
    await loginAs(page, `${name}@example.com`, "newpassword456");

    await page.goto("/settings?tab=account");
    await page.getByTestId("delete-account-button").click();
    await page.getByLabel("Enter your password to confirm").fill("newpassword456");
    await page.getByTestId("delete-account-confirm").click();
    await expect(page.getByTestId("landing-signup")).toBeVisible();

    const login = await page.request.post("/api/auth/login", {
      data: { email: `${name}@example.com`, password: "newpassword456" },
    });
    expect(login.status()).toBe(401);
  });
});
