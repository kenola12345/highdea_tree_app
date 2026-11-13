import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "./api/queryClient";
import { ToastProvider } from "./components/Toast";
import { routes } from "./router";

const alice = {
  id: "u1",
  email: "alice@example.com",
  username: "alice",
  displayName: "Alice",
  avatarUrl: null,
  role: "USER",
  createdAt: "2026-11-01T00:00:00Z",
};

/** /api/auth/me の応答を決めてアプリを指定 URL で描画する */
function renderAt(path: string, me: typeof alice | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() =>
      Promise.resolve(
        me
          ? new Response(JSON.stringify({ data: { user: me } }), { status: 200 })
          : new Response(
              JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Please log in" } }),
              {
                status: 401,
              },
            ),
      ),
    ),
  );
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return router;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("route guards", () => {
  it("sends a guest from a login-required page to /login with next", async () => {
    const router = renderAt("/me?page=2", null);

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent("/me?page=2")}`);
  });

  it("sends a logged-in user from /login to /me", async () => {
    const router = renderAt("/login", alice);

    expect(await screen.findByRole("heading", { name: "My Trees" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/me");
  });

  it("lets anyone open public pages", async () => {
    renderAt("/explore", null);

    expect(await screen.findByRole("heading", { name: "Explore" })).toBeInTheDocument();
  });

  it("shows Not Found for an unknown URL", async () => {
    renderAt("/does/not/exist", null);

    expect(await screen.findByText("This page doesn't exist or isn't public.")).toBeInTheDocument();
  });

  it("shows the logged-in navigation in the header", async () => {
    renderAt("/explore", alice);

    expect(await screen.findAllByRole("link", { name: "My Trees" })).not.toHaveLength(0);
    expect(screen.getByTestId("logout-button")).toBeInTheDocument();
  });
});
