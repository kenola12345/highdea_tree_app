import type { NodeStylePreset } from "@highdea/shared";
import clsx from "clsx";
import { type CSSProperties, memo, useLayoutEffect, useRef, useState } from "react";

import { OpenLink } from "../../components/OpenLink";
import { readableTextColor } from "../categories/CategoryChip";
import {
  BANNER_TOP,
  bannerHeight,
  BLOCK_GAP,
  BLOCK_LABEL_HEIGHT,
  CODE_PAD,
  DIVIDER_SPACE,
  hasMedia,
  noteContent,
  shapePadding,
  textMetrics,
  textWidthFor,
  thumbnailOf,
  TITLE_LINES_WITH_NOTE,
  titleBoostFor,
  usesBanner,
} from "./cardContent";
import { toggleExpanded, useIsExpanded } from "./expandedStore";
import { cardSize, type LaidOutNode } from "./layout";
import { cardAppearance, ROLE_INFO } from "./nodeStyles";
import type { NoteBlock } from "./noteSections";
import { useNodeDetail } from "./useNodeDetails";
import type { DetailLevel } from "./viewport";

type NodeCardProps = {
  treeId: string;
  node: LaidOutNode;
  level: DetailLevel;
  selected: boolean;
  /** ツリーのカードの見た目のプリセット（キャンバスとは別） */
  preset?: NodeStylePreset;
  /** 子を持つアイデア（題名を少し強くする） */
  hasChildren?: boolean;
  /** 選択中のアイデアとつながっていないので薄くする（manifests/nodes.md Focus on selection） */
  dimmed?: boolean;
  /** ドラッグ中のドロップ先（付け替え先）として強調する */
  highlighted?: boolean;
  /** ドラッグで持ち上げている枝 */
  lifted?: boolean;
};

type Appearance = ReturnType<typeof cardAppearance>;
type Metrics = ReturnType<typeof textMetrics>;

/** 形ごとの角の丸み（manifests/nodes.md §3.5 Card shape and size） */
const SHAPE_CLASS: Record<LaidOutNode["shape"], string> = {
  ROUNDED: "rounded-xl",
  RECTANGLE: "rounded-none",
  PILL: "rounded-full",
  // 楕円は角が大きく欠けるので、中身を中央に寄せる（余白は shapePadding）
  ELLIPSE: "rounded-[50%] justify-center text-center",
};

/** 題名が何行まで入るか（カードの高さから。行の高さ・上下の余白はおおよその値） */
function titleLines(height: number, lineHeight: number): number {
  return Math.max(1, Math.min(12, Math.floor((height - 20) / lineHeight)));
}

/** 行数で切り詰める（Tailwind の line-clamp-* は固定値なので、カードの高さに合わせて style で指定する） */
export function clampStyle(lines: number) {
  return {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical" as const,
    WebkitLineClamp: lines,
    overflow: "hidden",
  };
}

const TYPE_ICON: Record<LaidOutNode["type"], string> = {
  TEXT: "✎",
  LINK: "🔗",
  VIDEO: "▶",
  IMAGE: "🖼",
};

/**
 * ノード1つの描画。倍率に応じて点・短い題名・カードを切り替える。カードの色・枠・題名の強さは、ツリーのプリセットと
 * アイデアの種類（Core / Supporting / Important / Example / Question）で決まり、所有者が選んだ色はそれより優先する
 * （manifests/nodes.md §3.5 Idea kinds / Node style presets）。中身は遅延取得なので、届くまでは題名だけの仮表示にする。
 * 要素に data-node-id を付け、キャンバスやエディタがポインター操作の対象ノードを判別できるようにする。
 */
export const NodeCard = memo(function NodeCard({
  treeId,
  node,
  level,
  selected,
  preset = "MINIMAL",
  hasChildren = false,
  dimmed = false,
  highlighted = false,
  lifted = false,
}: NodeCardProps) {
  const { width, height } = cardSize(node);
  const padding = shapePadding(node.shape, width, height);
  const x = node.x - width / 2;
  const y = node.y - height / 2;
  const look = cardAppearance({
    preset,
    role: node.isRoot ? null : node.role,
    isRoot: node.isRoot,
    hasChildren,
    cardColor: node.cardColor,
    textColor: node.textColor,
    readableOn: readableTextColor,
  });

  if (level === "dot") {
    return (
      <circle
        data-node-id={node.id}
        data-testid="node-dot"
        cx={node.x}
        cy={node.y}
        r={node.isRoot ? 28 : 18}
        className={clsx(
          "transition-opacity duration-200",
          selected && "stroke-brand-700",
          highlighted && "stroke-sun",
        )}
        style={{
          fill: node.cardColor ?? (node.isRoot ? look.background : (look.accent ?? look.text)),
          opacity: dimmed ? 0.25 : 1,
        }}
        strokeWidth={selected || highlighted ? 8 : 0}
      />
    );
  }

  return (
    <foreignObject
      x={x}
      y={y}
      width={width}
      height={height}
      data-node-id={node.id}
      className="overflow-visible transition-opacity duration-200"
      style={{ opacity: dimmed ? 0.28 : 1 }}
    >
      <div
        data-testid="node-card"
        data-node-type={node.type}
        data-shape={node.shape}
        data-role={node.role ?? undefined}
        data-dimmed={dimmed || undefined}
        aria-selected={selected}
        // 背景・文字・枠はプリセットと種類から（選んだカードの色・文字の色が優先: cardAppearance）
        style={{
          background: look.background,
          color: look.text,
          border: look.border,
          // 形に合わせた余白（ピル・円は大きさに応じて、丸い部分に文字がかからない値）
          paddingInline: padding.x,
          paddingBlock: padding.y,
        }}
        className={clsx(
          "relative flex h-full w-full cursor-pointer items-center gap-2.5 overflow-hidden shadow-sm select-none",
          SHAPE_CLASS[node.shape],
          selected && (node.isRoot ? "ring-brand-300 ring-4" : "ring-brand-500 ring-2"),
          highlighted && "ring-sun ring-4",
          lifted && "opacity-90 shadow-xl",
        )}
      >
        {/* 「Important」は左に差し色の帯 */}
        {node.role === "IMPORTANT" && look.accent && (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-1"
            style={{ background: look.accent }}
          />
        )}
        {level === "title" ? (
          // 縮小して題名だけを出すときも、種類の印は残して大事なアイデアが目に入るようにする
          <div className="min-w-0 flex-1">
            {!node.isRoot && node.role && (
              <p
                data-testid="card-role"
                className="mb-0.5 text-xs font-extrabold tracking-[0.08em] uppercase"
                style={{ color: look.accent ?? undefined }}
              >
                {ROLE_INFO[node.role].icon} {ROLE_INFO[node.role].label}
              </p>
            )}
            <p
              className={clsx(node.isRoot ? "text-xl" : "text-lg")}
              style={{
                fontFamily: look.titleFont,
                fontWeight: look.titleWeight,
                ...clampStyle(titleLines(height - (node.role ? 18 : 0), node.isRoot ? 28 : 26)),
              }}
            >
              {node.title}
            </p>
          </div>
        ) : (
          <CardContent treeId={treeId} node={node} width={width} height={height} look={look} />
        )}
      </div>
    </foreignObject>
  );
});

/**
 * カード全体の中身（読める倍率のとき）。画像・動画・リンクのプレビューは、場所があれば上に大きく（16:9）、
 * 小さくされたカードでは左に小さく置く（manifests/nodes.md §3.5 Card shape and size）。
 */
function CardContent({
  treeId,
  node,
  width,
  height,
  look,
}: {
  treeId: string;
  node: LaidOutNode;
  width: number;
  height: number;
  look: Appearance;
}) {
  const details = useNodeDetail(treeId, node.id);
  const expanded = useIsExpanded(treeId, node.id);
  const metrics = textMetrics(node.fontSize, node.isRoot, titleBoostFor(node.role));
  const media = !node.isRoot && hasMedia(node, details);
  const content = noteContent(node, details, textWidthFor(node, width, media), metrics);
  // 大きさを変えていないカードだけ、長いメモを「Show more / Show less」で開閉できる
  const autoSized = node.width === null && node.height === null;
  const toggle =
    autoSized && content?.expandable
      ? {
          expanded,
          onToggle: () => {
            toggleExpanded(treeId, node.id);
          },
        }
      : null;

  const text = (pictureHeight = 0) => (
    <TitleAndNote
      title={node.title}
      content={content}
      root={node.isRoot}
      role={node.isRoot ? null : node.role}
      loading={!details && node.type !== "TEXT"}
      height={pictureHeight > 0 ? height - BANNER_TOP - pictureHeight : height}
      metrics={metrics}
      look={look}
      showBlocks={Boolean(content?.structured && autoSized && (!content.expandable || expanded))}
      toggle={toggle}
      centered={node.isRoot || node.shape === "ELLIPSE"}
    />
  );

  if (node.isRoot) return text();

  const thumbnail = thumbnailOf(node, details);
  const banner = usesBanner(width, height, media);
  const openLink = node.type === "LINK" && (
    <OpenLink
      url={details?.url}
      testId="card-open-link"
      className={clsx(
        "size-8 shrink-0 justify-center rounded-lg text-base",
        banner
          ? "absolute top-1.5 right-1.5 bg-white/85 text-slate-900 shadow-sm hover:bg-white"
          : "-mr-1 self-start hover:bg-black/10",
      )}
    >
      <span aria-hidden="true">↗</span>
      <span className="sr-only">Open link</span>
    </OpenLink>
  );

  if (banner) {
    // 文字が最低1行は入るよう、絵の高さは「カードの高さ − 80px」までにする
    const pictureHeight = Math.min(bannerHeight(width), height - 80);
    return (
      <div className="flex h-full w-full flex-col" data-testid="card-banner-layout">
        <div
          className="relative mt-3.5 w-full shrink-0 overflow-hidden rounded-lg bg-slate-100"
          style={{ height: pictureHeight }}
        >
          <Picture node={node} thumbnail={thumbnail} large />
          {openLink}
        </div>
        {text(pictureHeight)}
      </div>
    );
  }

  return (
    <>
      {node.type !== "TEXT" && (
        <div className="relative flex size-14 shrink-0 items-center justify-center self-center overflow-hidden rounded-lg bg-slate-100 text-xl text-slate-400">
          <Picture node={node} thumbnail={thumbnail} large={false} />
        </div>
      )}
      {text()}
      {openLink}
    </>
  );
}

/** 画像・動画のサムネイル・リンクのプレビュー画像。なければ種類のアイコン。動画には ▶ を重ねる */
function Picture({
  node,
  thumbnail,
  large,
}: {
  node: LaidOutNode;
  thumbnail: string | null;
  large: boolean;
}) {
  return (
    <>
      {thumbnail ? (
        <img
          src={thumbnail}
          alt=""
          loading="lazy"
          draggable={false}
          className="size-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className={clsx(
            "flex size-full items-center justify-center text-slate-400",
            large ? "text-3xl" : "text-xl",
          )}
        >
          {TYPE_ICON[node.type]}
        </span>
      )}
      {node.type === "VIDEO" && thumbnail && (
        <span
          aria-hidden="true"
          className={clsx(
            "absolute inset-0 flex items-center justify-center bg-black/25 text-white",
            large ? "text-3xl" : "text-lg",
          )}
        >
          ▶
        </span>
      )}
    </>
  );
}

/**
 * 種類の印・題名・メモ（manifests/nodes.md NodeCard）。メモがあれば間に細い線を引く。
 * メモに見出しやコードがあり、全体を出せるときは、かたまりごとに見出し・区切り線・等幅のコードで出す。
 * それ以外は文として入るだけ折り返し、入りきらない最後の行を「…」にする（残りの高さを測って行数を決める）。
 */
function TitleAndNote({
  title,
  content,
  root,
  role,
  loading = false,
  height,
  metrics,
  look,
  showBlocks,
  toggle,
  centered = false,
}: {
  title: string;
  content: ReturnType<typeof noteContent>;
  root: boolean;
  role: LaidOutNode["role"];
  /** 中身を取得中（メモの場所に薄い仮の線を出す） */
  loading?: boolean;
  height: number;
  metrics: Metrics;
  look: Appearance;
  showBlocks: boolean;
  toggle: { expanded: boolean; onToggle: () => void } | null;
  centered?: boolean;
}) {
  const columnRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLParagraphElement>(null);
  const roleRef = useRef<HTMLParagraphElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [noteLines, setNoteLines] = useState(0);
  const hasNote = content !== null;
  const noteText = content ? (content.structured ? content.summary : content.note) : "";

  useLayoutEffect(() => {
    const column = columnRef.current;
    if (!column || !hasNote || showBlocks) return;
    const measure = () => {
      const style = getComputedStyle(column);
      const inner =
        column.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const rest =
        inner -
        (roleRef.current?.offsetHeight ?? 0) -
        (titleRef.current?.offsetHeight ?? 0) -
        (toggleRef.current?.offsetHeight ?? 0) -
        DIVIDER_SPACE;
      setNoteLines(Math.max(0, Math.floor(rest / metrics.noteLineHeight)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(column);
    return () => {
      observer.disconnect();
    };
  }, [hasNote, showBlocks, title, noteText, metrics.noteLineHeight, metrics.titleLineHeight]);

  const titleMax = titleLines(height - 4, metrics.titleLineHeight);
  const showNote = hasNote && (showBlocks || noteLines > 0);
  const noteStyle: CSSProperties = {
    fontSize: metrics.note,
    lineHeight: `${String(metrics.noteLineHeight)}px`,
    fontFamily: content?.mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : undefined,
  };
  return (
    <div
      ref={columnRef}
      className={clsx(
        "flex min-w-0 flex-1 flex-col justify-center self-stretch py-3",
        centered && "items-center text-center",
      )}
    >
      {role && (
        <p
          ref={roleRef}
          data-testid="card-role"
          className="flex h-[18px] shrink-0 items-center gap-1 text-[10px] leading-none font-extrabold tracking-[0.08em] uppercase"
          style={{ color: look.accent ?? undefined }}
        >
          <span aria-hidden="true">{ROLE_INFO[role].icon}</span>
          {ROLE_INFO[role].label}
        </p>
      )}
      <p
        ref={titleRef}
        className="w-full shrink-0 break-words"
        style={{
          fontSize: metrics.title,
          lineHeight: `${String(metrics.titleLineHeight)}px`,
          fontWeight: look.titleWeight,
          fontFamily: look.titleFont,
          ...clampStyle(hasNote ? Math.min(TITLE_LINES_WITH_NOTE, titleMax) : titleMax),
        }}
      >
        {title}
      </p>
      {showNote && (
        <>
          <hr
            aria-hidden="true"
            className="my-1.5 w-full shrink-0 border-t border-current opacity-15"
          />
          {showBlocks ? (
            <NoteBlocks blocks={content.blocks} metrics={metrics} style={noteStyle} />
          ) : (
            <p
              // メモは題名より少し薄く（85%）して、見出しと本文の差を付けつつ読みやすさを保つ
              className={clsx(
                "w-full break-words whitespace-pre-line",
                root ? "opacity-80" : "opacity-85",
              )}
              style={{ ...noteStyle, ...clampStyle(noteLines) }}
              data-testid="card-note"
            >
              {noteText}
            </p>
          )}
        </>
      )}
      {toggle && (
        <button
          ref={toggleRef}
          type="button"
          data-card-control=""
          data-testid="card-expand"
          aria-expanded={toggle.expanded}
          // カードの選択・ドラッグ・ダブルクリック（編集）にならないよう、ここで止める
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            toggle.onToggle();
          }}
          className="mt-0.5 flex h-6 shrink-0 items-center gap-1 self-start rounded-full px-2 text-xs font-bold opacity-70 hover:bg-black/5 hover:opacity-100"
        >
          {toggle.expanded ? "Show less" : "Show more"}
          <span aria-hidden="true">{toggle.expanded ? "▴" : "▾"}</span>
        </button>
      )}
      {loading && <p className="mt-1.5 h-2 w-2/3 animate-pulse rounded bg-current opacity-15" />}
    </div>
  );
}

/** 見出しのあるメモ: かたまりごとに小さな見出し、区切り線、``` のコードは等幅の囲みで出す */
function NoteBlocks({
  blocks,
  metrics,
  style,
}: {
  blocks: NoteBlock[];
  metrics: Metrics;
  style: CSSProperties;
}) {
  return (
    <div className="flex min-h-0 w-full flex-col overflow-hidden text-left" data-testid="card-note">
      {blocks.map((block, i) => (
        <div
          key={i}
          style={{ marginTop: i === 0 ? 0 : block.label ? undefined : BLOCK_GAP }}
          className={clsx(i > 0 && block.label && "mt-1.5 border-t border-current/15 pt-1.5")}
        >
          {block.label && (
            <p
              className="text-[10px] font-extrabold tracking-[0.08em] uppercase opacity-60"
              style={{ height: BLOCK_LABEL_HEIGHT, lineHeight: `${String(BLOCK_LABEL_HEIGHT)}px` }}
            >
              {block.label}
            </p>
          )}
          {block.kind === "code" ? (
            <pre
              className="rounded-md bg-black/5 px-2 font-mono break-words whitespace-pre-wrap"
              style={{
                fontSize: metrics.code,
                lineHeight: `${String(metrics.codeLineHeight)}px`,
                paddingBlock: CODE_PAD / 2,
              }}
            >
              {block.text}
            </pre>
          ) : (
            <p className="break-words whitespace-pre-line opacity-85" style={style}>
              {block.text}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
