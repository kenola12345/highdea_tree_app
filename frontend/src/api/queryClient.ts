import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./client";

/** アプリ全体で使う QueryClient。4xx は再試行しても結果が変わらないので再試行しない */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status < 500) return false;
          return failureCount < 1;
        },
      },
      mutations: { retry: false },
    },
  });
}
