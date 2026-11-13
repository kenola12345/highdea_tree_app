import { defineConfig, devices } from "@playwright/test";

import {
  E2E_BACKEND_ENV,
  E2E_BACKEND_PORT,
  E2E_BASE_URL,
  E2E_FRONTEND_PORT,
} from "./tests/e2e/env";

/**
 * E2E はデスクトップとスマホ（タッチ操作）で実行する（manifests/common.md §7.3）。
 * 開発用サーバーとは別に、専用のバックエンド（:3100・DB highdea_e2e）とフロントエンド（:5174）を起動する。
 * テストはデータを書き換えるので、1件ずつ順番に実行する。
 */
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /(mobile|smoke)\.spec\.ts/ },
  ],
  webServer: [
    {
      command: "npx --no-install tsx src/server.ts",
      cwd: "../backend",
      env: E2E_BACKEND_ENV,
      url: `http://localhost:${String(E2E_BACKEND_PORT)}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx --no-install vite --port ${String(E2E_FRONTEND_PORT)} --strictPort`,
      cwd: ".",
      env: { BACKEND_URL: `http://localhost:${String(E2E_BACKEND_PORT)}` },
      url: E2E_BASE_URL,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
