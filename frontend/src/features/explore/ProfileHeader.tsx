import type { PublicUserResponse } from "@highdea/shared";

import { Avatar } from "../../components/AppHeader";

/** 公開プロフィールの見出し: アバター・表示名・@ユーザー名・登録日（manifests/explore.md P-08） */
export function ProfileHeader({ user }: { user: PublicUserResponse }) {
  const joined = new Date(user.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });
  return (
    <div className="flex items-center gap-4">
      <Avatar name={user.displayName} url={user.avatarUrl} size="lg" />
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold">{user.displayName}</h1>
        <p className="text-sm text-slate-600">
          @{user.username} · Joined {joined}
        </p>
      </div>
    </div>
  );
}
