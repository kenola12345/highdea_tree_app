import { Modal } from "../../components/Modal";
import { toVideoEmbed } from "../../lib/videoEmbed";

export type MediaNode = {
  title: string;
  type: "IMAGE" | "VIDEO";
  imageUrl: string | null;
  url: string | null;
};

type MediaViewerModalProps = { node: MediaNode | null; onClose: () => void };

/**
 * M-10 画像の原寸表示、または YouTube / Vimeo の埋め込み再生。Esc か背景で閉じる（manifests/nodes.md M-10）。
 * 動画の iframe は URL から取り出した動画IDで組み立てた固定のURLだけを使い、ユーザーの URL をそのまま埋め込まない。
 */
export function MediaViewerModal({ node, onClose }: MediaViewerModalProps) {
  const embed = node?.type === "VIDEO" && node.url ? toVideoEmbed(node.url) : null;
  return (
    <Modal open={Boolean(node)} title={node?.title ?? ""} onClose={onClose} testId="media-viewer">
      {node?.type === "IMAGE" && node.imageUrl && (
        <img
          src={node.imageUrl}
          alt={node.title}
          className="mx-auto max-h-[70vh] w-auto rounded-lg object-contain"
        />
      )}
      {node?.type === "VIDEO" &&
        (embed ? (
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
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
      {node?.type === "IMAGE" && !node.imageUrl && (
        <p className="text-sm text-slate-600">The image isn&apos;t available.</p>
      )}
    </Modal>
  );
}
