// キャンバスの既定の色。キャンバスの見た目はツリーの所有者が決めるものなので、ライト・ダークのテーマでは変えない
// （manifests/common.md §4 Light and dark mode）。所有者が色を選んでいなければ、どちらのテーマでもこの色。
export const CANVAS_DEFAULTS = {
  /** 色のないカード */
  card: "#FFFFFF",
  /** 色のない中心のアイデア */
  root: "#1C3A2A",
  /** 方眼の既定の色 */
  grid: "#D3E0D5",
  /** キャンバスの既定の背景色 */
  background: "#F6F9F5",
} as const;
