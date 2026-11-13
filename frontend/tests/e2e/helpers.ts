import { execSync } from "node:child_process";
import path from "node:path";

import { type APIRequestContext, expect, type Page } from "@playwright/test";

import { E2E_BACKEND_ENV, SEED_PASSWORD } from "./env";

const backendDir = path.resolve(import.meta.dirname, "../../../backend");

/**
 * テストデータをシードの状態に戻す（E2E 専用DBに対してシードスクリプトを実行する）。
 * シードはシード用ユーザーのデータだけを作り直すので、テスト中に作った別ユーザーは残るが他のテストには影響しない。
 */
export function resetData(): void {
  execSync("npx --no-install tsx prisma/seed.ts", {
    cwd: backendDir,
    env: { ...process.env, ...E2E_BACKEND_ENV },
    stdio: "pipe",
  });
}

/** API でログインし、ページのブラウザコンテキストに認証 Cookie を持たせる（画面のログイン操作は auth.spec で確認する） */
export async function loginAs(page: Page, email: string, password = SEED_PASSWORD): Promise<void> {
  const res = await page.request.post("/api/auth/login", { data: { email, password } });
  expect(res.status(), `login as ${email}`).toBe(200);
}

/** ツリーの題名から ID を探す（ログイン中のユーザーのマイツリーから） */
export async function treeIdByTitle(request: APIRequestContext, title: string): Promise<string> {
  const res = await request.get("/api/trees?limit=50");
  const body = (await res.json()) as { data: { trees: { id: string; title: string }[] } };
  const tree = body.data.trees.find((t) => t.title === title);
  if (!tree) throw new Error(`tree not found: ${title}`);
  return tree.id;
}

/** API から見たノード（題名 → ノード） */
export async function nodesByTitle(
  request: APIRequestContext,
  treeId: string,
): Promise<
  Record<string, { id: string; parentId: string | null; positionX: number; positionY: number }>
> {
  const res = await request.get(`/api/trees/${treeId}`);
  const body = (await res.json()) as {
    data: {
      nodes: {
        id: string;
        title: string;
        parentId: string | null;
        positionX: number;
        positionY: number;
      }[];
    };
  };
  return Object.fromEntries(body.data.nodes.map((n) => [n.title, n]));
}

/** 重ならない一意な名前（新規登録のテスト用） */
export function uniqueName(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1000).toString(36)}`;
}
