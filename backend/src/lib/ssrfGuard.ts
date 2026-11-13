import { lookup as dnsLookup } from "node:dns/promises";
import http, { type IncomingHttpHeaders } from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";

import { AppError } from "../errors/AppError.js";

// 外部ページ取得の SSRF 対策（manifests/nodes.md POST /api/link-preview, standards/security.md §9.4）。
// DNS で解決した IP を検査し、その IP にだけ接続する（検査後に DNS の答えが変わる DNS リバインディング対策）。

/** 取得全体（DNS・リダイレクト・本文の読み込みを含む）のタイムアウト */
export const FETCH_TIMEOUT_MS = 5000;
/** 読み込む本文の上限。超えた分は読まずに切り捨てる */
export const MAX_BODY_BYTES = 1024 * 1024;
/** 追いかけるリダイレクトの上限 */
export const MAX_REDIRECTS = 3;

const ALLOWED_PORTS = new Set([80, 443]);

/** 接続先として検査済みの URL と IP */
export type PinnedTarget = { url: URL; address: string; family: 4 | 6 };

/** トランスポートが返す最小限のレスポンス */
export type TransportResponse = {
  status: number;
  headers: IncomingHttpHeaders;
  body: AsyncIterable<Uint8Array>;
  /** 本文を最後まで読まずに接続を閉じる */
  close: () => void;
};

export type LookupResult = { address: string; family: number };

/** 外部 I/O（DNS 解決と HTTP 接続）。テストではここを vi.spyOn で差し替え、実際のネットワークに出ない */
export const ssrfDeps = {
  lookup: (hostname: string): Promise<LookupResult[]> =>
    dnsLookup(hostname, { all: true, order: "verbatim" }),
  transport: httpTransport,
};

const blockedV4 = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], // 「このネットワーク」・未指定
  ["10.0.0.0", 8], // プライベート
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // ループバック
  ["169.254.0.0", 16], // リンクローカル（クラウドのメタデータ 169.254.169.254 を含む）
  ["172.16.0.0", 12], // プライベート
  ["192.0.0.0", 24], // IETF 予約
  ["192.0.2.0", 24], // 文書用
  ["192.88.99.0", 24], // 6to4 リレー
  ["192.168.0.0", 16], // プライベート
  ["198.18.0.0", 15], // ベンチマーク用
  ["198.51.100.0", 24], // 文書用
  ["203.0.113.0", 24], // 文書用
  ["224.0.0.0", 4], // マルチキャスト
  ["240.0.0.0", 4], // 予約済み・ブロードキャスト
] as const) {
  blockedV4.addSubnet(network, prefix, "ipv4");
}

// IPv6 は許可リスト方式: グローバルユニキャスト（2000::/3）以外はすべて拒否する。
// ループバック・未指定・IPv4 射影（::ffff:0:0/96）・NAT64（64:ff9b::/96）・ユニークローカル・リンクローカルはここで落ちる
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
const blockedV6 = new BlockList();
for (const [network, prefix] of [
  ["2001::", 23], // IETF プロトコル割り当て（Teredo を含む）
  ["2001:db8::", 32], // 文書用
  ["2002::", 16], // 6to4（内部の IPv4 を埋め込める）
  ["3fff::", 20], // 文書用
] as const) {
  blockedV6.addSubnet(network, prefix, "ipv6");
}

/** 公開インターネット上のアドレスでなければ true（プライベート・ループバック・リンクローカルなど） */
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return blockedV4.check(address, "ipv4");
  if (family === 6) {
    return !globalV6.check(address, "ipv6") || blockedV6.check(address, "ipv6");
  }
  return true;
}

/**
 * URL が外部から取得してよい公開アドレスかを確かめ、接続に使う IP を返す。
 * http/https・ポート 80/443 のみ。解決した IP が1つでも内部向けなら 400 URL_NOT_ALLOWED（manifests/nodes.md）。
 */
export async function assertPublicUrl(input: string | URL): Promise<PinnedTarget> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new AppError("URL_NOT_ALLOWED");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new AppError("URL_NOT_ALLOWED");
  if (url.port !== "" && !ALLOWED_PORTS.has(Number(url.port))) {
    throw new AppError("URL_NOT_ALLOWED");
  }

  // IPv6 リテラルは URL 上で [] 付きになるため外す。0x7f.1 のような表記は URL パーサーが 127.0.0.1 に正規化済み
  const host = url.hostname.replace(/^\[(.*)\]$/, "$1");
  let addresses: LookupResult[];
  if (isIP(host)) {
    addresses = [{ address: host, family: isIP(host) }];
  } else {
    try {
      addresses = await ssrfDeps.lookup(host);
    } catch {
      throw new AppError("PREVIEW_UNAVAILABLE");
    }
  }
  const first = addresses[0];
  if (!first) throw new AppError("PREVIEW_UNAVAILABLE");
  // 一部だけ公開アドレスでも拒否する（接続時に内部アドレス側を選ばれないように）
  if (addresses.some((a) => isBlockedAddress(a.address))) throw new AppError("URL_NOT_ALLOWED");
  return { url, address: first.address, family: first.family === 6 ? 6 : 4 };
}

/** safeFetch の結果。url はリダイレクト後の最終URL */
export type SafeFetchResult = { url: string; html: string };

/**
 * 公開アドレスの HTML ページを安全に取得する。
 * リダイレクトは自分で追いかけ（最大3回）、移動先ごとに assertPublicUrl で検査し直す。
 * 内部アドレス → 400 URL_NOT_ALLOWED、取得・読み込みの失敗 → 422 PREVIEW_UNAVAILABLE（manifests/nodes.md）。
 */
export async function safeFetch(input: string): Promise<SafeFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, FETCH_TIMEOUT_MS);
  try {
    return await fetchFollowingRedirects(input, controller.signal);
  } catch (err) {
    if (err instanceof AppError) throw err;
    // タイムアウト・接続失敗・TLS エラーなどはすべて「プレビューなし」として扱う
    throw new AppError("PREVIEW_UNAVAILABLE");
  } finally {
    clearTimeout(timer);
  }
}

/** リダイレクトを検査しながら追いかけ、最終ページの HTML を返す */
async function fetchFollowingRedirects(
  input: string,
  signal: AbortSignal,
): Promise<SafeFetchResult> {
  let current: string | URL = input;
  for (let redirects = 0; ; redirects++) {
    const target: PinnedTarget = await abortable(assertPublicUrl(current), signal);
    const res = await ssrfDeps.transport(target, signal);
    const location = header(res.headers, "location");
    if (res.status >= 300 && res.status < 400 && location) {
      res.close();
      if (redirects >= MAX_REDIRECTS) throw new AppError("PREVIEW_UNAVAILABLE");
      current = new URL(location, target.url);
      continue;
    }
    if (res.status < 200 || res.status >= 300) {
      res.close();
      throw new AppError("PREVIEW_UNAVAILABLE");
    }
    const contentType = parseContentType(header(res.headers, "content-type"));
    if (contentType.mediaType !== "text/html") {
      res.close();
      throw new AppError("PREVIEW_UNAVAILABLE");
    }
    const bytes = await readLimited(res);
    return { url: target.url.href, html: decode(bytes, contentType.charset) };
  }
}

/** 本文を最大 1 MB まで読む。それ以上は読まずに接続を閉じる（巨大なレスポンスでメモリを使わせないため） */
async function readLimited(res: TransportResponse): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for await (const chunk of res.body) {
      const remaining = MAX_BODY_BYTES - total;
      chunks.push(Buffer.from(chunk.subarray(0, remaining)));
      total += Math.min(chunk.length, remaining);
      if (total >= MAX_BODY_BYTES) break;
    }
  } finally {
    res.close();
  }
  return Buffer.concat(chunks);
}

/** Content-Type から MIME タイプと charset を取り出す */
function parseContentType(value: string | undefined): { mediaType: string; charset?: string } {
  if (!value) return { mediaType: "" };
  const [type = "", ...params] = value.split(";");
  const charset = params
    .map((p) => p.trim().split("="))
    .find(([key]) => key?.toLowerCase() === "charset")?.[1];
  return {
    mediaType: type.trim().toLowerCase(),
    charset: charset?.replace(/^"|"$/g, ""),
  };
}

/** 指定された charset で文字列にする。未知の charset は UTF-8 として読む */
function decode(bytes: Buffer, charset: string | undefined): string {
  try {
    return new TextDecoder(charset ?? "utf-8").decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

/** ヘッダー値を1つの文字列で取り出す */
function header(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/** Promise を AbortSignal でも打ち切れるようにする（DNS 解決が遅い場合も全体の5秒に含めるため） */
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new Error("aborted"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      reject(new Error("aborted"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", onAbort);
    });
  });
}

/**
 * 既定のトランスポート: node:http(s) で、検査済みの IP にだけ接続する。
 * lookup を差し替えて DNS を再解決させないため、検査と接続の間に DNS の答えを変えられても内部へは繋がらない。
 * Host ヘッダーと TLS の SNI・証明書検証は元のホスト名のまま行う。
 */
export function httpTransport(
  target: PinnedTarget,
  signal: AbortSignal,
): Promise<TransportResponse> {
  const { url, address, family } = target;
  const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
    if (options.all) callback(null, [{ address, family }]);
    else callback(null, address, family);
  };
  const isHttps = url.protocol === "https:";
  const client = isHttps ? https : http;
  const host = url.hostname.replace(/^\[(.*)\]$/, "$1");

  return new Promise<TransportResponse>((resolve, reject) => {
    const req = client.request(
      {
        protocol: url.protocol,
        host,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: "GET",
        lookup: pinnedLookup,
        // 接続を使い回すと別ホストの検査済み IP が混ざり得るため、毎回新しい接続にする
        agent: false,
        signal,
        // IP リテラルには SNI を送れない（送ると Node が警告する）
        ...(isHttps && !isIP(host) && { servername: host }),
        headers: {
          host: url.host,
          accept: "text/html,application/xhtml+xml",
          // 圧縮されると 1 MB の上限が展開前のサイズになってしまうため、無圧縮で受け取る
          "accept-encoding": "identity",
          "user-agent": "HighdeaTreeLinkPreview/1.0",
        },
      },
      (res) => {
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: res,
          close: () => {
            res.destroy();
            req.destroy();
          },
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}
