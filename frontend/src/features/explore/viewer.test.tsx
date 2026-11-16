import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { guestReply, renderApp } from "../../test/renderApp";

function me(role: "USER" | "ADMIN", username = "someone") {
  return {
    status: 200,
    body: {
      data: {
        user: {
          id: "u9",
          email: `${username}@example.com`,
          username,
          displayName: username,
          avatarUrl: null,
          role,
          createdAt: "2026-11-01T00:00:00Z",
        },
      },
    },
  };
}
function treeReply(isOwner: boolean, extra: Record<string, unknown> = {}) {
  return {
    status: 200,
    body: {
      data: {
        tree: {
          id: "t1",
          title: "Startup ideas",
          description: "Brainstorm",
          visibility: "PUBLIC",
          categories: [],
          removedAt: null,
          removalReason: null,
          createdAt: "2026-11-01T00:00:00Z",
          updatedAt: "2026-11-01T00:00:00Z",
          ...extra,
        },
        owner: { username: "alice", displayName: "Alice Chen", avatarUrl: null },
        isOwner,
        nodes: [
          {
            id: "root",
            parentId: null,
            type: "TEXT",
            title: "Startup ideas",
            positionX: 0,
            positionY: 0,
            sortOrder: 0,
            updatedAt: "2026-11-01T00:00:00Z",
          },
        ],
        connections: [],
      },
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("P-06 Tree viewer buttons", () => {
  it("shows no Edit or Remove to a guest", async () => {
    renderApp("/trees/t1", {
      "GET /api/auth/me": guestReply,
      "GET /api/trees/t1": treeReply(false),
    });

    expect(await screen.findByTestId("viewer-title")).toHaveTextContent("Startup ideas");
    expect(screen.queryByTestId("viewer-edit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("viewer-remove")).not.toBeInTheDocument();
  });

  it("shows Edit to the owner", async () => {
    renderApp("/trees/t1", {
      "GET /api/auth/me": me("USER", "alice"),
      "GET /api/trees/t1": treeReply(true),
    });

    expect(await screen.findByTestId("viewer-edit")).toHaveAttribute("href", "/trees/t1/edit");
    expect(screen.queryByTestId("viewer-remove")).not.toBeInTheDocument();
  });

  it("shows Remove to an admin on a public tree, but not on a private one", async () => {
    renderApp("/trees/t1", {
      "GET /api/auth/me": me("ADMIN"),
      "GET /api/trees/t1": treeReply(false),
    });

    expect(await screen.findByTestId("viewer-remove")).toBeInTheDocument();
    expect(screen.queryByTestId("viewer-edit")).not.toBeInTheDocument();
  });

  it("shows Not Found for a tree the caller can't see", async () => {
    renderApp("/trees/t1", {
      "GET /api/auth/me": guestReply,
      "GET /api/trees/t1": {
        status: 404,
        body: { error: { code: "TREE_NOT_FOUND", message: "Tree not found" } },
      },
    });

    expect(await screen.findByText("This page doesn't exist or isn't public.")).toBeInTheDocument();
  });
});

describe("M-09 Remove tree", () => {
  it("requires a reason before sending", async () => {
    const { fetchMock } = renderApp("/trees/t1", {
      "GET /api/auth/me": me("ADMIN"),
      "GET /api/trees/t1": treeReply(false),
    });
    const user = userEvent.setup();

    await user.click(await screen.findByTestId("viewer-remove"));
    await user.click(screen.getByTestId("remove-tree-confirm"));

    expect(await screen.findByTestId("removal-reason-error")).toHaveTextContent("Enter a reason");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/admin/trees/t1/remove", expect.anything());
  });

  it("sends the reason and then shows Not Found because the tree is no longer public", async () => {
    let removed = false;
    renderApp("/trees/t1", {
      "GET /api/auth/me": me("ADMIN"),
      "GET /api/trees/t1": () =>
        removed
          ? { status: 404, body: { error: { code: "TREE_NOT_FOUND", message: "Tree not found" } } }
          : treeReply(false),
      "POST /api/admin/trees/t1/remove": (body) => {
        removed = true;
        expect(body).toEqual({ reason: "Spam" });
        return {
          status: 200,
          body: {
            data: {
              tree: {
                id: "t1",
                title: "Startup ideas",
                visibility: "PRIVATE",
                removedAt: "2026-11-13T00:00:00Z",
                removalReason: "Spam",
              },
            },
          },
        };
      },
      "GET /api/explore": {
        status: 200,
        body: { data: { trees: [], pagination: { page: 1, limit: 20, total: 0 } } },
      },
    });
    const user = userEvent.setup();

    await user.click(await screen.findByTestId("viewer-remove"));
    await user.type(screen.getByLabelText("Reason (shown to the owner)"), "Spam");
    await user.click(screen.getByTestId("remove-tree-confirm"));

    expect(await screen.findByText("This page doesn't exist or isn't public.")).toBeInTheDocument();
  });
});
