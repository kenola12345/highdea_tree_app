import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Router } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { AppError } from "../src/errors/AppError.js";
import { getValidated, validate } from "../src/middleware/validate.js";

// 共通基盤の動作確認用ルート（本番には登録しない）
const echoSchema = z.strictObject({ title: z.string().trim().min(1).max(100) });
const testRouter = Router();
testRouter.get("/__test/app-error", () => {
  throw new AppError("TREE_NOT_IN_TRASH");
});
testRouter.get("/__test/crash", () => {
  throw new Error("database password is hunter2");
});
testRouter.post("/__test/echo", validate({ body: echoSchema }), (req, res) => {
  res.status(201).json({ data: getValidated(req, "body", echoSchema) });
});

const app = createApp({ extraRouters: [testRouter] });

describe("common foundation", () => {
  it("returns 404 ROUTE_NOT_FOUND for an unknown /api path", async () => {
    const res = await request(app).get("/api/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "ROUTE_NOT_FOUND", message: expect.any(String) } });
  });

  it("turns an AppError into the common error shape with the code's status", async () => {
    const res = await request(app).get("/api/__test/app-error");

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "TREE_NOT_IN_TRASH", message: expect.any(String) } });
  });

  it("returns 500 INTERNAL_ERROR without leaking the original error", async () => {
    const res = await request(app).get("/api/__test/crash");

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(res.body)).not.toContain("hunter2");
  });

  it("returns 400 VALIDATION_ERROR with field details", async () => {
    const res = await request(app).post("/api/__test/echo").send({ title: "", extra: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        { field: "title", message: expect.any(String) },
        { field: "body", message: expect.stringContaining("extra") },
      ]),
    );
  });

  it("passes validated and transformed input to the handler", async () => {
    const res = await request(app).post("/api/__test/echo").send({ title: "  Startup ideas  " });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ data: { title: "Startup ideas" } });
  });

  it("returns 400 VALIDATION_ERROR for malformed JSON", async () => {
    const res = await request(app)
      .post("/api/__test/echo")
      .set("Content-Type", "application/json")
      .send("{ not json");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("sets security headers and allows credentialed CORS only for the configured origin", async () => {
    const res = await request(app).get("/api/health").set("Origin", env.CORS_ORIGIN);

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["access-control-allow-origin"]).toBe(env.CORS_ORIGIN);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
});

describe("GET /uploads/:storageKey", () => {
  beforeAll(() => {
    mkdirSync(path.resolve(env.UPLOAD_DIR), { recursive: true });
    // 1x1 の PNG
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64",
    );
    writeFileSync(path.resolve(env.UPLOAD_DIR, "test-image.png"), png);
  });

  it("serves an uploaded image with nosniff", async () => {
    const res = await request(app).get("/uploads/test-image.png");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("returns 404 for a missing image", async () => {
    const res = await request(app).get("/uploads/missing.png");

    expect(res.status).toBe(404);
  });
});
