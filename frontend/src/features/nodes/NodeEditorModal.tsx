import type { NodeDetails, NodeSkeleton } from "@highdea/shared";
import { type SubmitEvent, useState } from "react";

import { ApiError } from "../../api/client";
import { useLinkPreview } from "../../api/linkPreview";
import { useUpdateNode } from "../../api/nodes";
import { FormField, inputClassName } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { toVideoEmbed } from "../../lib/videoEmbed";
import { ImageUploadField } from "./ImageUploadField";
import { LinkPreviewCard } from "./LinkPreviewCard";
import { buildUpdateBody, type NodeFormValues, type NodeType } from "./nodeForm";
import { TypeTabs } from "./TypeTabs";

type NodeEditorModalProps = {
  treeId: string;
  node: NodeSkeleton | null;
  details: NodeDetails | undefined;
  /** 枝の追加直後に開くときの初期の種類（M-05 で選んだもの） */
  initialType?: NodeType;
  onClose: () => void;
};

/**
 * M-04 ノードの編集: 種類（Text / Link / Video / Image）、題名、メモ、URL（入力中にプレビュー）、画像のアップロード。
 * 種類を切り替えても題名とメモは残る（manifests/nodes.md M-04）。保存は PATCH /api/nodes/:id。
 */
export function NodeEditorModal(props: NodeEditorModalProps) {
  return (
    <Modal
      open={Boolean(props.node)}
      title="Edit idea"
      onClose={props.onClose}
      testId="node-editor-modal"
    >
      {props.node && <NodeEditorForm key={props.node.id} {...props} node={props.node} />}
    </Modal>
  );
}

function NodeEditorForm({
  treeId,
  node,
  details,
  initialType,
  onClose,
}: NodeEditorModalProps & { node: NodeSkeleton }) {
  const [values, setValues] = useState<NodeFormValues>({
    type: initialType ?? node.type,
    title: node.title,
    body: details?.body ?? "",
    url: details?.url ?? "",
    newUploadId: null,
  });
  const [newImageUrl, setNewImageUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<"title" | "body" | "url" | "image", string>>>(
    {},
  );
  const update = useUpdateNode(treeId);
  const preview = useLinkPreview(values.url, values.type === "LINK");
  const embed = values.type === "VIDEO" ? toVideoEmbed(values.url) : null;
  const set = <K extends keyof NodeFormValues>(key: K, value: NodeFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
  };

  function submit(e: SubmitEvent) {
    e.preventDefault();
    const nextErrors: typeof errors = {};
    if (!values.title.trim()) nextErrors.title = "Enter a title";
    if (values.body.length > 10_000) nextErrors.body = "Use 10,000 characters or fewer";
    if (values.type === "VIDEO" && values.url.trim() && !embed)
      nextErrors.url = "Enter a YouTube or Vimeo URL";
    if (preview.status === "notAllowed") nextErrors.url = preview.message;
    const built = buildUpdateBody(
      { type: node.type, url: details?.url ?? null },
      { ...values, title: values.title.trim() },
    );
    if (!built.ok) nextErrors[built.field] = built.message;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !built.ok) return;

    update.mutate(
      { id: node.id, body: built.body },
      {
        onSuccess: onClose,
        onError: (err) => {
          // 掃除ジョブが画像を消していた場合は、他の入力を残したまま再アップロードを求める（manifests/nodes.md）
          if (err instanceof ApiError && err.code === "UPLOAD_NOT_FOUND") {
            setErrors({ image: "This image is no longer available. Please upload it again." });
          } else if (err instanceof ApiError && err.details) {
            setErrors(
              Object.fromEntries(
                err.details.map((d) => [
                  d.field === "imageUploadId" ? "image" : d.field,
                  d.message,
                ]),
              ),
            );
          }
        },
      },
    );
  }

  const currentImage = newImageUrl ?? (node.type === "IMAGE" ? (details?.imageUrl ?? null) : null);
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <TypeTabs
        value={values.type}
        onChange={(type) => {
          set("type", type);
        }}
      />
      <FormField id="node-title" label="Title" error={errors.title}>
        {(p) => (
          <input
            {...p}
            value={values.title}
            maxLength={200}
            onChange={(e) => {
              set("title", e.target.value);
            }}
            className={inputClassName}
          />
        )}
      </FormField>

      {(values.type === "LINK" || values.type === "VIDEO") && (
        <FormField
          id="node-url"
          label={values.type === "VIDEO" ? "YouTube or Vimeo URL" : "URL"}
          error={errors.url ?? (preview.status === "notAllowed" ? preview.message : undefined)}
        >
          {(p) => (
            <input
              {...p}
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={values.url}
              onChange={(e) => {
                set("url", e.target.value);
              }}
              className={inputClassName}
            />
          )}
        </FormField>
      )}
      {values.type === "LINK" && <LinkPreviewCard state={preview} />}
      {values.type === "VIDEO" && embed && (
        <div
          className="aspect-video overflow-hidden rounded-lg bg-black"
          data-testid="video-preview"
        >
          <iframe
            src={embed.src}
            title="Video preview"
            allow="encrypted-media; picture-in-picture"
            className="size-full"
          />
        </div>
      )}
      {values.type === "IMAGE" && (
        <ImageUploadField
          currentUrl={currentImage}
          error={errors.image}
          onUploaded={(upload) => {
            set("newUploadId", upload.id);
            setNewImageUrl(upload.url);
            setErrors((e) => ({ ...e, image: undefined }));
          }}
        />
      )}

      <FormField id="node-body" label="Note (optional)" error={errors.body}>
        {(p) => (
          <div>
            <textarea
              {...p}
              rows={5}
              value={values.body}
              onChange={(e) => {
                set("body", e.target.value);
              }}
              className={inputClassName}
            />
            <p className="mt-1 text-right text-xs text-slate-500 tabular-nums">
              {values.body.length.toLocaleString()} / 10,000
            </p>
          </div>
        )}
      </FormField>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={update.isPending}
          data-testid="node-save"
          className="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {update.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
