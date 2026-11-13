/** http/https の URL ならパース結果を返し、それ以外（javascript: など）は null。リンクに使う前に必ず通す */
export function safeHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** 表示用のドメイン名（先頭の www. を除く）。不正な URL は空文字 */
export function domainOf(value: string): string {
  return safeHttpUrl(value)?.hostname.replace(/^www\./, "") ?? "";
}

/** ログイン後の戻り先として安全なパスか（他サイトへ飛ばされないよう、自サイト内の絶対パスだけ許可） */
export function isSafeNextPath(next: string | null): next is string {
  return Boolean(next?.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\"));
}
