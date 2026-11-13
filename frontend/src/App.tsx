import { QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router";

import { setUnauthenticatedHandler } from "./api/client";
import { createQueryClient } from "./api/queryClient";
import { queryKeys } from "./api/queryKeys";
import { ToastProvider } from "./components/Toast";
import { routes } from "./router";

const queryClient = createQueryClient();
const router = createBrowserRouter(routes);

// 利用中の 401（7日の有効期限切れなど）: ログイン情報を消し、今の画面に戻れるよう next 付きでログイン画面へ
// （manifests/common.md §4 Session handling）
setUnauthenticatedHandler(() => {
  queryClient.setQueryData(queryKeys.me, null);
  const { pathname, search } = router.state.location;
  if (pathname !== "/login") {
    void router.navigate(`/login?next=${encodeURIComponent(pathname + search)}`, { replace: true });
  }
});

/** アプリのルート。データ取得（TanStack Query）・トースト・ルーターを用意する */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  );
}
