import type { Pagination as PaginationData } from "@highdea/shared";
import { useSearchParams } from "react-router";

type PaginationProps = { pagination: PaginationData };

/** 一覧のページ送り。現在ページは URL の ?page= に持つ（再読み込みや共有で同じページを開けるように） */
export function Pagination({ pagination }: PaginationProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { page, limit, total } = pagination;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  if (pageCount <= 1) return null;

  function goTo(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    if (nextPage === 1) next.delete("page");
    else next.set("page", String(nextPage));
    setSearchParams(next);
    window.scrollTo({ top: 0 });
  }

  const buttonClass =
    "rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3">
      <button
        type="button"
        className={buttonClass}
        disabled={page <= 1}
        onClick={() => {
          goTo(page - 1);
        }}
      >
        Previous
      </button>
      <span className="text-sm text-slate-600">
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        className={buttonClass}
        disabled={page >= pageCount}
        onClick={() => {
          goTo(page + 1);
        }}
      >
        Next
      </button>
    </nav>
  );
}
