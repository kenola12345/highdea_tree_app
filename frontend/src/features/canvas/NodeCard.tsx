import type { NodeDetails } from "@highdea/shared";
import clsx from "clsx";
import { memo } from "react";

import { domainOf } from "../../lib/urls";
import { toVideoEmbed } from "../../lib/videoEmbed";
import { cardSize, type LaidOutNode } from "./layout";
import { useNodeDetail } from "./useNodeDetails";
import type { DetailLevel } from "./viewport";

type NodeCardProps = {
  treeId: string;
  node: LaidOutNode;
  level: DetailLevel;
  selected: boolean;
};

const TYPE_ICON: Record<LaidOutNode["type"], string> = {
  TEXT: "✎",
  LINK: "🔗",
  VIDEO: "▶",
  IMAGE: "🖼",
};

/**
 * ノード1つの描画。倍率に応じて点・短い題名・カードを切り替え、カードは種類ごとに見た目を変える
 * （TEXT: 題名とメモの1行目 / LINK: サムネイル・ページ題名・ドメイン / VIDEO: ▶付きサムネイル / IMAGE: 画像）。
 * 中身は遅延取得なので、届くまでは題名だけの仮表示にする（manifests/nodes.md NodeCard）。
 * 要素に data-node-id を付け、キャンバスやエディタがポインター操作の対象ノードを判別できるようにする。
 */
export const NodeCard = memo(function NodeCard({ treeId, node, level, selected }: NodeCardProps) {
  const { width, height } = cardSize(node);
  const x = node.x - width / 2;
  const y = node.y - height / 2;

  if (level === "dot") {
    return (
      <circle
        data-node-id={node.id}
        data-testid="node-dot"
        cx={node.x}
        cy={node.y}
        r={node.isRoot ? 28 : 18}
        className={clsx(
          node.isRoot ? "fill-brand-600" : "fill-slate-400",
          selected && "stroke-brand-700",
        )}
        strokeWidth={selected ? 8 : 0}
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
      className="overflow-visible"
    >
      <div
        data-testid="node-card"
        data-node-type={node.type}
        aria-selected={selected}
        className={clsx(
          "flex h-full w-full cursor-pointer items-center gap-2 overflow-hidden rounded-xl border px-3 shadow-sm select-none",
          node.isRoot
            ? "bg-brand-600 border-brand-700 text-white"
            : "border-slate-200 bg-white text-slate-900",
          selected &&
            (node.isRoot ? "ring-brand-300 ring-4" : "ring-brand-500 border-brand-500 ring-2"),
        )}
      >
        {level === "title" ? (
          <p className={clsx("line-clamp-2 font-semibold", node.isRoot ? "text-xl" : "text-lg")}>
            {node.title}
          </p>
        ) : (
          <CardContent treeId={treeId} node={node} />
        )}
      </div>
    </foreignObject>
  );
});

/** カード全体の中身（読める倍率のとき） */
function CardContent({ treeId, node }: { treeId: string; node: LaidOutNode }) {
  const details = useNodeDetail(treeId, node.id);

  if (node.isRoot) {
    return (
      <p className="line-clamp-3 w-full text-center text-base leading-snug font-semibold">
        {node.title}
      </p>
    );
  }

  const thumbnail = thumbnailOf(node, details);
  const subtitle = subtitleOf(node, details);
  return (
    <>
      {node.type !== "TEXT" && (
        <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-xl text-slate-400">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt=""
              loading="lazy"
              draggable={false}
              className="size-full object-cover"
            />
          ) : (
            <span aria-hidden="true">{TYPE_ICON[node.type]}</span>
          )}
          {node.type === "VIDEO" && thumbnail && (
            <span
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center bg-black/30 text-lg text-white"
            >
              ▶
            </span>
          )}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm leading-snug font-semibold">{node.title}</p>
        {subtitle ? (
          <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>
        ) : (
          !details &&
          node.type !== "TEXT" && (
            <p className="mt-1 h-2 w-2/3 animate-pulse rounded bg-slate-100" />
          )
        )}
      </div>
    </>
  );
}

/** サムネイル画像の URL（リンクのプレビュー画像・動画サムネイル・アップロード画像） */
function thumbnailOf(node: LaidOutNode, details: NodeDetails | undefined): string | null {
  if (!details) return null;
  if (node.type === "IMAGE") return details.imageUrl;
  if (node.type === "LINK") return details.previewImageUrl;
  if (node.type === "VIDEO" && details.url) return toVideoEmbed(details.url)?.thumbnailUrl ?? null;
  return null;
}

/** 題名の下の1行（メモの1行目・リンクのページ題名とドメイン） */
function subtitleOf(node: LaidOutNode, details: NodeDetails | undefined): string | null {
  if (!details) return null;
  if (node.type === "LINK" && details.url) {
    const domain = domainOf(details.url);
    return details.previewTitle ? `${details.previewTitle} · ${domain}` : domain;
  }
  if (node.type === "VIDEO" && details.url) return domainOf(details.url);
  return details.body?.split("\n").find((line) => line.trim() !== "") ?? null;
}
