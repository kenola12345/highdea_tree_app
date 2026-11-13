import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";

describe("GET /api/health", () => {
  it("returns 200 with the common success shape", async () => {
    const app = createApp();

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { ok: true } });
  });
});
