import { describe, expect, it } from "vitest";

import { daysLeft, formatRelative } from "./dates";

const now = new Date("2026-11-13T12:00:00Z");

describe("daysLeft", () => {
  it("rounds up partial days so 'X days left' never shows 0 too early", () => {
    expect(daysLeft("2026-11-21T12:00:00Z", now)).toBe(8);
    expect(daysLeft("2026-11-13T13:00:00Z", now)).toBe(1);
  });

  it("never goes below 0", () => {
    expect(daysLeft("2026-11-10T00:00:00Z", now)).toBe(0);
  });
});

describe("formatRelative", () => {
  it("formats past times in the largest unit", () => {
    expect(formatRelative("2026-11-10T12:00:00Z", now)).toBe("3 days ago");
    expect(formatRelative("2026-11-13T09:00:00Z", now)).toBe("3 hours ago");
    expect(formatRelative("2026-11-13T11:59:30Z", now)).toBe("just now");
  });
});
