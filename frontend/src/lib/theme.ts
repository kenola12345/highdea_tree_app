// ライト・ダークの切り替え（manifests/common.md §4 Light and dark mode）。
import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

/** 選んだテーマを保存する localStorage のキー（サーバーには送らない） */
export const THEME_STORAGE_KEY = "theme";

const listeners = new Set<() => void>();
const media =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

/** 保存された選択。なければ null（端末の設定に従う） */
function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    // プライベートモードなどで読めないときは端末の設定に従う
    return null;
  }
}

/** 今のテーマ。保存された選択、なければ端末の設定 */
export function currentTheme(): Theme {
  return storedTheme() ?? (media?.matches ? "dark" : "light");
}

function apply() {
  document.documentElement.classList.toggle("dark", currentTheme() === "dark");
  for (const listener of listeners) listener();
}

/** テーマを選んで保存し、すぐ反映する */
export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // 保存できなくても、この表示中は切り替える
  }
  apply();
}

// 自分で選んでいない間は、端末の設定の変更に追従する
media?.addEventListener("change", () => {
  if (storedTheme() === null) apply();
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 今のテーマ（変わると再描画）。キャンバスの既定の色などに使う */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme, () => "light");
}
