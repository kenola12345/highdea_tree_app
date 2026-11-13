import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ApiError } from "../api/client";
import { useApiForm } from "./forms";

const schema = z.object({
  title: z.string().trim().min(1, "Required"),
  description: z.string().max(5),
});

describe("useApiForm", () => {
  it("validates with the shared schema and returns the parsed value", () => {
    const { result } = renderHook(() => useApiForm(schema));

    let parsed: unknown;
    act(() => {
      parsed = result.current.validate({ title: "  Ideas ", description: "" });
    });

    expect(parsed).toEqual({ title: "Ideas", description: "" });
    expect(result.current.fieldErrors).toEqual({});
  });

  it("shows client-side errors per field", () => {
    const { result } = renderHook(() => useApiForm(schema));

    act(() => {
      result.current.validate({ title: " ", description: "too long" });
    });

    expect(result.current.fieldErrors).toEqual({
      title: "Required",
      description: expect.any(String),
    });
  });

  it("maps a server VALIDATION_ERROR's details to fields", () => {
    const { result } = renderHook(() => useApiForm(schema));

    act(() => {
      result.current.applyServerError(
        new ApiError(400, "VALIDATION_ERROR", "Invalid", [{ field: "title", message: "Taken" }]),
      );
    });

    expect(result.current.fieldErrors).toEqual({ title: "Taken" });
    expect(result.current.formError).toBeNull();
  });

  it("puts a known error code under a field, and anything else at form level", () => {
    const { result } = renderHook(() => useApiForm(schema));

    act(() => {
      result.current.applyServerError(new ApiError(409, "EMAIL_TAKEN", "Email taken"), {
        EMAIL_TAKEN: "email",
      });
    });
    expect(result.current.fieldErrors).toEqual({ email: "Email taken" });

    act(() => {
      result.current.applyServerError(new ApiError(429, "RATE_LIMITED", "Too many requests"));
    });
    expect(result.current.formError).toBe("Too many requests");
  });
});
