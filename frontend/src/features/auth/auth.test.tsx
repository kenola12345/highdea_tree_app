import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { guestReply, renderApp } from "../../test/renderApp";

const alice = {
  id: "u1",
  email: "alice@example.com",
  username: "alice",
  displayName: "Alice",
  avatarUrl: null,
  role: "USER",
  createdAt: "2026-11-01T00:00:00Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("P-02 Sign up", () => {
  it("shows client-side errors under each field before sending", async () => {
    const { fetchMock } = renderApp("/signup", { "GET /api/auth/me": guestReply });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Username"), "a!");
    await user.click(screen.getByTestId("signup-submit"));

    expect(screen.getByTestId("email-error")).toBeInTheDocument();
    expect(screen.getByTestId("username-error")).toBeInTheDocument();
    expect(screen.getByTestId("password-error")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/auth/signup", expect.anything());
  });

  it("shows USERNAME_TAKEN from the server under the username field", async () => {
    renderApp("/signup", {
      "GET /api/auth/me": guestReply,
      "POST /api/auth/signup": {
        status: 409,
        body: { error: { code: "USERNAME_TAKEN", message: "This username is already taken" } },
      },
    });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Display name"), "Alice");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByTestId("signup-submit"));

    expect(await screen.findByTestId("username-error")).toHaveTextContent(
      "This username is already taken",
    );
  });

  it("logs the new user in and goes to /me", async () => {
    const { router } = renderApp("/signup", {
      "GET /api/auth/me": guestReply,
      "POST /api/auth/signup": { status: 201, body: { data: { user: alice } } },
    });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Email"), "alice@example.com");
    await user.type(screen.getByLabelText("Username"), "Alice");
    await user.type(screen.getByLabelText("Display name"), "Alice");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByTestId("signup-submit"));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/me");
    });
  });
});

describe("P-03 Log in", () => {
  async function logIn() {
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Email"), "alice@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByTestId("login-submit"));
  }

  it("goes back to the page in ?next= after logging in", async () => {
    const { router } = renderApp(`/login?next=${encodeURIComponent("/trash?page=2")}`, {
      "GET /api/auth/me": guestReply,
      "POST /api/auth/login": { status: 200, body: { data: { user: alice } } },
    });

    await logIn();

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/trash");
    });
    expect(router.state.location.search).toBe("?page=2");
  });

  it("ignores a ?next= that points to another site", async () => {
    const { router } = renderApp("/login?next=//evil.example.com", {
      "GET /api/auth/me": guestReply,
      "POST /api/auth/login": { status: 200, body: { data: { user: alice } } },
    });

    await logIn();

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/me");
    });
  });

  it("shows one form-level message for wrong credentials", async () => {
    renderApp("/login", {
      "GET /api/auth/me": guestReply,
      "POST /api/auth/login": {
        status: 401,
        body: { error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect" } },
      },
    });

    await logIn();

    expect(await screen.findByTestId("login-error")).toHaveTextContent(
      "Email or password is incorrect",
    );
  });

  it("explains the wait after too many attempts", async () => {
    renderApp("/login", {
      "GET /api/auth/me": guestReply,
      "POST /api/auth/login": {
        status: 429,
        body: { error: { code: "RATE_LIMITED", message: "Too many" } },
      },
    });

    await logIn();

    expect(await screen.findByTestId("login-error")).toHaveTextContent("Too many attempts");
  });
});

describe("P-01 Landing", () => {
  it("shows Sign up to guests", async () => {
    renderApp("/", { "GET /api/auth/me": guestReply });

    expect(await screen.findByTestId("landing-signup")).toBeInTheDocument();
    expect(screen.queryByTestId("go-to-my-trees")).not.toBeInTheDocument();
  });

  it("shows Go to My Trees to logged-in users", async () => {
    renderApp("/", { "GET /api/auth/me": { status: 200, body: { data: { user: alice } } } });

    expect(await screen.findByTestId("go-to-my-trees")).toBeInTheDocument();
    expect(screen.queryByTestId("landing-signup")).not.toBeInTheDocument();
  });
});

describe("Log out", () => {
  it("returns the header and landing page to the guest view", async () => {
    renderApp("/", {
      "GET /api/auth/me": { status: 200, body: { data: { user: alice } } },
      "POST /api/auth/logout": { status: 200, body: { data: null } },
    });
    const user = userEvent.setup();

    await user.click(await screen.findByTestId("menu-button"));
    await user.click(screen.getByTestId("logout-button"));

    expect(await screen.findByTestId("landing-signup")).toBeInTheDocument();
    expect(screen.queryByTestId("logout-button")).not.toBeInTheDocument();
  });
});

describe("returning to ?next= after login", () => {
  it("follows ?next= even when the guest-only guard reacts first", async () => {
    const { router } = renderApp(`/login?next=${encodeURIComponent("/settings?tab=account")}`, {
      "GET /api/auth/me": guestReply,
      "POST /api/auth/login": { status: 200, body: { data: { user: alice } } },
    });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Email"), "alice@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByTestId("login-submit"));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/settings");
    });
    expect(router.state.location.search).toBe("?tab=account");
  });
});
