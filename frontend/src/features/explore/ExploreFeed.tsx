import type { ExploreListResponse } from "@highdea/shared";

import { EmptyState } from "../../components/EmptyState";
import { Pagination } from "../../components/Pagination";
import { TreeCard } from "../trees/TreeCard";

/** Explore のツリー一覧。カードはビューア（/trees/:id）へ、所有者名はプロフィール（/u/:username）へリンクする */
export function ExploreFeed({ data, filtered }: { data: ExploreListResponse; filtered: boolean }) {
  if (data.trees.length === 0) {
    return (
      <EmptyState
        title={filtered ? "No public trees match" : "No public trees yet"}
        description={
          filtered ? "Try another search or category." : "Public trees will show up here."
        }
      />
    );
  }
  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="explore-feed">
        {data.trees.map((tree) => (
          <li key={tree.id} className="flex">
            <TreeCard tree={tree} to={`/trees/${tree.id}`} owner={tree.owner} />
          </li>
        ))}
      </ul>
      <Pagination pagination={data.pagination} />
    </>
  );
}
