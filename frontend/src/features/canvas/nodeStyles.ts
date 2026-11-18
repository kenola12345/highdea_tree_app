// カードの見た目のプリセットと、アイデアの種類ごとの見た目（manifests/nodes.md §3.5 Node style presets / Idea kinds）。
// キャンバス（背景・方眼）とは別のしくみ。カードはいつも不透明な背景と枠を持つので、どんな背景の上でも読める。
import type { NodeRole, NodeStylePreset } from "@highdea/shared";

export type NodeStyleTokens = {
  label: string;
  /** プリセットの短い説明（Canvas パネルに出す） */
  description: string;
  /** 色のないカードの背景・文字・枠 */
  card: string;
  text: string;
  border: string;
  /** Supporting のカードの背景（少し控えめ） */
  supporting: string;
  /** 色のない中心のアイデアの背景と文字 */
  root: string;
  rootText: string;
  /** 題名の書体（Editorial は明朝系） */
  titleFont?: string;
  /** 種類ごとの差し色 */
  accent: Record<NodeRole, string>;
};

const SANS = undefined;
const SERIF = 'ui-serif, "Iowan Old Style", "Palatino Linotype", Georgia, serif';

export const NODE_STYLES: Record<NodeStylePreset, NodeStyleTokens> = {
  MINIMAL: {
    label: "Minimal",
    description: "Clean, neutral, focused.",
    card: "#FFFFFF",
    text: "#1C3A2A",
    border: "rgba(28, 58, 42, 0.12)",
    supporting: "#F4F7F3",
    root: "#1C3A2A",
    rootText: "#FFFFFF",
    titleFont: SANS,
    accent: {
      CORE: "#1C3A2A",
      SUPPORTING: "#7A8C7F",
      IMPORTANT: "#D97706",
      EXAMPLE: "#0F766E",
      QUESTION: "#7C3AED",
    },
  },
  MIDNIGHT: {
    label: "Midnight",
    description: "Dark, technical, modern.",
    card: "#2B3447",
    text: "#E6EAF2",
    border: "rgba(230, 234, 242, 0.12)",
    supporting: "#232B3B",
    root: "#E2E8F0",
    rootText: "#1B2130",
    titleFont: SANS,
    accent: {
      CORE: "#93C5FD",
      SUPPORTING: "#8792A8",
      IMPORTANT: "#FBBF24",
      EXAMPLE: "#5EEAD4",
      QUESTION: "#C4B5FD",
    },
  },
  ORGANIC: {
    label: "Organic",
    description: "Natural, creative, exploratory.",
    card: "#E4EEDB",
    text: "#23402B",
    border: "rgba(35, 64, 43, 0.16)",
    supporting: "#EEF4E8",
    root: "#2F5233",
    rootText: "#F1F6EC",
    titleFont: SANS,
    accent: {
      CORE: "#2F5233",
      SUPPORTING: "#7D8F74",
      IMPORTANT: "#B45309",
      EXAMPLE: "#3F6212",
      QUESTION: "#7C5CB5",
    },
  },
  EDITORIAL: {
    label: "Editorial",
    description: "Warm, structured, thoughtful.",
    card: "#FFFFFF",
    text: "#4A3B2C",
    border: "rgba(74, 59, 44, 0.14)",
    supporting: "#FAF5EC",
    root: "#4A3B2C",
    rootText: "#FBF6EE",
    titleFont: SERIF,
    accent: {
      CORE: "#4A3B2C",
      SUPPORTING: "#9A8B79",
      IMPORTANT: "#C2410C",
      EXAMPLE: "#3F5F5A",
      QUESTION: "#6B4E9B",
    },
  },
};

export const NODE_STYLE_ORDER: NodeStylePreset[] = ["MINIMAL", "MIDNIGHT", "ORGANIC", "EDITORIAL"];

/** 種類の名前と、カードの上に出す小さな印 */
export const ROLE_INFO: Record<NodeRole, { label: string; icon: string; hint: string }> = {
  CORE: { label: "Core", icon: "◆", hint: "A key concept" },
  SUPPORTING: { label: "Supporting", icon: "·", hint: "Detail that backs up a concept" },
  IMPORTANT: { label: "Important", icon: "!", hint: "Something to remember" },
  EXAMPLE: { label: "Example", icon: "</>", hint: "A worked example or snippet" },
  QUESTION: { label: "Question", icon: "?", hint: "Something to review or find out" },
};

export const ROLE_ORDER: NodeRole[] = ["CORE", "SUPPORTING", "IMPORTANT", "EXAMPLE", "QUESTION"];

/** 種類の印の行の高さ（px）。カードの大きさを中身に合わせるときにも使う */
export const ROLE_LABEL_HEIGHT = 18;

/**
 * カード1枚の見た目（背景・枠・文字色・題名の強さ）。所有者が選んだカードの色・文字の色はプリセットより優先する。
 * readableOn は、選ばれたカードの色の上で読める文字色を返す関数（CategoryChip の readableTextColor）。
 */
export function cardAppearance(input: {
  preset: NodeStylePreset;
  role: NodeRole | null;
  isRoot: boolean;
  hasChildren: boolean;
  cardColor: string | null;
  textColor: string | null;
  readableOn: (background: string) => string;
}) {
  const t = NODE_STYLES[input.preset];
  const accent = input.role ? t.accent[input.role] : null;
  let background = input.isRoot ? t.root : input.role === "SUPPORTING" ? t.supporting : t.card;
  // 「Important」「Question」は差し色をうっすら混ぜて目に入るように
  if (!input.isRoot && accent && (input.role === "IMPORTANT" || input.role === "QUESTION")) {
    background = `color-mix(in srgb, ${accent} 9%, ${t.card})`;
  }
  if (input.cardColor) background = input.cardColor;
  const text =
    input.textColor ??
    (input.cardColor ? input.readableOn(input.cardColor) : input.isRoot ? t.rootText : t.text);

  let border = `1px solid ${t.border}`;
  let shadow: string | undefined;
  // 外側の半透明の輪（halo）。強さは 中心 > Core > Important > Supporting の順で、大事なものほど目に入る。
  // 中心は自分の色を文字色の方へ寄せた太めの枠と輪（カードの色を変えても、その色から作るので合う）
  let halo: { color: string; width: number } | undefined;
  if (input.isRoot) {
    border = `2.5px solid color-mix(in srgb, ${background} 55%, ${text})`;
    halo = { color: `color-mix(in srgb, ${background} 35%, transparent)`, width: 7 };
  } else if (accent) {
    if (input.role === "CORE") {
      border = `2px solid ${accent}`;
      halo = { color: `color-mix(in srgb, ${accent} 30%, transparent)`, width: 5 };
    }
    if (input.role === "EXAMPLE") border = `1.5px dashed ${accent}`;
    if (input.role === "QUESTION")
      border = `1.5px solid color-mix(in srgb, ${accent} 55%, transparent)`;
    if (input.role === "IMPORTANT") {
      // 左に太い差し色の帯（NodeCard）に加えて、差し色の枠と輪
      border = `1.5px solid color-mix(in srgb, ${accent} 70%, transparent)`;
      halo = { color: `color-mix(in srgb, ${accent} 25%, transparent)`, width: 4 };
      shadow = `inset 4px 0 0 ${accent}`;
    }
    if (input.role === "SUPPORTING") {
      border = `1.5px solid color-mix(in srgb, ${accent} 45%, transparent)`;
      halo = { color: `color-mix(in srgb, ${accent} 16%, transparent)`, width: 3 };
    }
  }
  return {
    background,
    text,
    border,
    shadow,
    halo,
    accent,
    titleFont: t.titleFont,
    // 題名の強さ: Core と中心は太く、枝を持つアイデアはやや太く、Supporting は軽く
    titleWeight:
      input.isRoot || input.role === "CORE"
        ? 800
        : input.role === "SUPPORTING"
          ? 600
          : input.hasChildren
            ? 800
            : 700,
    /** 題名の大きさの上乗せ（px） */
    titleBoost: input.role === "CORE" ? 2 : input.role === "SUPPORTING" ? -1 : 0,
    noteFont:
      input.role === "EXAMPLE" ? "ui-monospace, SFMono-Regular, Menlo, monospace" : undefined,
  };
}
