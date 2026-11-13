import { existsSync } from "node:fs";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import { uploadDir } from "../src/services/upload.service.js";
import { prisma, resetDb } from "./helpers/db.js";
import { createLoggedInUser } from "./helpers/factories.js";

const app = createApp();
const dir = uploadDir();

// 各形式の最小の画像（先頭バイトで形式が判定できるもの）
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
const WEBP = Buffer.from("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "base64");
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  Buffer.from("JFIF\0", "binary"),
  Buffer.alloc(32),
  Buffer.from([0xff, 0xd9]),
]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

/** テスト開始前からあるファイル（他の確認用に置かれたもの）は消さない */
let existingFiles = new Set<string>();

/** 画像を1つアップロードする */
function postFile(cookie: string, buffer: Buffer, filename: string, contentType = "image/png") {
  return request(app)
    .post("/api/uploads")
    .set("Cookie", cookie)
    .attach("file", buffer, { filename, contentType });
}

/** 保存先にあるファイル名の一覧 */
async function storedFiles(): Promise<string[]> {
  if (!existsSync(dir)) return [];
  return (await readdir(dir)).filter((name) => !existingFiles.has(name));
}

beforeAll(async () => {
  await mkdir(dir, { recursive: true });
  existingFiles = new Set(await readdir(dir));
});

beforeEach(async () => {
  await resetDb();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all((await storedFiles()).map((name) => rm(path.join(dir, name), { force: true })));
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /api/uploads", () => {
  it.each([
    ["PNG", PNG, "photo.png", "image/png", "png"],
    ["JPEG", JPEG, "photo.jpg", "image/jpeg", "jpg"],
    ["WebP", WEBP, "photo.webp", "image/webp", "webp"],
    ["GIF", GIF, "anim.gif", "image/gif", "gif"],
  ])("returns 201 and saves a %s image", async (_label, buffer, filename, mime, ext) => {
    const { user, cookie } = await createLoggedInUser();

    const res = await postFile(cookie, buffer, filename, "application/octet-stream");

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      data: {
        upload: {
          id: expect.any(String),
          url: expect.stringMatching(new RegExp(`^/uploads/[0-9a-f-]{36}\\.${ext}$`)),
          originalName: filename,
          mimeType: mime,
          sizeBytes: buffer.length,
          createdAt: expect.any(String),
        },
      },
    });
    const row = await prisma.upload.findUniqueOrThrow({ where: { id: res.body.data.upload.id } });
    expect(row.ownerId).toBe(user.id);
    expect(existsSync(path.join(dir, row.storageKey))).toBe(true);
  });

  it("keeps a non-ASCII original file name", async () => {
    const { cookie } = await createLoggedInUser();

    const res = await postFile(cookie, PNG, "写真.png");

    expect(res.status).toBe(201);
    expect(res.body.data.upload.originalName).toBe("写真.png");
  });

  it("serves the uploaded file at its URL with the detected type and nosniff", async () => {
    const { cookie } = await createLoggedInUser();
    const uploaded = await postFile(cookie, PNG, "photo.png");

    const res = await request(app).get(uploaded.body.data.upload.url);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(Buffer.from(res.body as Buffer).equals(PNG)).toBe(true);
  });

  it("returns 415 UNSUPPORTED_FILE_TYPE for an SVG image", async () => {
    const { cookie } = await createLoggedInUser();

    const res = await postFile(cookie, SVG, "logo.svg", "image/svg+xml");

    expect(res.status).toBe(415);
    expect(res.body).toEqual({
      error: { code: "UNSUPPORTED_FILE_TYPE", message: expect.any(String) },
    });
    expect(await storedFiles()).toEqual([]);
    expect(await prisma.upload.count()).toBe(0);
  });

  it("returns 415 UNSUPPORTED_FILE_TYPE for a .png file that is really text", async () => {
    const { cookie } = await createLoggedInUser();

    const res = await postFile(cookie, Buffer.from("just some text"), "fake.png", "image/png");

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_FILE_TYPE");
  });

  it("returns 413 FILE_TOO_LARGE for a file over 5 MB", async () => {
    const { cookie } = await createLoggedInUser();
    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);

    const res = await postFile(cookie, big, "big.png");

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: { code: "FILE_TOO_LARGE", message: expect.any(String) } });
    expect(await prisma.upload.count()).toBe(0);
  });

  it("returns 400 VALIDATION_ERROR when no file is sent", async () => {
    const { cookie } = await createLoggedInUser();

    const res = await request(app)
      .post("/api/uploads")
      .set("Cookie", cookie)
      .set("Content-Type", "multipart/form-data; boundary=xyz")
      .send("--xyz--\r\n");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when the request isn't multipart", async () => {
    const { cookie } = await createLoggedInUser();

    const res = await request(app).post("/api/uploads").set("Cookie", cookie).send({ file: "x" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when two files are sent", async () => {
    const { cookie } = await createLoggedInUser();

    const res = await request(app)
      .post("/api/uploads")
      .set("Cookie", cookie)
      .attach("file", PNG, "a.png")
      .attach("file", PNG, "b.png");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(await prisma.upload.count()).toBe(0);
  });

  it("returns 400 VALIDATION_ERROR when the file is in another field", async () => {
    const { cookie } = await createLoggedInUser();

    const res = await request(app)
      .post("/api/uploads")
      .set("Cookie", cookie)
      .attach("image", PNG, "a.png");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 401 UNAUTHENTICATED for guests", async () => {
    const res = await request(app).post("/api/uploads").attach("file", PNG, "a.png");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 401 UNAUTHENTICATED for a deactivated user", async () => {
    const { cookie } = await createLoggedInUser({ deactivated: true });

    const res = await postFile(cookie, PNG, "a.png");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 429 RATE_LIMITED after 60 uploads in an hour", async () => {
    const { cookie } = await createLoggedInUser();
    for (let i = 0; i < 60; i++) {
      const ok = await postFile(cookie, PNG, `p${String(i)}.png`);
      expect(ok.status).toBe(201);
    }

    const res = await postFile(cookie, PNG, "one-more.png");

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
  });

  it("deletes the written file when saving the record fails", async () => {
    const { cookie } = await createLoggedInUser();
    vi.spyOn(prisma.upload, "create").mockRejectedValueOnce(new Error("db down"));
    vi.spyOn(process.stderr, "write").mockReturnValue(true);

    const res = await postFile(cookie, PNG, "a.png");

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(await storedFiles()).toEqual([]);
  });
});
