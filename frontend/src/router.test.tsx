import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    renderAt("/", null);

    expect(await screen.findByTestId("landing-signup")).toBeInTheDocument();
  });

  it("shows Not Found for an unknown URL", async () => {
    renderAt("/does/not/exist", null);

    expect(await screen.findByText("This page doesn't exist or isn't public.")).toBeInTheDocument();
  });

  it("shows the logged-in navigation in the header", async () => {
    renderAt("/", alice);

    // ページへのリンクとログアウトは、ヘッダー中央の「Menu」を開いた中にある
    await userEvent.setup().click(await screen.findByTestId("menu-button"));
    expect(screen.getAllByRole("link", { name: "My Trees" })).not.toHaveLength(0);
    expect(screen.getByTestId("logout-button")).toBeInTheDocument();
  });
});

describe("light and dark mode", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("switches the theme from the header, remembers it in this browser and switches back", async () => {
    renderAt("/", null);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Switch to dark mode" }));
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("dark");

    await user.click(screen.getByRole("button", { name: "Switch to light mode" }));
    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("opens the menu (hidden but kept for its animation while closed) and closes it with Esc", async () => {
    renderAt("/", null);
    const user = userEvent.setup();

    // メニューは閉じるときも動かせるよう置いたままで、閉じている間は隠れて操作できない（aria-hidden / inert）
    const menu = screen.getByTestId("main-menu");
    expect(menu).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("link", { name: "Explore" })).not.toBeInTheDocument();

    await user.click(await screen.findByTestId("menu-button"));
    expect(menu).toHaveAttribute("data-open", "true");
    expect(screen.getByRole("link", { name: "Explore" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(menu).toHaveAttribute("data-open", "false");
    expect(menu).toHaveAttribute("inert");
  });
});
