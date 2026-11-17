// P-04 My Trees (Dashboard)
import type { OwnTreeItem } from "@highdea/shared";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

import { ApiError } from "../api/client";
import { useMyTrees } from "../api/trees";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { PageContainer } from "../components/PageContainer";
import { Pagination } from "../components/Pagination";
import { Spinner } from "../components/Spinner";
import { MoveToTrashModal } from "../features/trees/MoveToTrashModal";
import { MyTreesFilter } from "../features/trees/MyTreesFilter";
import { NewTreeModal } from "../features/trees/NewTreeModal";
import { TreeCard } from "../features/trees/TreeCard";
import { TreeCardMenu } from "../features/trees/TreeCardMenu";
import { type EditableTree, TreeSettingsModal } from "../features/trees/TreeSettingsModal";

/** マイツリー（P-04）: 自分のツリーの一覧、カテゴリ絞り込み、ページ送り、作成・設定・ゴミ箱移動 */
export default function MyTreesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const categoryId = searchParams.get("category") ?? undefined;
  const { data, isPending, isError, error, refetch } = useMyTrees({ page, categoryId });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EditableTree | null>(null);
  const [trashing, setTrashing] = useState<OwnTreeItem | EditableTree | null>(null);

  // 削除済み・他人のカテゴリで絞り込もうとした場合は絞り込みを外す（API は 404 CATEGORY_NOT_FOUND）
  const categoryMissing = error instanceof ApiError && error.code === "CATEGORY_NOT_FOUND";
  useEffect(() => {
    if (categoryMissing) setSearchParams({}, { replace: true });
  }, [categoryMissing, setSearchParams]);

  function setCategory(next: string | undefined) {
    setSearchParams(next ? { category: next } : {});
  }

  const newButton = (
    <button
      type="button"
      onClick={() => {
        setCreating(true);
      }}
      data-testid="new-tree-button"
      className="bg-brand-700 hover:bg-brand-800 text-surface rounded-full px-4 py-2 text-sm font-semibold"
    >
      + New tree
    </button>
  );

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">My Trees</h1>
        <div className="flex flex-wrap items-center gap-3">
          <MyTreesFilter value={categoryId} onChange={setCategory} />
          {newButton}
        </div>
      </div>

      <div className="mt-6">
        {isPending && <Spinner />}
        {isError && !categoryMissing && (
          <ErrorState message="Couldn't load your trees." onRetry={() => void refetch()} />
        )}
        {data?.trees.length === 0 &&
          (categoryId ? (
            <EmptyState
              title="No trees in this category"
              action={
                <button
                  type="button"
                  onClick={() => {
                    setCategory(undefined);
                  }}
                  className="text-brand-700 text-sm font-medium hover:underline"
                >
                  Show all trees
                </button>
              }
            />
          ) : (
            <EmptyState
              title="Create your first tree"
              description="Start with one idea and branch it out."
              action={newButton}
            />
          ))}
        {data && data.trees.length > 0 && (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="my-trees">
              {data.trees.map((tree) => (
                <li key={tree.id} className="flex">
                  <TreeCard
                    tree={tree}
                    to={`/trees/${tree.id}/edit`}
                    menu={
                      <TreeCardMenu
                        onEdit={() => {
                          setEditing(tree);
                        }}
                        onDelete={() => {
                          setTrashing(tree);
                        }}
                      />
                    }
                  />
                </li>
              ))}
            </ul>
            <Pagination pagination={data.pagination} />
          </>
        )}
      </div>

      <NewTreeModal
        open={creating}
        onClose={() => {
          setCreating(false);
        }}
      />
      <TreeSettingsModal
        tree={editing}
        onClose={() => {
          setEditing(null);
        }}
        onMoveToTrash={(tree) => {
          setEditing(null);
          setTrashing(tree);
        }}
      />
      <MoveToTrashModal
        tree={trashing}
        onClose={() => {
          setTrashing(null);
        }}
      />
    </PageContainer>
  );
}
