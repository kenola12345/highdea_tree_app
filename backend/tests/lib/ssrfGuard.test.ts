import http from "node:http";
import type { AddressInfo } from "node:net";
import { Readable } from "node:stream";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertPublicUrl,
  FETCH_TIMEOUT_MS,
  httpTransport,
  isBlockedAddress,
  MAX_BODY_BYTES,
  safeFetch,
  ssrfDeps,
  type TransportResponse,
} from "../../src/lib/ssrfGuard.js";

const PUBLIC_IP = "93.184.216.34";

/** テスト用の偽レスポンス */
function fakeResponse(
  status: number,
  headers: Record<string, string> = {},
  body: string | Buffer = "",
): TransportResponse {
  return {
    status,
    headers,
    body: Readable.from([Buffer.from(body)]),
    close: vi.fn(),
  };
}

/** DNS 解決を固定の答えに差し替える（実際の DNS には問い合わせない） */
function mockDns(map: Record<string, string[]>) {
  return vi.spyOn(ssrfDeps, "lookup").mockImplementation((hostname) => {
    const addresses = map[hostname];
    if (!addresses) return Promise.reject(new Error(`ENOTFOUND ${hostname}`));
    return Promise.resolve(
      addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })),
    );
  });
}

/** AppError のコードで失敗することを確かめる */
async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("isBlockedAddress", () => {
  it.each([
    "127.0.0.1",
    "127.1.2.3",
    "10.0.0.1",
    "172.16.5.4",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:10.0.0.1",
    "64:ff9b::a00:1",
    "2002:7f00:1::1",
    "ff02::1",
    "not-an-ip",
  ])("blocks %s", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each(["93.184.216.34", "8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "2a00:1450:4001::200e"])(
    "allows the public address %s",
    (address) => {
      expect(isBlockedAddress(address)).toBe(false);
    },
  );
});

describe("assertPublicUrl", () => {
  it.each([
    "http://127.0.0.1/",
    "http://10.1.2.3/",
    "http://192.168.0.10/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://0x7f.1/",
    "http://2130706433/",
  ])("returns URL_NOT_ALLOWED for the internal address %s", async (url) => {
    const lookup = mockDns({});

    await expectCode(assertPublicUrl(url), "URL_NOT_ALLOWED");
    expect(lookup).not.toHaveBeenCalled();
  });

  it("returns URL_NOT_ALLOWED for port 8080", async () => {
    mockDns({ "example.com": [PUBLIC_IP] });

    await expectCode(assertPublicUrl("http://example.com:8080/"), "URL_NOT_ALLOWED");
  });

  it.each(["ftp://example.com/", "file:///etc/passwd", "not a url"])(
    "returns URL_NOT_ALLOWED for %s",
    async (url) => {
      await expectCode(assertPublicUrl(url), "URL_NOT_ALLOWED");
    },
  );

  it("returns URL_NOT_ALLOWED when the host name resolves to a private address", async () => {
    mockDns({ "internal.example.com": ["10.0.0.5"] });

    await expectCode(assertPublicUrl("https://internal.example.com/"), "URL_NOT_ALLOWED");
  });

  it("returns URL_NOT_ALLOWED when any resolved address is private", async () => {
    mockDns({ "mixed.example.com": [PUBLIC_IP, "127.0.0.1"] });

    await expectCode(assertPublicUrl("https://mixed.example.com/"), "URL_NOT_ALLOWED");
  });

  it("returns PREVIEW_UNAVAILABLE when the host name doesn't resolve", async () => {
    mockDns({});

    await expectCode(assertPublicUrl("https://nowhere.example/"), "PREVIEW_UNAVAILABLE");
  });

  it("returns the checked address for a public host on ports 80 and 443", async () => {
    mockDns({ "example.com": [PUBLIC_IP] });

    const target = await assertPublicUrl("https://example.com:443/page");
    const plain = await assertPublicUrl("http://example.com:80/");

    expect(target).toEqual({
      url: new URL("https://example.com/page"),
      address: PUBLIC_IP,
      family: 4,
    });
    expect(plain.address).toBe(PUBLIC_IP);
  });
});

describe("safeFetch", () => {
  it("returns the HTML and connects to the checked address", async () => {
    mockDns({ "example.com": [PUBLIC_IP] });
    const transport = vi
      .spyOn(ssrfDeps, "transport")
      .mockResolvedValue(
        fakeResponse(200, { "content-type": "text/html; charset=utf-8" }, "<p>hi</p>"),
      );

    const result = await safeFetch("https://example.com/a");

    expect(result).toEqual({ url: "https://example.com/a", html: "<p>hi</p>" });
    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({ address: PUBLIC_IP, url: new URL("https://example.com/a") }),
      expect.any(AbortSignal),
    );
  });

  it("returns URL_NOT_ALLOWED for a redirect to a private address", async () => {
    mockDns({ "example.com": [PUBLIC_IP], "evil.example.com": ["192.168.1.1"] });
    const transport = vi
      .spyOn(ssrfDeps, "transport")
      .mockResolvedValueOnce(fakeResponse(302, { location: "https://evil.example.com/admin" }));

    await expectCode(safeFetch("https://example.com/"), "URL_NOT_ALLOWED");
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("returns URL_NOT_ALLOWED for a redirect to a literal internal address", async () => {
    mockDns({ "example.com": [PUBLIC_IP] });
    vi.spyOn(ssrfDeps, "transport").mockResolvedValueOnce(
      fakeResponse(301, { location: "http://169.254.169.254/latest/meta-data/" }),
    );

    await expectCode(safeFetch("https://example.com/"), "URL_NOT_ALLOWED");
  });

  it("follows up to 3 redirects and returns the final URL", async () => {
    mockDns({ "example.com": [PUBLIC_IP] });
    vi.spyOn(ssrfDeps, "transport")
      .mockResolvedValueOnce(fakeResponse(301, { location: "/1" }))
      .mockResolvedValueOnce(fakeResponse(302, { location: "/2" }))
      .mockResolvedValueOnce(fakeResponse(307, { location: "https://example.com/3" }))
      .mockResolvedValueOnce(fakeResponse(200, { "content-type": "text/html" }, "ok"));

    const result = await safeFetch("https://example.com/0");

    expect(result.url).toBe("https://example.com/3");
  });

  it("returns PREVIEW_UNAVAILABLE after more than 3 redirects", async () => {
    mockDns({ "example.com": [PUBLIC_IP] });
    const transport = vi
      .spyOn(ssrfDeps, "transport")
      .mockImplementation(() => Promise.resolve(fakeResponse(302, { location: "/again" })));

    await expectCode(safeFetch("https://example.com/"), "PREVIEW_UNAVAILABLE");
    expect(transport).toHaveBeenCalledTimes(4);
  });

  it.each([
    ["an error status", fakeResponse(500, { "content-type": "text/html" }, "oops")],
    ["a non-HTML response", fakeResponse(200, { "content-type": "application/json" }, "{}")],
    ["a missing Content-Type", fakeResponse(200, {}, "<p>hi</p>")],
  ])("returns PREVIEW_UNAVAILABLE for %s", async (_label, response) => {
    mockDns({ "example.com": [PUBLIC_IP] });
    vi.spyOn(ssrfDeps, "transport").mockResolvedValue(response);

    await expectCode(safeFetch("https://example.com/"), "PREVIEW_UNAVAILABLE");
  });

  it("returns PREVIEW_UNAVAILABLE when the connection fails", async () => {
    mockDns({ "example.com": [PUBLIC_IP] });
    vi.spyOn(ssrfDeps, "transport").mockRejectedValue(new Error("ECONNREFUSED"));

    await expectCode(safeFetch("https://example.com/"), "PREVIEW_UNAVAILABLE");
  });

  it("reads at most 1 MB of the body", async () => {
    mockDns({ "example.com": [PUBLIC_IP] });
    const chunk = Buffer.alloc(256 * 1024, "a");
    const response = fakeResponse(200, { "content-type": "text/html" });
    response.body = Readable.from(Array.from({ length: 8 }, () => chunk));
    vi.spyOn(ssrfDeps, "transport").mockResolvedValue(response);

    const result = await safeFetch("https://example.com/");

    expect(result.html.length).toBe(MAX_BODY_BYTES);
    expect(response.close).toHaveBeenCalled();
  });

  it("returns PREVIEW_UNAVAILABLE after the 5-second timeout", async () => {
    vi.useFakeTimers();
    mockDns({ "example.com": [PUBLIC_IP] });
    vi.spyOn(ssrfDeps, "transport").mockImplementation(
      (_target, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        }),
    );

    const promise = safeFetch("https://example.com/slow");
    const assertion = expectCode(promise, "PREVIEW_UNAVAILABLE");
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS);

    await assertion;
  });
});

describe("httpTransport", () => {
  it("connects to the pinned address without DNS and keeps the original Host header", async () => {
    // ローカルのサーバーで、DNS で解決できないホスト名でも検査済み IP に接続することを確かめる
    let receivedHost: string | undefined;
    const server = http.createServer((req, res) => {
      receivedHost = req.headers.host;
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<title>pinned</title>");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    const url = new URL(`http://pinned.invalid:${String(port)}/page?q=1`);

    try {
      const res = await httpTransport(
        { url, address: "127.0.0.1", family: 4 },
        new AbortController().signal,
      );
      const chunks: Uint8Array[] = [];
      for await (const chunk of res.body) chunks.push(chunk);

      expect(res.status).toBe(200);
      expect(Buffer.concat(chunks).toString()).toBe("<title>pinned</title>");
      expect(receivedHost).toBe(`pinned.invalid:${String(port)}`);
    } finally {
      server.close();
    }
  });
});
