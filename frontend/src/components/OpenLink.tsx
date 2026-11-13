import clsx from "clsx";
import type { ReactNode } from "react";

import { safeHttpUrl } from "../lib/urls";

type OpenLinkProps = {
  url: string | null | undefined;
  className?: string;
  children?: ReactNode;
  testId?: string;
};

/**
 * リンクノードの URL を新しいタブで開くリンク。http/https 以外（javascript: など）は表示しない
 * （manifests/nodes.md §3.5 Opening links、standards/security.md §9.5）。
 * キャンバス上でも使うため、押したときにノードの選択やドラッグ・パンが始まらないようイベントを止める。
 */
export function OpenLink({ url, className, children, testId = "open-link" }: OpenLinkProps) {
  const safe = url ? safeHttpUrl(url) : null;
  if (!safe) return null;
  return (
    <a
      href={safe.href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={testId}
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
      className={clsx("inline-flex items-center gap-1", className)}
    >
      {children ?? (
        <>
          Open link <span aria-hidden="true">↗</span>
        </>
      )}
    </a>
  );
}
