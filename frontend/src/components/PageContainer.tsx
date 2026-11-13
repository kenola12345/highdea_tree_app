import clsx from "clsx";
import type { ReactNode } from "react";

type PageContainerProps = { children: ReactNode; className?: string };

/**
 * ページ本文の共通コンテナ。スマホの左右余白（px-4 = 16px）はここで一度だけ決め、各ページで独自の値を作らない。
 */
export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={clsx("mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10", className)}>
      {children}
    </div>
  );
}
