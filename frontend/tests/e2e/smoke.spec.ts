import { expect, test } from "@playwright/test";

// フロントエンドとバックエンド（プロキシ経由）が両方起動していることの確認
test("the app loads and the API is reachable through the proxy", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Highdea Tree" })).toBeVisible();

  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ data: { ok: true } });
});
