import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { guestReply, renderApp } from "../../test/renderApp";

const exploreTree = {
  id: "t1",
  title: "Startup ideas",
  description: "Brainstorm",
  categories: [{ id: "c1", name: "Work", color: "#2563EB" }],
  nodeCount: 20,
  updatedAt: "2026-11-10T00:00:00Z",
  owner: { username: "alice", displayName: "Alice Chen", avatarUrl: null },
};
const feed = (trees: unknown[]) => ({
  status: 200,
  body: { data: { trees, pagination: { page: 1, limit: 20, total: trees.length } } },
});
const chips = {
  status: 200,
  body: {
    data: {
      categories: [
        { key: "work", name: "Work", treeCount: 2 },
        { key: "learning", name: "Learning", treeCount: 1 },
      ],
    },
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("P-07 Explore", () => {
  it("keeps the search text in ?q= and sends it to the API", async () => {
    const { router, fetchMock } = renderApp("/explore", {
      "GET /api/auth/me": guestReply,
      "GET /api/explore": feed([exploreTree]),
      "GET /api/explore/categories": chips,
    });
    const user = userEvent.setup();

    await user.type(await screen.findByTestId("explore-search"), "startup{Enter}");

    await waitFor(() => {
      expect(router.state.location.search).toBe("?q=startup");
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/explore?page=1&q=startup", expect.anything());
    });
  });

  it("selects a category chip through ?category= and clears it when pressed again", async () => {
    const { router } = renderApp("/explore?page=3", {
      "GET /api/auth/me": guestReply,
      "GET /api/explore": feed([exploreTree]),
      "GET /api/explore/categories": chips,
    });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /^Work/ }));
    expect(router.state.location.search).toBe("?category=work");
    expect(screen.getByRole("button", { name: /^Work/ })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: /^Work/ }));
    expect(router.state.location.search).toBe("");
  });

  it("opens with the search and chip from the URL, and links cards to the viewer and the owner's profile", async () => {
    renderApp("/explore?q=startup&category=work", {
      "GET /api/auth/me": guestReply,
      "GET /api/explore": feed([exploreTree]),
      "GET /api/explore/categories": chips,
    });

    expect(await screen.findByTestId("explore-search")).toHaveValue("startup");
    expect(await screen.findByRole("link", { name: "Startup ideas" })).toHaveAttribute(
      "href",
      "/trees/t1",
    );
    expect(screen.getByRole("link", { name: "Alice Chen" })).toHaveAttribute("href", "/u/alice");
    expect(screen.getByRole("button", { name: /^Work/ })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("P-08 User profile", () => {
  it("shows Not Found for an unknown or deleted user", async () => {
    renderApp("/u/nobody", {
      "GET /api/auth/me": guestReply,
      "GET /api/users/nobody": {
        status: 404,
        body: { error: { code: "USER_NOT_FOUND", message: "User not found" } },
      },
    });

    expect(await screen.findByText("This page doesn't exist or isn't public.")).toBeInTheDocument();
  });

  it("shows the profile and only the public trees the API returns", async () => {
    renderApp("/u/alice", {
      "GET /api/auth/me": guestReply,
      "GET /api/users/alice": {
        status: 200,
        body: {
          data: {
            user: {
              id: "u1",
              username: "alice",
              displayName: "Alice Chen",
              avatarUrl: null,
              createdAt: "2026-11-01T00:00:00Z",
            },
            trees: [{ ...exploreTree, owner: undefined }],
            pagination: { page: 1, limit: 20, total: 1 },
          },
        },
      },
    });

    expect(await screen.findByRole("heading", { name: "Alice Chen" })).toBeInTheDocument();
    expect(screen.getByText(/@alice/)).toBeInTheDocument();
    expect(screen.getAllByTestId("tree-card")).toHaveLength(1);
  });
});
