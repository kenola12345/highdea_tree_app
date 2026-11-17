import type { NodeGroup, NodeStylePreset } from "@highdea/shared";
import clsx from "clsx";
import { memo } from "react";

import { readableTextColor } from "../categories/CategoryChip";
import { NODE_STYLES } from "./nodeStyles";
import type { DetailLevel } from "./viewport";

/** 見出しの帯の高さ（ワールド座標）。中身に合わせてボックスを作るときも、この分を上にあける */
export const GROUP_HEADER = 44;
/** ボックスの中身のまわりの余白 */
export const GROUP_PADDING = 24;

type GroupBoxProps = {
  group: NodeGroup;
  preset: NodeStylePreset;
  level: DetailLevel;
  selected: boolean;
  /** エディタでは見出しを押して選べる・動かせる */
  interactive: boolean;
  /** 選択中のアイデアのまわりを見せるとき、関係ないボックスを薄くする */
  dimmed?: boolean;
};

/**
 * ボックス（manifests/nodes.md §3.5 Boxes）。角の丸い枠と、見出しの帯（印と題名）。
 * 色はボックスの色（なければプリセットの文字色）を薄く混ぜた半透明の面と枠で、どんなキャンバスの上でも枠が分かる。
 * 本体はポインターを通す（パンや中のアイデアの操作をじゃましない）。見出しだけが押せる。
 */
export const GroupBox = memo(function GroupBox({
  group,
  preset,
  level,
  selected,
  interactive,
  dimmed = false,
}: GroupBoxProps) {
  const t = NODE_STYLES[preset];
  const tint = group.color ?? t.text;
  const { positionX: x, positionY: y, width, height } = group;
  return (
    <g
      data-testid="group-box"
      data-group-id={group.id}
      data-selected={selected || undefined}
      className="transition-opacity duration-200"
      opacity={dimmed ? 0.35 : 1}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={18}
        style={{ fill: `color-mix(in srgb, ${tint} 7%, ${t.card})` }}
        fillOpacity={0.5}
        stroke={selected ? "#F6C945" : tint}
        strokeOpacity={selected ? 1 : 0.35}
        strokeWidth={selected ? 3 : 1.5}
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      {/* 見出しの帯: 押して選ぶ・ドラッグで中身ごと動かす（data-group-header はパンしない印） */}
      <g
        data-group-header={group.id}
        className={clsx(interactive && "cursor-grab active:cursor-grabbing")}
        pointerEvents={interactive ? "all" : "none"}
      >
        <rect x={x} y={y} width={width} height={GROUP_HEADER} rx={18} fill="transparent" />
        {level !== "dot" && (
          <>
            <rect
              x={x + 14}
              y={y + 11}
              width={22}
              height={22}
              rx={6}
              style={{ fill: `color-mix(in srgb, ${tint} 18%, ${t.card})` }}
            />
            <text
              x={x + 25}
              y={y + 26.5}
              textAnchor="middle"
              fontSize={13}
              fontWeight={800}
              fill={tint}
              aria-hidden="true"
            >
              ▦
            </text>
            <text
              x={x + 46}
              y={y + 28}
              fontSize={16}
              fontWeight={800}
              fill={tint}
              data-testid="group-title"
              style={{ fontFamily: t.titleFont }}
            >
              {group.title.length > Math.max(4, Math.floor((width - 64) / 9))
                ? `${group.title.slice(0, Math.max(3, Math.floor((width - 64) / 9) - 1))}…`
                : group.title}
            </text>
          </>
        )}
      </g>
    </g>
  );
});

/** 付箋の既定の色（やわらかい黄色） */
export const NOTE_COLOR = "#FDE68A";

type CanvasItemProps = {
  item: NodeGroup;
  selected: boolean;
  interactive: boolean;
  /** 文字の既定の色（キャンバスの背景に対して読みやすい色） */
  labelColor: string;
};

/**
 * 付箋と文字（manifests/nodes.md §3.5 Add menu and canvas items）。カードより上に描く。
 * 全体が押せる（選ぶ・ドラッグで動かす）。付箋は色付きの紙に自由な文、文字は枠のない大きな文字。
 */
export const CanvasItem = memo(function CanvasItem({
  item,
  selected,
  interactive,
  labelColor,
}: CanvasItemProps) {
  const { positionX: x, positionY: y, width, height } = item;
  const isNote = item.kind === "NOTE";
  const background = item.color ?? NOTE_COLOR;
  const fontSize = Math.round(Math.min(72, Math.max(16, height * 0.5)));
  return (
    <foreignObject
      x={x}
      y={y}
      width={width}
      height={height}
      className="overflow-visible"
      data-testid={isNote ? "canvas-note" : "canvas-label"}
      data-group-id={item.id}
      data-group-header={item.id}
      data-selected={selected || undefined}
      pointerEvents={interactive ? "all" : "none"}
    >
      {isNote ? (
        <div
          className={clsx(
            "h-full w-full overflow-hidden rounded-md p-3 text-sm leading-snug break-words whitespace-pre-wrap shadow-md select-none",
            interactive && "cursor-grab active:cursor-grabbing",
            selected && "ring-sun ring-[3px]",
          )}
          style={{ background, color: readableTextColor(background) }}
        >
          {item.body?.trim() ? item.body : <span className="opacity-50">Note</span>}
        </div>
      ) : (
        <div
          className={clsx(
            "flex h-full w-full items-center overflow-hidden rounded-md px-1 leading-tight font-extrabold break-words select-none",
            interactive && "cursor-grab active:cursor-grabbing",
            selected && "ring-sun ring-2 ring-offset-2 ring-offset-transparent",
          )}
          style={{ fontSize, color: item.color ?? labelColor }}
        >
          <span
            style={{
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: Math.max(1, Math.floor(height / (fontSize * 1.25))),
              overflow: "hidden",
            }}
          >
            {item.title}
          </span>
        </div>
      )}
    </foreignObject>
  );
});

/** ボックスの中にあるアイデア（中心が枠の内側）と、中にすっぽり入っているほかのボックス */
export function contentsOf(
  group: NodeGroup,
  nodes: { id: string; x: number; y: number }[],
  groups: NodeGroup[],
) {
  const inside = (px: number, py: number) =>
    px >= group.positionX &&
    px <= group.positionX + group.width &&
    py >= group.positionY &&
    py <= group.positionY + group.height;
  return {
    nodeIds: nodes.filter((n) => inside(n.x, n.y)).map((n) => n.id),
    groupIds: groups
      .filter(
        (g) =>
          g.id !== group.id &&
          g.positionX >= group.positionX &&
          g.positionY >= group.positionY &&
          g.positionX + g.width <= group.positionX + group.width &&
          g.positionY + g.height <= group.positionY + group.height,
      )
      .map((g) => g.id),
  };
}

/** カードの四角（中心と大きさ）を囲むボックスの位置と大きさ（見出しと余白の分を足す） */
export function rectAround(
  boxes: { x: number; y: number; width: number; height: number }[],
): { positionX: number; positionY: number; width: number; height: number } | null {
  if (boxes.length === 0) return null;
  const minX = Math.min(...boxes.map((b) => b.x - b.width / 2)) - GROUP_PADDING;
  const maxX = Math.max(...boxes.map((b) => b.x + b.width / 2)) + GROUP_PADDING;
  const minY = Math.min(...boxes.map((b) => b.y - b.height / 2)) - GROUP_PADDING - GROUP_HEADER;
  const maxY = Math.max(...boxes.map((b) => b.y + b.height / 2)) + GROUP_PADDING;
  return {
    positionX: Math.round(minX),
    positionY: Math.round(minY),
    width: Math.max(160, Math.round(maxX - minX)),
    height: Math.max(100, Math.round(maxY - minY)),
  };
}
