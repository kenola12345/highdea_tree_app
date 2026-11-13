// P-07 Explore
import { useSearchParams } from "react-router";

import { useExplore } from "../api/explore";
import { ErrorState } from "../components/ErrorState";
import { PageContainer } from "../components/PageContainer";
import { Spinner } from "../components/Spinner";
import { CategoryChips } from "../features/explore/CategoryChips";
import { ExploreFeed } from "../features/explore/ExploreFeed";
import { ExploreSearch } from "../features/explore/ExploreSearch";

/** Explore（P-07）: 全ユーザーの公開ツリー。検索・カテゴリ・ページは URL に持ち、共有や再読み込みで同じ一覧を開ける */
export default function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? undefined;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const { data, isPending, isError, refetch } = useExplore({ page, q: q || undefined, category });

  /** 検索語・カテゴリを変えたら1ページ目に戻す */
  function update(changes: { q?: string; category?: string | undefined }) {
    const next = new URLSearchParams(searchParams);
    next.delete("page");
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearchParams(next);
  }

  return (
    <PageContainer>
      <h1 className="text-2xl font-bold">Explore</h1>
      <p className="mt-1 text-sm text-slate-600">
        Public idea trees from everyone. Find inspiration and see how others think.
      </p>
      <div className="mt-6 space-y-3">
        <ExploreSearch
          value={q}
          onSearch={(next) => {
            update({ q: next });
          }}
        />
        <CategoryChips
          selected={category}
          onSelect={(next) => {
            update({ category: next });
          }}
        />
      </div>
      <div className="mt-6">
        {isPending && <Spinner />}
        {isError && <ErrorState message="Couldn't load Explore." onRetry={() => void refetch()} />}
        {data && <ExploreFeed data={data} filtered={Boolean(q || category)} />}
      </div>
    </PageContainer>
  );
}
