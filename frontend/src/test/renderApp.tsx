import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { vi } from "vitest";

import { createQueryClient } from "../api/queryClient";
import { ToastProvider } from "../components/Toast";
import { routes } from "../router";

type Reply = { status: number; body: unknown };
/** "METHOD /api/path" → 応答。関数なら送信本文を受け取って応答を返す */
export type ApiMock = Record<string, Reply | ((body: unknown) => Reply)>;

export const guestReply: Reply = {
  status: 401,
  body: { error: { code: "UNAUTHENTICATED", message: "Please log in" } },
};

/** fetch を差し替え、指定 URL でアプリ全体（ルーター込み）を描画する。テスト専用 */
export function renderApp(path: string, api: ApiMock) {
  const fetchMock = vi.fn((input: string, init?: RequestInit) => {
    const url = new URL(input, "http://localhost");
    const key = `${init?.method ?? "GET"} ${url.pathname}`;
    const entry = api[key];
    if (!entry) throw new Error(`Unmocked request: ${key}`);
    const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    const reply = typeof entry === "function" ? entry(body) : entry;
    return Promise.resolve(new Response(JSON.stringify(reply.body), { status: reply.status }));
  });
  vi.stubGlobal("fetch", fetchMock);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { router, fetchMock };
}
