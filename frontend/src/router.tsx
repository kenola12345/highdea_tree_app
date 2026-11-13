import { Navigate, Outlet, type RouteObject, ScrollRestoration, useLocation } from "react-router";

import { AppHeader } from "./components/AppHeader";
import { Spinner } from "./components/Spinner";
import { useMe } from "./features/auth/useMe";
import ExplorePage from "./pages/ExplorePage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import MyTreesPage from "./pages/MyTreesPage";
import NotFoundPage from "./pages/NotFoundPage";
import SettingsPage from "./pages/SettingsPage";
import SignupPage from "./pages/SignupPage";
import TrashPage from "./pages/TrashPage";
import TreeEditorPage from "./pages/TreeEditorPage";
import TreeViewerPage from "./pages/TreeViewerPage";
import UserProfilePage from "./pages/UserProfilePage";

/** 全ページ共通の枠（ヘッダー＋本文） */
function RootLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
      <ScrollRestoration />
    </div>
  );
}

/** ログイン必須のページ。ゲストは /login?next=<今のURL> へ送り、ログイン後に戻れるようにする（manifests/common.md §4） */
export function RequireAuth() {
  const { user, isLoading } = useMe();
  const location = useLocation();
  if (isLoading) return <Spinner />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}

/** 未ログイン専用のページ（新規登録・ログイン）。ログイン済みなら /me へ（API も 403 ALREADY_AUTHENTICATED を返す） */
export function GuestOnly() {
  const { user, isLoading } = useMe();
  if (isLoading) return <Spinner />;
  if (user) return <Navigate to="/me" replace />;
  return <Outlet />;
}

/**
 * ルート定義（manifests の各ページ一覧 P-01〜P-11）。
 * 中身は各 Phase でページファイルを差し替えるだけで、このファイルは編集しない。
 * /trees/:id/edit の「所有者以外はビューアへ」はツリー取得結果の isOwner で判断するため、エディタ側で行う。
 */
export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      { path: "/", element: <LandingPage /> },
      { path: "/explore", element: <ExplorePage /> },
      { path: "/u/:username", element: <UserProfilePage /> },
      { path: "/trees/:id", element: <TreeViewerPage /> },
      {
        element: <GuestOnly />,
        children: [
          { path: "/signup", element: <SignupPage /> },
          { path: "/login", element: <LoginPage /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          { path: "/me", element: <MyTreesPage /> },
          { path: "/trash", element: <TrashPage /> },
          { path: "/settings", element: <SettingsPage /> },
          { path: "/trees/:id/edit", element: <TreeEditorPage /> },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
