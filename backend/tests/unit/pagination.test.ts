import { paginationQuerySchema } from "@highdea/shared";
import { describe, expect, it } from "vitest";

import { toPagination, toSkipTake } from "../../src/services/common/pagination.js";

describe("pagination helpers", () => {
  it("converts page and limit to skip and take", () => {
    expect(toSkipTake(1, 20)).toEqual({ skip: 0, take: 20 });
    expect(toSkipTake(3, 10)).toEqual({ skip: 20, take: 10 });
  });

  it("builds data.pagination", () => {
    expect(toPagination(2, 20, 45)).toEqual({ page: 2, limit: 20, total: 45 });
  });

  it("defaults page to 1 and limit to 20, and coerces query strings", () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(paginationQuerySchema.parse({ page: "2", limit: "50" })).toEqual({ page: 2, limit: 50 });
  });

  it("rejects a limit over 50 and a page below 1", () => {
    expect(paginationQuerySchema.safeParse({ limit: "51" }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ page: "0" }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ page: "abc" }).success).toBe(false);
  });
});
