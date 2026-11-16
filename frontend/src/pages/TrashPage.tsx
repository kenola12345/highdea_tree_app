// P-09 Trash
import { useSearchParams } from "react-router";

import { useTrash } from "../api/trash";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { PageContainer } from "../components/PageContainer";
import { Pagination } from "../components/Pagination";
import { Spinner } from "../components/Spinner";
import { TrashList } from "../features/trash/TrashList";

/** ゴミ箱（P-09）: 削除したツリーは10日間ここにあり、その間は復元できる */
export default function TrashPage() {
  const [searchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const { data, isPending, isError, refetch } = useTrash(page);

  return (
    <PageContainer>
      <h1 className="text-2xl font-bold">Trash</h1>
      <p className="mt-1 text-sm text-slate-600">
        Trees stay here for 10 days, then they&apos;re deleted permanently. Restore one to bring it
        back as it was, or delete it forever now.
      </p>
      <div className="mt-6">
        {isPending && <Spinner />}
        {isError && (
          <ErrorState message="Couldn't load the Trash." onRetry={() => void refetch()} />
        )}
        {data?.trees.length === 0 && <EmptyState title="Trash is empty" />}
        {data && data.trees.length > 0 && (
          <>
            <TrashList trees={data.trees} total={data.pagination.total} />
            <Pagination pagination={data.pagination} />
          </>
        )}
      </div>
    </PageContainer>
  );
}
