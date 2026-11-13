import type { LinkPreviewResponse } from "@highdea/shared";
import { useEffect, useState } from "react";

import { ApiError, apiFetch, jsonBody } from "./client";

/** 入力が止まってからプレビューを取りに行くまでの待ち時間（1分30回の上限に余裕を持たせる: manifests/nodes.md SPA points） */
export const PREVIEW_DEBOUNCE_MS = 500;

export type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; preview: LinkPreviewResponse }
  /** 取得できなかった（422）。保存はできる */
  | { status: "unavailable" }
  /** 内部アドレスなど使えない URL（400 URL_NOT_ALLOWED）。URL 欄にエラーを出す */
  | { status: "notAllowed"; message: string }
  /** 回数制限（429）。入力が落ち着いてから自動で再取得するので目立たせない */
  | { status: "rateLimited" };

/** URL の入力に合わせて、少し待ってからリンクプレビューを取得する */
export function useLinkPreview(url: string, enabled: boolean): PreviewState {
  const [state, setState] = useState<PreviewState>({ status: "idle" });
  const trimmed = url.trim();
  const valid = enabled && /^https?:\/\/\S+\.\S+/.test(trimmed);

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setState({ status: "loading" });
      apiFetch<{ preview: LinkPreviewResponse }>("/link-preview", {
        method: "POST",
        ...jsonBody({ url: trimmed }),
      })
        .then(({ preview }) => {
          if (!cancelled) setState({ status: "ready", preview });
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          if (err instanceof ApiError && err.code === "URL_NOT_ALLOWED")
            setState({ status: "notAllowed", message: err.message });
          else if (err instanceof ApiError && err.code === "RATE_LIMITED")
            setState({ status: "rateLimited" });
          else setState({ status: "unavailable" });
        });
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, valid]);

  return valid ? state : { status: "idle" };
}
