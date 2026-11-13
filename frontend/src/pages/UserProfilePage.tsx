// P-08 User Profile
import { useParams, useSearchParams } from "react-router";

import { useUserProfile } from "../api/profile";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { PageContainer } from "../components/PageContainer";
import { Pagination } from "../components/Pagination";
import { Spinner } from "../components/Spinner";
import { ProfileHeader } from "../features/explore/ProfileHeader";
import { TreeCard } from "../features/trees/TreeCard";
import { NotFound } from "./NotFoundPage";

/**
 * 公開プロフィール（P-08）: そのユーザーの公開ツリーだけを表示する。本人や管理者が見ても非公開ツリーは出さない。
 * 存在しない・退会済みのユーザーは P-11 を表示する（manifests/users.md GET /api/users/:username）。
 */
export default function UserProfilePage() {
  const { username = "" } = useParams();
  const [searchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const { data, isPending, isError, notFound, refetch } = useUserProfile(username, page);

  if (notFound) return <NotFound />;
  return (
    <PageContainer>
      {isPending && <Spinner />}
      {isError && (
        <ErrorState message="Couldn't load this profile." onRetry={() => void refetch()} />
      )}
      {data && (
        <>
          <ProfileHeader user={data.user} />
          <h2 className="mt-8 text-lg font-semibold">Public trees</h2>
          <div className="mt-4">
            {data.trees.length === 0 ? (
              <EmptyState title="No public trees yet" />
            ) : (
              <>
                <ul
                  className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  data-testid="profile-trees"
                >
                  {data.trees.map((tree) => (
                    <li key={tree.id} className="flex">
                      <TreeCard tree={tree} to={`/trees/${tree.id}`} />
                    </li>
                  ))}
                </ul>
                <Pagination pagination={data.pagination} />
              </>
            )}
          </div>
        </>
      )}
    </PageContainer>
  );
}
