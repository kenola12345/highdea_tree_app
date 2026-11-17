// P-11 Not Found
import { Link } from "react-router";

import { PageContainer } from "../components/PageContainer";

/**
 * 「存在しないか公開されていない」ページ。非公開ツリーや退会ユーザーでも同じ表示にして、
 * 存在自体を明かさない（manifests/common.md §4 Not-found instead of forbidden）。
 * 各ページは主なリソースが 404 のときにこの部品を表示する。
 */
export function NotFound() {
  return (
    <PageContainer className="py-16 text-center md:py-24">
      <p className="text-brand-700 text-sm font-semibold">404</p>
      <h1 className="mt-2 text-2xl font-bold">
        This page doesn&apos;t exist or isn&apos;t public.
      </h1>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          to="/explore"
          className="bg-brand-700 hover:bg-brand-800 text-surface rounded-full px-4 py-2 text-sm font-medium"
        >
          Go to Explore
        </Link>
        <Link
          to="/"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Home
        </Link>
      </div>
    </PageContainer>
  );
}

export default function NotFoundPage() {
  return <NotFound />;
}
