import type { TreeCanvasStyle, TreeDetailResponse, UpdateTreeCanvasBody } from "@highdea/shared";
import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToast } from "../components/Toast";
import { saveStatus } from "../features/canvas/saveStatusStore";
import { recordStep } from "../features/history/historyStore";
import { ApiError, apiFetch, jsonBody } from "./client";
import { queryKeys } from "./queryKeys";

/**
 * ツリーの詳細と全ノードの骨格（id・親・種類・題名・位置）を1回で取得する。
 * キャンバスはこれで配置と線をすべて描き、重い内容だけ後から見えている分を取りに行く（manifests/nodes.md §3.5）。
 * 404（存在しない・非公開・ゴミ箱）は notFound として返し、画面は P-11 を表示する。
 */
export function useTree(id: string) {
  const query = useQuery({
    queryKey: queryKeys.tree(id),
    queryFn: () => apiFetch<TreeDetailResponse>(`/trees/${id}`),
  });
  const notFound = query.error instanceof ApiError && query.error.status === 404;
  return { ...query, notFound };
}

/** キャンバスの見た目をキャッシュ上で書き換える（Canvas パネルのその場の反映用。保存は useUpdateTreeCanvas） */
export function previewTreeCanvas(
  queryClient: QueryClient,
  treeId: string,
  patch: Partial<TreeCanvasStyle>,
) {
  queryClient.setQueryData<TreeDetailResponse>(queryKeys.tree(treeId), (old) =>
    old ? { ...old, canvas: { ...old.canvas, ...patch } } : old,
  );
}

/**
 * キャンバスの見た目を保存する（PATCH /api/trees/:id/canvas）。画面はパネルがその場で先に変えているので、ここでは送るだけ。
 * 失敗したら保存済みの見た目を取り直して戻し、知らせる（manifests/nodes.md SPA points「Canvas look is optimistic」）。
 * 同じツリーへの保存は scope で順番に送り、古い値があとから保存されないようにする。
 */
export function useUpdateTreeCanvas(treeId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    scope: { id: `tree-canvas-${treeId}` },
    mutationFn: ({ body }: { body: UpdateTreeCanvasBody; before?: TreeCanvasStyle }) =>
      apiFetch<{ canvas: TreeCanvasStyle }>(`/trees/${treeId}/canvas`, {
        method: "PATCH",
        ...jsonBody(body),
      }),
    onMutate: () => {
      saveStatus.start(treeId);
    },
    onSuccess: (_data, { body, before }) => {
      // 履歴: 元に戻す = 変えた項目を、パネルで変え始める前の値に（before はパネルが渡す）
      if (!before) return;
      const undo: UpdateTreeCanvasBody = {};
      for (const key of Object.keys(body) as (keyof UpdateTreeCanvasBody)[]) {
        Object.assign(undo, { [key]: before[key] });
      }
      recordStep(treeId, {
        label: "Change canvas look",
        undo: [{ kind: "canvas", body: undo }],
        redo: [{ kind: "canvas", body }],
      });
    },
    onSettled: () => {
      saveStatus.succeed(treeId);
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tree(treeId) });
      toast("Couldn't save the canvas look.", "error");
    },
  });
}
