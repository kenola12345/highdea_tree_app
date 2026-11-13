import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// /api と /uploads をバックエンドへ中継し、ブラウザからは同一オリジンに見せる。
// SameSite=Lax の認証 Cookie を常に送らせるため（manifests/common.md §7.4, §9）
// E2E テストでは専用のバックエンド（別ポート・別DB）へ向けるため、BACKEND_URL で上書きできる
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": BACKEND_URL,
      "/uploads": BACKEND_URL,
    },
  },
});
