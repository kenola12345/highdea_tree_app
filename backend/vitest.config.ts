import { defineConfig } from "vitest/config";

// テストは専用DB（.env.test の highdea_test）に対して実行する
process.loadEnvFile(".env.test");

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    // APIテストは同じDBを使うため、ファイル単位で順番に実行して干渉を防ぐ
    fileParallelism: false,
  },
});
