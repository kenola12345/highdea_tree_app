import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderApp } from "../../test/renderApp";

const alice = {
  id: "u1",
  email: "alice@example.com",
  username: "alice",
  displayName: "Alice",
  avatarUrl: null,
  role: "USER",
  createdAt: "2026-11-01T00:00:00Z",
};
const me = { status: 200, body: { data: { user: alice } } };
const noCategories = { status: 200, body: { data: { categories: [] } } };

function tree(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    title: "Startup ideas",
    description: null,
    visibility: "PRIVATE",
    categories: [],
    nodeCount: 3,
    removedAt: null,
    removalReason: null,
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-10T00:00:00Z",
    ...overrides,
  };
}
const list = (trees: unknown[]) => ({
  status: 200,
  body: { data: { trees, pagination: { page: 1, limit: 20, total: trees.length } } },
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("M-01 New tree", () => {
  it("uses the title as the center idea when it's left empty, then opens the editor", async () => {
    let sent: unknown;
    const { router } = renderApp("/me", {
      "GET /api/auth/me": me,
      "GET /api/trees": list([]),
      "GET /api/categories": noCategories,
      "POST /api/trees": (body) => {
        sent = body;
        return { status: 201, body: { data: { tree: tree({ id: "new1" }), rootNode: {} } } };
      },
    });
    const user = userEvent.setup();

    // 空の一覧では見出し横と空状態の2か所に「+ New tree」がある
    const [newTreeButton] = await screen.findAllByTestId("new-tree-button");
    if (!newTreeButton) throw new Error("no New tree button");
    await user.click(newTreeButton);
    await user.type(screen.getByLabelText("Title"), "Startup ideas");
    expect(screen.getByLabelText("Center idea")).toHaveAttribute("placeholder", "Startup ideas");
    await user.click(screen.getByTestId("create-tree-submit"));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/trees/new1/edit");
    });
    expect(sent).toMatchObject({
      title: "Startup ideas",
      rootTitle: "Startup ideas",
      visibility: "PRIVATE",
    });
  });
});

describe("M-02 Tree settings", () => {
  it("disables the visibility switch and shows the reason for a removed tree", async () => {
    renderApp("/me", {
      "GET /api/auth/me": me,
      "GET /api/trees": list([
        tree({ removedAt: "2026-11-11T00:00:00Z", removalReason: "Off-topic content" }),
      ]),
      "GET /api/categories": noCategories,
    });
    const user = userEvent.setup();

    expect(await screen.findByTestId("visibility-badge")).toHaveTextContent("Removed by admin");
    await user.click(screen.getByTestId("tree-card-menu"));
    await user.click(screen.getByRole("menuitem", { name: "Edit details" }));

    const modal = screen.getByTestId("tree-settings-modal");
    expect(within(modal).getByTestId("removal-banner")).toHaveTextContent("Off-topic content");
    expect(within(modal).getByRole("radio", { name: /Public/ })).toBeDisabled();
  });
});

describe("P-09 Trash", () => {
  it("shows the days left until permanent deletion", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-13T12:00:00Z") });
    renderApp("/trash", {
      "GET /api/auth/me": me,
      "GET /api/trash": list([
        { ...tree(), deletedAt: "2026-11-11T12:00:00Z", purgeAt: "2026-11-21T12:00:00Z" },
      ]),
    });

    expect(await screen.findByTestId("days-left")).toHaveTextContent("8 days left");
  });

  it("restores a tree and refreshes My Trees and the Trash", async () => {
    let trashCalls = 0;
    const { fetchMock } = renderApp("/trash", {
      "GET /api/auth/me": me,
      "GET /api/trash": () => {
        trashCalls++;
        return trashCalls === 1
          ? list([
              { ...tree(), deletedAt: "2026-11-11T12:00:00Z", purgeAt: "2026-11-21T12:00:00Z" },
            ])
          : list([]);
      },
      "POST /api/trees/t1/restore": { status: 200, body: { data: { tree: tree() } } },
    });
    const user = userEvent.setup();

    await user.click(await screen.findByTestId("restore-button"));

    expect(await screen.findByText("Trash is empty")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/trees/t1/restore",
      expect.objectContaining({ method: "POST" }),
    );
    expect(trashCalls).toBe(2);
  });

  it("deletes one tree forever after confirming (M-13)", async () => {
    let trashCalls = 0;
    const { fetchMock } = renderApp("/trash", {
      "GET /api/auth/me": me,
      "GET /api/trash": () => {
        trashCalls++;
        return trashCalls === 1
          ? list([
              { ...tree(), deletedAt: "2026-11-11T12:00:00Z", purgeAt: "2026-11-21T12:00:00Z" },
            ])
          : list([]);
      },
      "DELETE /api/trash/t1": { status: 200, body: { data: null } },
    });
    const user = userEvent.setup();

    await user.click(await screen.findByTestId("delete-forever-button"));
    const modal = screen.getByTestId("delete-forever-modal");
    expect(modal).toHaveTextContent("This can't be undone.");
    await user.click(within(modal).getByTestId("confirm-button"));

    expect(await screen.findByText("Trash is empty")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/trash/t1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("empties the whole Trash after confirming, showing the tree count (M-13)", async () => {
    let trashCalls = 0;
    const { fetchMock } = renderApp("/trash", {
      "GET /api/auth/me": me,
      "GET /api/trash": () => {
        trashCalls++;
        return trashCalls === 1
          ? list([
              { ...tree(), deletedAt: "2026-11-11T12:00:00Z", purgeAt: "2026-11-21T12:00:00Z" },
              {
                ...tree({ id: "t2", title: "Second" }),
                deletedAt: "2026-11-10T12:00:00Z",
                purgeAt: "2026-11-20T12:00:00Z",
              },
            ])
          : list([]);
      },
      "DELETE /api/trash": { status: 200, body: { data: { deletedCount: 2 } } },
    });
    const user = userEvent.setup();

    await user.click(await screen.findByTestId("empty-trash-button"));
    const modal = screen.getByTestId("delete-forever-modal");
    expect(modal).toHaveTextContent("All 2 trees in the Trash will be deleted permanently.");
    await user.click(within(modal).getByTestId("confirm-button"));

    expect(await screen.findByText("Trash is empty")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/trash",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
