import { Readable } from "node:stream";

import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import { ssrfDeps, type TransportResponse } from "../src/lib/ssrfGuard.js";
import { clearPreviewCache, tryGetPreview } from "../src/services/linkPreview.service.js";
import { prisma, resetDb } from "./helpers/db.js";
import { createLoggedInUser } from "./helpers/factories.js";

const app = createApp();
const PUBLIC_IP = "93.184.216.34";

/** URL ごとの偽ページ。実際のインターネットには接続しない */
type FakePage = { status?: number; headers?: Record<string, string>; body?: string };
let pages: Record<string, FakePage> = {};

/** DNS とHTTP取得を偽物に差し替える。example.com は公開IP、internal.example.com はプライベートIPに解決する */
function mockNetwork() {
  vi.spyOn(ssrfDeps, "lookup").mockImplementation((hostname) => {
    if (hostname === "internal.example.com") {
      return Promise.resolve([{ address: "10.0.0.8", family: 4 }]);
    }
    return Promise.resolve([{ address: PUBLIC_IP, family: 4 }]);
  });
  return vi.spyOn(ssrfDeps, "transport").mockImplementation((target) => {
    const page = pages[target.url.href];
    if (!page) return Promise.reject(new Error("ECONNREFUSED"));
    const response: TransportResponse = {
      status: page.status ?? 200,
      headers: page.headers ?? { "content-type": "text/html; charset=utf-8" },
      body: Readable.from([Buffer.from(page.body ?? "")]),
      close: () => undefined,
    };
    return Promise.resolve(response);
  });
}

const ogPage = `<!doctype html><html><head>
  <title>Fallback title</title>
  <meta property="og:title" content="  OG   Title ">
  <meta property="og:description" content="OG description">
  <meta property="og:image" content="/images/cover.png">
  <meta name="description" content="Plain description">
</head><body></body></html>`;

let transport: ReturnType<typeof mockNetwork>;

beforeEach(async () => {
  await resetDb();
  clearPreviewCache();
  pages = {};
  transport = mockNetwork();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /api/link-preview", () => {
  it("returns the Open Graph fields with a relative og:image made absolute", async () => {
    const { cookie } = await createLoggedInUser();
    pages["https://example.com/article"] = { body: ogPage };

    const res = await request(app)
      .post("/api/link-preview")
      .set("Cookie", cookie)
      .send({ url: "https://example.com/article" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: {
        preview: {
          url: "https://example.com/article",
          title: "OG Title",
          description: "OG description",
          imageUrl: "https://example.com/images/cover.png",
        },
      },
    });
  });

  it("falls back to <title> and <meta name=description>, with null for a missing image", async () => {
    const { cookie } = await createLoggedInUser();
    pages["https://example.com/plain"] = {
      body: '<html><head><title>Plain page</title><meta name="Description" content="About it"></head></html>',
    };

    const res = await request(app)
      .post("/api/link-preview")
      .set("Cookie", cookie)
      .send({ url: "https://example.com/plain" });

    expect(res.status).toBe(200);
    expect(res.body.data.preview).toEqual({
      url: "https://example.com/plain",
      title: "Plain page",
      description: "About it",
      imageUrl: null,
    });
  });

  it("trims the title to 300 and the description to 1,000 characters", async () => {
    const { cookie } = await createLoggedInUser();
    pages["https://example.com/long"] = {
      body: `<title>${"t".repeat(400)}</title><meta name="description" content="${"d".repeat(1200)}">`,
    };

    const res = await request(app)
      .post("/api/link-preview")
      .set("Cookie", cookie)
      .send({ url: "https://example.com/long" });

    expect(res.status).toBe(200);
    expect(res.body.data.preview.title).toHaveLength(300);
    expect(res.body.data.preview.description).toHaveLength(1000);
  });

  it("returns the final URL after a redirect", async () => {
    const { cookie } = await createLoggedInUser();
    pages["http://example.com/old"] = {
      status: 301,
      headers: { location: "https://example.com/new" },
    };
    pages["https://example.com/new"] = { body: ogPage };

    const res = await request(app)
      .post("/api/link-preview")
      .set("Cookie", cookie)
      .send({ url: "http://example.com/old" });

    expect(res.status).toBe(200);
    expect(res.body.data.preview.url).toBe("https://example.com/new");
  });

  it.each([
    "http://127.0.0.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "https://internal.example.com/",
    "https://example.com:8080/",
  ])("returns 400 URL_NOT_ALLOWED for %s", async (url) => {
    const { cookie } = await createLoggedInUser();

    const res = await request(app).post("/api/link-preview").set("Cookie", cookie).send({ url });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: "URL_NOT_ALLOWED", message: expect.any(String) } });
    expect(transport).not.toHaveBeenCalled();
  });

  it("returns 400 URL_NOT_ALLOWED for a redirect to an internal address", async () => {
    const { cookie } = await createLoggedInUser();
    pages["https://example.com/jump"] = {
      status: 302,
      headers: { location: "http://192.168.0.1/admin" },
    };

    const res = await request(app)
      .post("/api/link-preview")
      .set("Cookie", cookie)
      .send({ url: "https://example.com/jump" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("URL_NOT_ALLOWED");
  });

  it.each([
    ["the fetch fails", "https://example.com/down", undefined],
    ["the page returns 404", "https://example.com/missing", { status: 404, body: "nope" }],
    [
      "the page isn't HTML",
      "https://example.com/file.pdf",
      { headers: { "content-type": "application/pdf" }, body: "%PDF" },
    ],
  ])("returns 422 PREVIEW_UNAVAILABLE when %s", async (_label, url, page) => {
    const { cookie } = await createLoggedInUser();
    if (page) pages[url] = page;

    const res = await request(app).post("/api/link-preview").set("Cookie", cookie).send({ url });

    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      error: { code: "PREVIEW_UNAVAILABLE", message: expect.any(String) },
    });
  });

  it.each([
    ["missing", {}],
    ["not http/https", { url: "ftp://example.com/file" }],
    ["too long", { url: `https://example.com/${"a".repeat(2049)}` }],
    ["an unknown field", { url: "https://example.com/", previewTitle: "x" }],
  ])("returns 400 VALIDATION_ERROR when url is %s", async (_label, body) => {
    const { cookie } = await createLoggedInUser();

    const res = await request(app).post("/api/link-preview").set("Cookie", cookie).send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual(expect.any(Array));
  });

  it("returns 401 UNAUTHENTICATED for guests", async () => {
    const res = await request(app)
      .post("/api/link-preview")
      .send({ url: "https://example.com/article" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("uses the cache for the same URL within 10 minutes", async () => {
    const { cookie } = await createLoggedInUser();
    pages["https://example.com/article"] = { body: ogPage };

    const first = await request(app)
      .post("/api/link-preview")
      .set("Cookie", cookie)
      .send({ url: "https://example.com/article" });
    const second = await request(app)
      .post("/api/link-preview")
      .set("Cookie", cookie)
      .send({ url: "https://EXAMPLE.com/article" });

    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("fetches again after the cache expires", async () => {
    const { cookie } = await createLoggedInUser();
    pages["https://example.com/article"] = { body: ogPage };
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);

    await request(app)
      .post("/api/link-preview")
      .set("Cookie", cookie)
      .send({ url: "https://example.com/article" });
    clock.mockReturnValue(now + 10 * 60 * 1000 + 1);
    const res = await request(app)
      .post("/api/link-preview")
      .set("Cookie", cookie)
      .send({ url: "https://example.com/article" });

    expect(res.status).toBe(200);
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("returns 429 RATE_LIMITED after 30 requests in a minute", async () => {
    const { cookie } = await createLoggedInUser();
    pages["https://example.com/article"] = { body: ogPage };
    for (let i = 0; i < 30; i++) {
      const ok = await request(app)
        .post("/api/link-preview")
        .set("Cookie", cookie)
        .send({ url: "https://example.com/article" });
      expect(ok.status).toBe(200);
    }

    const res = await request(app)
      .post("/api/link-preview")
      .set("Cookie", cookie)
      .send({ url: "https://example.com/article" });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
  });
});

describe("tryGetPreview", () => {
  it("returns the preview fields for a node", async () => {
    pages["https://example.com/article"] = { body: ogPage };

    const fields = await tryGetPreview("https://example.com/article");

    expect(fields).toEqual({
      previewTitle: "OG Title",
      previewDescription: "OG description",
      previewImageUrl: "https://example.com/images/cover.png",
      previewFetchedAt: expect.any(Date),
    });
  });

  it.each(["https://example.com/down", "http://127.0.0.1/"])(
    "returns empty fields instead of throwing for %s",
    async (url) => {
      const fields = await tryGetPreview(url);

      expect(fields).toEqual({
        previewTitle: null,
        previewDescription: null,
        previewImageUrl: null,
        previewFetchedAt: null,
      });
    },
  );
});
