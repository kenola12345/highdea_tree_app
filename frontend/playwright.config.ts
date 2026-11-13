import { defineConfig, devices } from "@playwright/test";

// E2E はデスクトップとスマホ（タッチ操作）の両方で実行する（manifests/common.md §7.3）
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // 起動していなければ自動で立ち上げ、起動済みならそれを使う
  webServer: [
    {
      command: "npm run dev -w backend",
      cwd: "..",
      url: "http://localhost:3000/api/health",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "npm run dev -w frontend",
      cwd: "..",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
