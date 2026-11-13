// 日時は API から UTC の ISO 文字列で届き、表示は閲覧者のローカル時刻にする（manifests/common.md §7.4）

const DAY_MS = 24 * 60 * 60 * 1000;

/** 例: "Nov 13, 2026" */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** 例: "Nov 13, 2026, 2:30 PM" */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * DAY_MS],
  ["month", 30 * DAY_MS],
  ["week", 7 * DAY_MS],
  ["day", DAY_MS],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

/** 例: "3 days ago"、1分未満は "just now" */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const diff = new Date(iso).getTime() - now.getTime();
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return formatter.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

/** ゴミ箱の完全削除までの残り日数（manifests/trees.md P-09「X days left」）。切り上げ、0未満にはしない */
export function daysLeft(purgeAt: string, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((new Date(purgeAt).getTime() - now.getTime()) / DAY_MS));
}
