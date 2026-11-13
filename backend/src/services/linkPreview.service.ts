import { type LinkPreviewResponse, NODE_URL_MAX } from "@highdea/shared";
import * as cheerio from "cheerio";

import { AppError } from "../errors/AppError.js";
import { logger } from "../lib/logger.js";
import { safeFetch } from "../lib/ssrfGuard.js";

/** nodes.preview_title / preview_description の列の長さ（manifests/nodes.md nodes テーブル） */
const PREVIEW_TITLE_MAX = 300;
const PREVIEW_DESCRIPTION_MAX = 1000;

/** 同じ URL の結果を使い回す時間（manifests/nodes.md POST /api/link-preview「Cache」） */
export const PREVIEW_CACHE_TTL_MS = 10 * 60 * 1000;
/** キャッシュの最大件数。異なる URL を大量に送られてもメモリを使い切らないようにする */
const PREVIEW_CACHE_MAX_ENTRIES = 1000;

type ParsedPreview = Omit<LinkPreviewResponse, "url">;
type CacheEntry = { preview: LinkPreviewResponse; fetchedAt: Date; expiresAt: number };

const cache = new Map<string, CacheEntry>();

/**
 * HTML から Open Graph のタイトル・説明・画像を読む。
 * 無ければ <title> と <meta name="description"> を使い、相対パスの画像は baseUrl から絶対URLにする。
 */
export function parse(html: string, baseUrl: string): ParsedPreview {
  const $ = cheerio.load(html);
  const meta = (selector: string): string | undefined => $(selector).first().attr("content");

  const title =
    meta('meta[property="og:title" i], meta[name="og:title" i]') ?? $("title").first().text();
  const description =
    meta('meta[property="og:description" i], meta[name="og:description" i]') ??
    meta('meta[name="description" i]');
  const image = meta('meta[property="og:image" i], meta[name="og:image" i]');

  return {
    title: clean(title, PREVIEW_TITLE_MAX),
    description: clean(description, PREVIEW_DESCRIPTION_MAX),
    imageUrl: absoluteImageUrl(image, baseUrl),
  };
}

/** 空白をまとめて前後を除き、列の長さに収まるよう文字数（コードポイント）で切る。空なら null */
function clean(value: string | undefined, max: number): string | null {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return Array.from(text).slice(0, max).join("");
}

/** 画像 URL を絶対URLにする。http/https 以外（javascript: や data: など）や長すぎる URL は使わない */
function absoluteImageUrl(value: string | undefined, baseUrl: string): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw, baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href.length <= NODE_URL_MAX ? url.href : null;
  } catch {
    return null;
  }
}

/** キャッシュのキー。URL を正規化して、表記ゆれ（ホスト名の大文字など）でも同じ結果を使う */
function cacheKey(url: string): string {
  try {
    return new URL(url).href;
  } catch {
    return url;
  }
}

/** キャッシュ付きで取得し、取得日時も返す（ノード保存時の preview_fetched_at 用） */
async function getCachedPreview(url: string): Promise<CacheEntry> {
  const key = cacheKey(url);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit;
  cache.delete(key);

  const page = await safeFetch(url);
  const entry: CacheEntry = {
    preview: { url: page.url, ...parse(page.html, page.url) },
    fetchedAt: new Date(),
    expiresAt: Date.now() + PREVIEW_CACHE_TTL_MS,
  };
  // Map は挿入順なので、先頭が最も古いエントリになる
  if (cache.size >= PREVIEW_CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, entry);
  return entry;
}

/**
 * URL のプレビューを取得する（10分間キャッシュ）。
 * 内部アドレス → 400 URL_NOT_ALLOWED、取得できない → 422 PREVIEW_UNAVAILABLE。
 */
export async function getPreview(url: string): Promise<LinkPreviewResponse> {
  return (await getCachedPreview(url)).preview;
}

/** ノードのプレビュー列にそのまま入れられる形（Prisma の Node と同じ名前） */
export type NodePreviewFields = {
  previewTitle: string | null;
  previewDescription: string | null;
  previewImageUrl: string | null;
  previewFetchedAt: Date | null;
};

/**
 * LINK ノードの保存用。失敗しても例外を投げず、すべて null のプレビュー列を返す。
 * プレビューが取れなくてもノードは作成・更新する仕様のため（manifests/nodes.md POST /api/trees/:id/nodes）。
 */
export async function tryGetPreview(url: string): Promise<NodePreviewFields> {
  try {
    const { preview, fetchedAt } = await getCachedPreview(url);
    return {
      previewTitle: preview.title,
      previewDescription: preview.description,
      previewImageUrl: preview.imageUrl,
      previewFetchedAt: fetchedAt,
    };
  } catch (err) {
    if (!(err instanceof AppError)) logger.warn("link preview failed", { err });
    return {
      previewTitle: null,
      previewDescription: null,
      previewImageUrl: null,
      previewFetchedAt: null,
    };
  }
}

/** テスト専用: キャッシュを空にする */
export function clearPreviewCache(): void {
  cache.clear();
}
