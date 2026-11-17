// カードの中身と、大きさが未設定のときに中身に合わせる大きさ（manifests/nodes.md §3.5 Card shape and size）。
// NodeCard の描画と同じ寸法をここで1か所に決め、計算した大きさと実際の見た目がずれないようにする。
import { NODE_FONT_SIZE_DEFAULT, type NodeDetails, type NodeSkeleton } from "@highdea/shared";

import { domainOf } from "../../lib/urls";
import { toVideoEmbed } from "../../lib/videoEmbed";
import { isStructured, parseNote } from "./noteSections";

/** カードの左右の余白（px-3.5）、文字の上下の余白（py-3 の合計）、題名とメモの間の線の上下 */
export const CARD_PAD_X = 14;
const TEXT_PAD_Y = 24;
export const DIVIDER_SPACE = 13;
/** カードの枠線（上下・左右で合計 2px）と、文字の幅の測り誤差の余裕（px） */
const CARD_BORDER = 2;
const MEASURE_SLACK = 3;
/** メモがあるときの題名の最大行数 */
export const TITLE_LINES_WITH_NOTE = 3;
/** 中身に合わせるときの上限: 題名（メモなし）の行数、幅、高さ */
const MAX_TITLE_LINES = 4;
const MAX_AUTO_WIDTH = 300;
const MAX_AUTO_HEIGHT = 460;
/** 横並びのときの小さなサムネイル（size-14）と間隔、リンクの「開く」ボタンの幅 */
const THUMB_BOX = 56 + 10;
const OPEN_LINK_BOX = 32;
/** 上に絵を置くときの、絵の上の余白と比率（16:9） */
export const BANNER_TOP = 14;
const BANNER_RATIO = 9 / 16;

/** 大きさが未設定のときの最小の大きさ（以前の既定の大きさ） */
export const MIN_CARD = { width: 200, height: 84 };
export const MIN_ROOT_CARD = { width: 280, height: 110 };
/** 中身に合わせたとき、メモがこの行数を超えたら縮めて「Show more」を出す（manifests/nodes.md §3.5 Expandable cards） */
export const COLLAPSED_NOTE_LINES = 6;
/** 広げたときの上限の行数と幅、「Show more / Show less」の行の高さ */
const MAX_EXPANDED_LINES = 30;
const EXPANDED_WIDTH = 320;
export const TOGGLE_HEIGHT = 26;
/** 中心のアイデアのメモは短い説明として、この行数まで */
export const ROOT_NOTE_LINES = 3;
/** メモの見出しの行の高さ、かたまりの間の余白、コードの上下の内側の余白 */
export const BLOCK_LABEL_HEIGHT = 16;
export const BLOCK_GAP = 8;
export const CODE_PAD = 12;
/** 種類の印の行の高さ（nodeStyles.ts の ROLE_LABEL_HEIGHT と同じ） */
const ROLE_ROW = 18;

/**
 * 文字の大きさと行の高さ（px）。メモは選んだ大きさ（既定 13）、題名はそれより 2px（中心のアイデアは 5px）大きい太字。
 * titleBoost は種類による上乗せ（Core +2、Supporting −1: nodeStyles.ts cardAppearance）。
 */
export function textMetrics(fontSize: number | null, isRoot: boolean, titleBoost = 0) {
  const note = fontSize ?? NODE_FONT_SIZE_DEFAULT;
  const title = note + (isRoot ? 5 : 2) + titleBoost;
  return {
    note,
    noteLineHeight: Math.round(note * 1.4),
    title,
    titleLineHeight: Math.round(title * 1.3),
    code: Math.round(note * 0.92),
    codeLineHeight: Math.round(note * 0.92 * 1.45),
  };
}

/** 種類ごとの題名の大きさの上乗せ（cardAppearance と同じ値） */
export function titleBoostFor(role: NodeSkeleton["role"]): number {
  return role === "CORE" ? 2 : role === "SUPPORTING" ? -1 : 0;
}

/** サムネイル画像の URL（リンクのプレビュー画像・動画サムネイル・アップロード画像） */
export function thumbnailOf(
  node: Pick<NodeSkeleton, "type">,
  details: NodeDetails | undefined,
): string | null {
  if (!details) return null;
  if (node.type === "IMAGE") return details.imageUrl;
  if (node.type === "LINK") return details.previewImageUrl;
  if (node.type === "VIDEO" && details.url) return toVideoEmbed(details.url)?.thumbnailUrl ?? null;
  return null;
}

/** 題名の下に出す文（メモ）。メモがあればそれを全部。なければリンクはページ題名とドメイン、動画はドメイン */
export function noteOf(
  node: Pick<NodeSkeleton, "type">,
  details: NodeDetails | undefined,
): string | null {
  if (!details) return null;
  if (details.body?.trim()) return details.body.trim();
  if (node.type === "LINK" && details.url) {
    const domain = domainOf(details.url);
    return details.previewTitle ? `${details.previewTitle} · ${domain}` : domain;
  }
  if (node.type === "VIDEO" && details.url) return domainOf(details.url);
  return null;
}

/**
 * 絵を大きく見せるか（中身がまだなくても、画像と動画は絵がある前提で場所を取る）。
 */
export function hasMedia(node: Pick<NodeSkeleton, "type">, details: NodeDetails | undefined) {
  if (node.type === "IMAGE" || node.type === "VIDEO") return true;
  return node.type === "LINK" && Boolean(details?.previewImageUrl);
}

/** 上に置く絵の高さ（カードの幅から 16:9） */
export function bannerHeight(width: number): number {
  return Math.round((width - CARD_PAD_X * 2) * BANNER_RATIO);
}

/** 絵を上に大きく置くか、左に小さく置くか。小さくされたカードでは横並びにして文字の場所を残す */
export function usesBanner(width: number, height: number, media: boolean): boolean {
  return media && width >= 140 && height >= 150;
}

let context: CanvasRenderingContext2D | null | undefined;
const widthCache = new Map<string, number>();

/** 文字の幅（px）。canvas で測る。使えない環境（テスト）では文字数からの概算 */
function textWidth(text: string, font: string, size: number): number {
  const key = `${font}|${text}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;
  if (context === undefined) {
    try {
      context = document.createElement("canvas").getContext("2d");
    } catch {
      context = null;
    }
  }
  let width: number;
  if (context) {
    context.font = font;
    width = context.measureText(text).width;
  } else {
    width = text.length * size * 0.55;
  }
  if (widthCache.size > 20_000) widthCache.clear();
  widthCache.set(key, width);
  return width;
}

/**
 * 折り返したときの行数（純粋に近い関数。単語の途中では折らず、1語が幅を超えるときだけ語の中で折る＝ break-words と同じ）。
 * 改行は段落として残す（whitespace-pre-line と同じ）。
 */
export function countLines(
  text: string,
  weight: 400 | 700,
  size: number,
  maxWidth: number,
  mono = false,
): number {
  const family = mono
    ? "ui-monospace, SFMono-Regular, Menlo, monospace"
    : '"Nunito Variable", ui-sans-serif, system-ui, sans-serif';
  const font = `${String(weight)} ${String(size)}px ${family}`;
  const space = textWidth(" ", font, size);
  let lines = 0;
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter((w) => w !== "");
    if (words.length === 0) {
      lines += 1;
      continue;
    }
    let current = 0;
    lines += 1;
    for (const word of words) {
      const w = textWidth(word, font, size);
      if (w > maxWidth) {
        // 1語が1行に入らないときは、語の中で折り返す
        if (current > 0) lines += 1;
        const extra = Math.ceil(w / maxWidth);
        lines += extra - 1;
        current = w - (extra - 1) * maxWidth;
        continue;
      }
      const next = current === 0 ? w : current + space + w;
      if (next > maxWidth) {
        lines += 1;
        current = w;
      } else {
        current = next;
      }
    }
  }
  return lines;
}

type SizingNode = Pick<NodeSkeleton, "type" | "title" | "shape" | "fontSize" | "role"> & {
  isRoot: boolean;
};

/** 文字に使える幅（左右の余白・枠・左の小さな絵・リンクの「開く」ボタンを除く） */
export function textWidthFor(node: SizingNode, width: number, media: boolean): number {
  const sideThumb = !node.isRoot && node.type !== "TEXT" && !media;
  return (
    width -
    CARD_PAD_X * 2 -
    CARD_BORDER -
    MEASURE_SLACK -
    (sideThumb ? THUMB_BOX : 0) -
    (node.type === "LINK" && !media ? OPEN_LINK_BOX : 0)
  );
}

/**
 * メモの中身と、表示に必要な高さ・行数（カードの大きさの計算と描画で同じ値を使う）。
 * 見出し・コードがあればかたまりごとに数え、なければ文として数える。長ければ「Show more」で広げられる。
 */
export function noteContent(
  node: SizingNode,
  details: NodeDetails | undefined,
  textWidth: number,
  metrics: ReturnType<typeof textMetrics>,
) {
  const note = node.isRoot ? (details?.body?.trim() ?? null) : noteOf(node, details);
  if (!note) return null;
  const mono = node.role === "EXAMPLE";
  const blocks = parseNote(note);
  const structured = isStructured(blocks);
  let height = 0;
  let lines = 0;
  blocks.forEach((block, i) => {
    if (i > 0) height += block.label ? DIVIDER_SPACE : BLOCK_GAP;
    if (block.label) height += BLOCK_LABEL_HEIGHT;
    if (block.kind === "code") {
      const n = countLines(block.text, 400, metrics.code, textWidth - 16, true);
      lines += n;
      height += n * metrics.codeLineHeight + CODE_PAD;
    } else {
      const n = countLines(block.text, 400, metrics.note, textWidth, mono);
      lines += n;
      height += n * metrics.noteLineHeight;
    }
  });
  if (!structured) height = lines * metrics.noteLineHeight;
  /** 縮めたときに出す文（見出しは「Why: …」のように文の中に残す） */
  const summary = blocks.map((b) => (b.label ? `${b.label}: ${b.text}` : b.text)).join("\n");
  return {
    note,
    blocks,
    structured,
    summary,
    lines,
    height,
    mono,
    expandable: !node.isRoot && lines > COLLAPSED_NOTE_LINES,
  };
}

/**
 * 大きさが未設定のカードの大きさ（中身に合わせる）。題名・メモ・絵（画像・動画・リンクのプレビュー）が読めるよう広げる。
 * 長いメモは「Show more」で縮めて出し（expanded で全体）、種類の印・見出し・コードの分も高さに入れる。
 * 最小は以前の既定の大きさ（中心のアイデアは 280 × 110）。
 */
export function autoCardSize(
  node: SizingNode,
  details: NodeDetails | undefined,
  expanded = false,
): { width: number; height: number } {
  const min = node.isRoot ? MIN_ROOT_CARD : MIN_CARD;
  const metrics = textMetrics(node.fontSize, node.isRoot, titleBoostFor(node.role));
  const rawNote = node.isRoot ? (details?.body?.trim() ?? null) : noteOf(node, details);
  const media = !node.isRoot && hasMedia(node, details);
  const noteLength = rawNote?.length ?? 0;

  // 幅: 長いメモ・絵のあるカードは少し広く。文字が大きいときもその分広げる
  let width = min.width;
  if (media) width = Math.max(width, 240);
  // 左に小さな絵（と、リンクなら「開く」ボタン）が並ぶカードは、文字の場所が狭くならないよう少し広く
  if (!node.isRoot && node.type !== "TEXT" && !media) width = Math.max(width, 240);
  if (noteLength > 140) width = Math.max(width, 260);
  if (noteLength > 320) width = Math.max(width, MAX_AUTO_WIDTH);
  width = Math.min(
    MAX_AUTO_WIDTH,
    Math.round(width * Math.max(1, metrics.note / NODE_FONT_SIZE_DEFAULT)),
  );
  let content = noteContent(node, details, textWidthFor(node, width, media), metrics);
  if (expanded && content?.expandable) {
    width = Math.max(width, EXPANDED_WIDTH);
    content = noteContent(node, details, textWidthFor(node, width, media), metrics);
  }
  const textWidthAvailable = textWidthFor(node, width, media);

  const titleLines = Math.min(
    content ? TITLE_LINES_WITH_NOTE : MAX_TITLE_LINES,
    countLines(node.title, 700, metrics.title, textWidthAvailable),
  );
  let noteHeight = 0;
  if (content) {
    if (node.isRoot) {
      noteHeight = Math.min(content.lines, ROOT_NOTE_LINES) * metrics.noteLineHeight;
    } else if (!content.expandable) {
      noteHeight = content.height;
    } else if (expanded) {
      noteHeight =
        Math.min(content.height, MAX_EXPANDED_LINES * metrics.noteLineHeight) + TOGGLE_HEIGHT;
    } else {
      noteHeight = COLLAPSED_NOTE_LINES * metrics.noteLineHeight + TOGGLE_HEIGHT;
    }
  }
  const textHeight =
    TEXT_PAD_Y +
    (!node.isRoot && node.role ? ROLE_ROW : 0) +
    titleLines * metrics.titleLineHeight +
    (noteHeight > 0 ? DIVIDER_SPACE + noteHeight : 0);

  const sideThumb = !node.isRoot && node.type !== "TEXT" && !media;
  let height = CARD_BORDER + (media ? BANNER_TOP + bannerHeight(width) : 0) + textHeight;
  if (sideThumb) height = Math.max(height, 56 + TEXT_PAD_Y);
  height = Math.min(expanded ? 900 : MAX_AUTO_HEIGHT, Math.max(min.height, Math.ceil(height)));

  // ピル・円は丸い部分に文字がかからないよう、形の余白（shapePadding）の分だけ全体を広げる
  if (node.shape === "PILL" || node.shape === "ELLIPSE") {
    const inner = { width: width - CARD_PAD_X * 2, height };
    let w = width;
    let h = height;
    // 余白は大きさで変わるので、収まるまで数回だけ広げ直す
    for (let i = 0; i < 4; i++) {
      const pad = shapePadding(node.shape, w, h);
      w = Math.round(inner.width + pad.x * 2);
      h = Math.round(inner.height + pad.y * 2);
    }
    width = Math.min(MAX_AUTO_WIDTH + 160, w);
    height = Math.min(MAX_AUTO_HEIGHT + 160, h);
  }
  return { width, height };
}

/**
 * 形に合わせた内側の余白（px）。丸い部分に文字がかからないよう、文字の四角の角が曲線の内側に来る値にする。
 * - ピル: 両端は半径 h/2 の半円。上下の余白 py のとき、角が円に入る左右の余白は r − √(r² − (r − py)²)
 * - 楕円: 内接する四角は各軸の 1/√2（左右・上下とも約 15% ずつ）
 * - 角丸・四角: 一定（左右 14px、上下は文字のブロック側の 12px のみ）
 * y は文字のブロック（上下 12px を自前で持つ）に足す分。
 */
export function shapePadding(
  shape: NodeSkeleton["shape"],
  width: number,
  height: number,
): { x: number; y: number } {
  if (shape === "PILL") {
    const r = Math.min(width, height) / 2;
    const py = Math.max(12, r * 0.18);
    const inset = r - Math.sqrt(Math.max(0, r * r - (r - py) ** 2));
    return { x: Math.round(inset + 8), y: Math.round(py - 12) };
  }
  if (shape === "ELLIPSE") {
    const k = 1 - Math.SQRT1_2;
    return {
      x: Math.round((width / 2) * k + 6),
      y: Math.max(0, Math.round((height / 2) * k + 6 - 12)),
    };
  }
  return { x: CARD_PAD_X, y: 0 };
}
