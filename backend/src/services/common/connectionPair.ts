/**
 * つながりの2つのノードIDを保存する順（小さい方が先）に並べる。
 * 向きのないつながりを1組1行にするため（manifests/nodes.md node_connections）。
 * DB の CHECK は COLLATE "C"（バイト順）で比べるので、JS の文字列比較（UTF-16 の順。cuid は ASCII のみ）と一致する。
 */
export function sortPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}
