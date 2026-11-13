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
const wrongPassword = {
  status: 403,
  body: { error: { code: "WRONG_PASSWORD", message: "The password is incorrect" } },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("P-10 Settings", () => {
  it("opens the tab named in ?tab= and keeps the tab in the URL", async () => {
    const { router } = renderApp("/settings?tab=account", { "GET /api/auth/me": me });
    const user = userEvent.setup();

    expect(await screen.findByRole("tab", { name: "Account" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("account-form")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Categories" }));

    expect(router.state.location.search).toBe("?tab=categories");
  });

  it("shows a wrong current password under the password field", async () => {
    renderApp("/settings?tab=account", {
      "GET /api/auth/me": me,
      "PATCH /api/users/me/account": wrongPassword,
    });
    const user = userEvent.setup();

    const username = await screen.findByLabelText("Username");
    await user.clear(username);
    await user.type(username, "alice_new");
    await user.type(
      within(screen.getByTestId("account-form")).getByLabelText("Current password"),
      "nope",
    );
    await user.click(screen.getByTestId("account-save"));

    expect(await screen.findByTestId("account-currentPassword-error")).toHaveTextContent(
      "The password is incorrect",
    );
  });

  it("sends only the fields that changed", async () => {
    const { fetchMock } = renderApp("/settings?tab=account", {
      "GET /api/auth/me": me,
      "PATCH /api/users/me/account": {
        status: 200,
        body: { data: { user: { ...alice, username: "alice_new" } } },
      },
    });
    const user = userEvent.setup();

    const username = await screen.findByLabelText("Username");
    await user.clear(username);
    await user.type(username, "alice_new");
    await user.type(
      within(screen.getByTestId("account-form")).getByLabelText("Current password"),
      "password123",
    );
    await user.click(screen.getByTestId("account-save"));

    await screen.findByText("Account updated");
    const call = fetchMock.mock.calls.find(([url]) => url === "/api/users/me/account");
    const sent = call?.[1]?.body;
    expect(typeof sent === "string" ? JSON.parse(sent) : sent).toEqual({
      username: "alice_new",
      currentPassword: "password123",
    });
  });

  it("M-11 deletes the account and goes to the landing page as a guest", async () => {
    const { router } = renderApp("/settings?tab=account", {
      "GET /api/auth/me": me,
      "POST /api/users/me/deactivate": { status: 200, body: { data: null } },
    });
    const user = userEvent.setup();

    await user.click(await screen.findByTestId("delete-account-button"));
    await user.type(screen.getByLabelText("Enter your password to confirm"), "password123");
    await user.click(screen.getByTestId("delete-account-confirm"));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
    expect(await screen.findByTestId("landing-signup")).toBeInTheDocument();
  });

  it("M-11 keeps the modal open and shows a wrong password", async () => {
    renderApp("/settings?tab=account", {
      "GET /api/auth/me": me,
      "POST /api/users/me/deactivate": wrongPassword,
    });
    const user = userEvent.setup();

    await user.click(await screen.findByTestId("delete-account-button"));
    await user.type(screen.getByLabelText("Enter your password to confirm"), "nope");
    await user.click(screen.getByTestId("delete-account-confirm"));

    expect(await screen.findByTestId("delete-password-error")).toHaveTextContent(
      "The password is incorrect",
    );
    expect(screen.getByTestId("delete-account-modal")).toBeInTheDocument();
  });
});
