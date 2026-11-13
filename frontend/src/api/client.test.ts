import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiFetch, setUnauthenticatedHandler } from "./client";

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  setUnauthenticatedHandler(() => undefined);
});

describe("apiFetch", () => {
  it("prefixes /api, sends cookies and unwraps { data }", async () => {
    const fetchMock = mockFetch(200, { data: { trees: [] } });

    const data = await apiFetch<{ trees: unknown[] }>("/trees");

    expect(data).toEqual({ trees: [] });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/trees",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("throws ApiError with code, status and details", async () => {
    mockFetch(400, {
      error: {
        code: "VALIDATION_ERROR",
        message: "Some fields are invalid",
        details: [{ field: "title", message: "Too long" }],
      },
    });

    const error = await apiFetch("/trees", { method: "POST", body: "{}" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
      details: [{ field: "title", message: "Too long" }],
    });
  });

  it("calls the 401 handler for an expired session", async () => {
    mockFetch(401, { error: { code: "UNAUTHENTICATED", message: "Please log in" } });
    const handler = vi.fn();
    setUnauthenticatedHandler(handler);

    await expect(apiFetch("/trees")).rejects.toBeInstanceOf(ApiError);

    expect(handler).toHaveBeenCalledOnce();
  });

  it("doesn't call the 401 handler for /auth/me (401 there just means guest)", async () => {
    mockFetch(401, { error: { code: "UNAUTHENTICATED", message: "Please log in" } });
    const handler = vi.fn();
    setUnauthenticatedHandler(handler);

    await expect(apiFetch("/auth/me")).rejects.toBeInstanceOf(ApiError);

    expect(handler).not.toHaveBeenCalled();
  });

  it("falls back to INTERNAL_ERROR when the body isn't JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Bad gateway", { status: 502 })));

    await expect(apiFetch("/trees")).rejects.toMatchObject({ status: 502, code: "INTERNAL_ERROR" });
  });
});
