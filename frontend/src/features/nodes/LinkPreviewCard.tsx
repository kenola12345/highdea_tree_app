import type { PreviewState } from "../../api/linkPreview";
import { domainOf } from "../../lib/urls";

/** URL 入力中のリンクプレビュー。取得できなくても保存はできる（manifests/nodes.md SPA points） */
export function LinkPreviewCard({ state }: { state: PreviewState }) {
  if (state.status === "idle" || state.status === "notAllowed" || state.status === "rateLimited")
    return null;
  if (state.status === "loading") {
    return (
      <p className="text-xs text-slate-500" data-testid="link-preview">
        Loading preview…
      </p>
    );
  }
  if (state.status === "unavailable") {
    return (
      <p className="text-xs text-slate-500" data-testid="link-preview">
        No preview available
      </p>
    );
  }
  const { preview } = state;
  return (
    <div className="flex gap-3 rounded-lg border border-slate-200 p-2" data-testid="link-preview">
      {preview.imageUrl && (
        <img src={preview.imageUrl} alt="" className="size-16 shrink-0 rounded object-cover" />
      )}
      <div className="min-w-0">
        <p className="line-clamp-2 text-sm font-medium">{preview.title ?? domainOf(preview.url)}</p>
        {preview.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{preview.description}</p>
        )}
        <p className="mt-0.5 truncate text-xs text-slate-500">{domainOf(preview.url)}</p>
      </div>
    </div>
  );
}
