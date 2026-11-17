import type { NodeSkeleton } from "@highdea/shared";
import { useEffect, useRef } from "react";

import { useNodeDetailsQuery } from "../../api/nodeDetails";
import { OpenLink } from "../../components/OpenLink";
import { Spinner } from "../../components/Spinner";
import { domainOf } from "../../lib/urls";
import { toVideoEmbed } from "../../lib/videoEmbed";
import { parseNote } from "../canvas/noteSections";
import type { MediaNode } from "./MediaViewerModal";
import { NODE_TYPES } from "./TypeTabs";

type NodeDetailsPanelProps = {
  treeId: string;
  node: NodeSkeleton | null;
  onClose: () => void;
  /** 画像を押したとき（M-10 で原寸表示） */
  onOpenMedia: (media: MediaNode) => void;
};

/**
 * M-12 アイデアの詳細（読み取り専用）。ビューア（P-06）でアイデアを押すと開く。
 * PC では右側のパネル、スマホでは全画面のシートで表示し、Esc で閉じる（manifests/explore.md M-12）。
 * メモは文字として表示し（HTML として解釈しない）、リンクは新しいタブで開く。
 */
export function NodeDetailsPanel({ treeId, node, onClose, onOpenMedia }: NodeDetailsPanelProps) {
  const { data: details, isPending, isError } = useNodeDetailsQuery(treeId, node?.id ?? null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!node) return;
    closeRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !document.querySelector("[role=dialog][aria-modal=true]"))
        onCloseRef.current();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [node]);

  if (!node) return null;
  const typeInfo = NODE_TYPES.find((t) => t.type === node.type);
  const embed = node.type === "VIDEO" && details?.url ? toVideoEmbed(details.url) : null;

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby="node-details-title"
      data-testid="node-details"
      className="bg-surface animate-sheet-in md:animate-slide-in-right fixed inset-0 z-50 flex flex-col md:absolute md:inset-y-0 md:right-0 md:left-auto md:w-96 md:border-l md:border-slate-200 md:shadow-xl"
    >
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
          <span aria-hidden="true">{typeInfo?.icon}</span> {typeInfo?.label}
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="ml-auto flex size-11 items-center justify-center rounded-lg text-2xl leading-none text-slate-500 hover:bg-slate-100"
        >
          ×
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <h2 id="node-details-title" className="text-xl font-bold break-words">
          {node.title}
        </h2>
        {isPending && <Spinner />}
        {isError && <p className="text-sm text-red-700">Couldn&apos;t load this idea.</p>}
        {details && (
          <>
            {node.type === "LINK" && details.url && (
              <div
                className="space-y-3 rounded-xl border border-slate-200 p-3"
                data-testid="details-link"
              >
                {details.previewImageUrl && (
                  <img
                    src={details.previewImageUrl}
                    alt=""
                    className="max-h-40 w-full rounded-lg object-cover"
                  />
                )}
                <div>
                  <p className="font-medium break-words">
                    {details.previewTitle ?? domainOf(details.url)}
                  </p>
                  {details.previewDescription && (
                    <p className="mt-1 text-sm text-slate-600">{details.previewDescription}</p>
                  )}
                  {details.previewTitle && (
                    <p className="mt-1 truncate text-xs text-slate-500">{domainOf(details.url)}</p>
                  )}
                </div>
                <OpenLink
                  url={details.url}
                  className="bg-brand-700 hover:bg-brand-800 text-surface min-h-11 justify-center rounded-full px-4 text-sm font-medium"
                />
              </div>
            )}
            {node.type === "VIDEO" &&
              (embed ? (
                <div className="aspect-video overflow-hidden rounded-lg bg-black">
                  <iframe
                    src={embed.src}
                    title={node.title}
                    allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    allowFullScreen
                    className="size-full"
                  />
                </div>
              ) : (
                <p className="text-sm text-slate-600">This video can&apos;t be played here.</p>
              ))}
            {node.type === "IMAGE" && details.imageUrl && (
              <button
                type="button"
                onClick={() => {
                  onOpenMedia({
                    title: node.title,
                    type: "IMAGE",
                    imageUrl: details.imageUrl,
                    url: null,
                  });
                }}
                className="block w-full overflow-hidden rounded-lg border border-slate-200"
                aria-label="View full size"
              >
                <img
                  src={details.imageUrl}
                  alt={node.title}
                  className="max-h-72 w-full object-contain"
                />
              </button>
            )}
            {details.body ? (
              // メモの見出し（Why: など）とコード（```）は、カードと同じくかたまりに分けて出す
              <div className="space-y-3" data-testid="details-note">
                {parseNote(details.body).map((block, i) => (
                  <div
                    key={i}
                    className={i > 0 && block.label ? "border-t border-slate-200 pt-3" : ""}
                  >
                    {block.label && (
                      <p className="mb-1 text-[11px] font-extrabold tracking-[0.08em] text-slate-500 uppercase">
                        {block.label}
                      </p>
                    )}
                    {block.kind === "code" ? (
                      <pre className="overflow-x-auto rounded-lg bg-slate-100 px-3 py-2 font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-slate-800">
                        {block.text}
                      </pre>
                    ) : (
                      <p className="text-sm break-words whitespace-pre-wrap text-slate-700">
                        {block.text}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              node.type === "TEXT" && <p className="text-sm text-slate-500">No note.</p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
