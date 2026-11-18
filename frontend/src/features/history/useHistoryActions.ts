import type { CreateNodeBody, NodeConnection } from "@highdea/shared";
import { useCallback, useEffect } from "react";

import { ApiError } from "../../api/client";
import {
  useCreateConnection,
  useDeleteConnection,
  useUpdateConnection,
} from "../../api/connections";
import { groupBody, useCreateGroup, useDeleteGroup, useUpdateGroup } from "../../api/groups";
import { useCreateNode, useDeleteNode, useSavePositions, useUpdateNode } from "../../api/nodes";
import { useUpdateTreeCanvas } from "../../api/tree";
import { useToast } from "../../components/Toast";
import {
  clearHistory,
  type HistoryOp,
  remapId,
  resolveId,
  type RestorableNode,
  step,
  useHistoryState,
} from "./historyStore";

/**
 * エディタの「元に戻す / やり直す」（manifests/nodes.md §3.5 Undo and redo）。
 * 履歴の操作を、普段の保存と同じフック（キャッシュの先行反映・失敗時の戻しつき）で順に実行する。
 * 作り直したノード・つながりは ID が変わるので、履歴の ID を読み替えながら実行する。
 */
export function useHistoryActions(treeId: string) {
  const toast = useToast();
  const state = useHistoryState(treeId);
  const createNode = useCreateNode(treeId);
  const updateNode = useUpdateNode(treeId);
  const deleteNode = useDeleteNode(treeId);
  const savePositions = useSavePositions(treeId);
  const createConnection = useCreateConnection(treeId);
  const deleteConnection = useDeleteConnection(treeId);
  const updateConnection = useUpdateConnection(treeId);
  const updateCanvas = useUpdateTreeCanvas(treeId);
  const createGroup = useCreateGroup(treeId);
  const updateGroup = useUpdateGroup(treeId);
  const deleteGroup = useDeleteGroup(treeId);

  // エディタを離れたら、このツリーの履歴を消す
  useEffect(
    () => () => {
      clearHistory(treeId);
    },
    [treeId],
  );

  const id = useCallback((recorded: string) => resolveId(treeId, recorded), [treeId]);

  /** 消したノードを作り直す。画像が消えていたら、題名とメモを残した TEXT として作る */
  const recreate = useCallback(
    async (node: RestorableNode) => {
      const common = {
        parentId: id(node.parentId),
        title: node.title,
        body: node.body,
        positionX: node.positionX,
        positionY: node.positionY,
        sortOrder: node.sortOrder,
        lineColor: node.lineColor,
        cardColor: node.cardColor,
        shape: node.shape,
        width: node.width,
        height: node.height,
        fontSize: node.fontSize,
        textColor: node.textColor,
        role: node.role,
        lineLabel: node.lineLabel,
      };
      const text: CreateNodeBody = { ...common, type: "TEXT" };
      let body: CreateNodeBody = text;
      if ((node.type === "LINK" || node.type === "VIDEO") && node.url) {
        body = { ...common, type: node.type, url: node.url };
      } else if (node.type === "IMAGE" && node.imageUploadId) {
        body = { ...common, type: "IMAGE", imageUploadId: node.imageUploadId };
      }
      try {
        const { node: created } = await createNode.mutateAsync(body);
        remapId(treeId, node.id, created.id);
      } catch (err) {
        if (!(err instanceof ApiError && err.code === "UPLOAD_NOT_FOUND")) throw err;
        const { node: created } = await createNode.mutateAsync(text);
        remapId(treeId, node.id, created.id);
      }
    },
    [createNode, id, treeId],
  );

  /** 消したつながりを作り直し、色・種類・向きも元どおりにする */
  const recreateConnection = useCallback(
    async (c: NodeConnection) => {
      const { connection } = await createConnection.mutateAsync({
        nodeAId: id(c.nodeAId),
        nodeBId: id(c.nodeBId),
      });
      remapId(treeId, c.id, connection.id);
      if (c.color !== null || c.kind !== "RELATED" || c.arrow !== null) {
        // 作り直すと ID の並び（A・B）が変わることがあるので、向きは元のアイデアに合わせて付け直す
        const sameOrder = connection.nodeAId === id(c.nodeAId);
        const arrow =
          c.arrow === null
            ? null
            : sameOrder
              ? c.arrow
              : c.arrow === "A_TO_B"
                ? "B_TO_A"
                : "A_TO_B";
        await updateConnection.mutateAsync({
          id: connection.id,
          body: { color: c.color, kind: c.kind, arrow },
        });
      }
    },
    [createConnection, id, treeId, updateConnection],
  );

  const runOps = useCallback(
    async (ops: HistoryOp[]) => {
      for (const op of ops) {
        switch (op.kind) {
          case "updateNode": {
            const body = { ...op.body };
            if (body.parentId !== undefined) body.parentId = id(body.parentId);
            await updateNode.mutateAsync({ id: id(op.id), body });
            break;
          }
          case "positions":
            await savePositions.mutateAsync({
              nodes: op.items.map((item) => ({ ...item, id: id(item.id) })),
              groups: (op.groups ?? []).map((g) => ({ ...g, id: id(g.id) })),
            });
            break;
          case "createGroup": {
            const { group } = await createGroup.mutateAsync(groupBody(op.group));
            remapId(treeId, op.group.id, group.id);
            break;
          }
          case "deleteGroup":
            await deleteGroup.mutateAsync(id(op.id));
            break;
          case "groupUpdate":
            await updateGroup.mutateAsync({ id: id(op.id), body: op.body });
            break;
          case "createNodes":
            for (const node of op.nodes) await recreate(node);
            for (const c of op.connections) {
              await recreateConnection(c);
            }
            break;
          case "deleteNode":
            await deleteNode.mutateAsync(id(op.id));
            break;
          case "createConnection": {
            await recreateConnection(op.connection);
            break;
          }
          case "deleteConnection":
            await deleteConnection.mutateAsync(id(op.id));
            break;
          case "connectionUpdate":
            await updateConnection.mutateAsync({ id: id(op.id), body: op.body });
            break;
          case "canvas":
            await updateCanvas.mutateAsync({ body: op.body });
            break;
        }
      }
    },
    [
      deleteConnection,
      deleteNode,
      id,
      recreate,
      recreateConnection,
      savePositions,
      createGroup,
      updateGroup,
      deleteGroup,
      treeId,
      updateCanvas,
      updateConnection,
      updateNode,
    ],
  );

  const undo = useCallback(async () => {
    const label = state.past.at(-1)?.label;
    const ok = await step(treeId, "undo", runOps);
    if (!ok && label) toast(`Couldn't undo “${label}”.`, "error");
    return ok;
  }, [runOps, state.past, toast, treeId]);

  const redo = useCallback(async () => {
    const label = state.future.at(-1)?.label;
    const ok = await step(treeId, "redo", runOps);
    if (!ok && label) toast(`Couldn't redo “${label}”.`, "error");
    return ok;
  }, [runOps, state.future, toast, treeId]);

  /** 履歴の一覧で選んだ手まで戻す・進める（past の長さが target になるまで） */
  const jumpTo = useCallback(
    async (target: number) => {
      let past = state.past.length;
      while (past > target) {
        if (!(await step(treeId, "undo", runOps))) return;
        past -= 1;
      }
      while (past < target) {
        if (!(await step(treeId, "redo", runOps))) return;
        past += 1;
      }
    },
    [runOps, state.past.length, treeId],
  );

  return { ...state, undo, redo, jumpTo };
}
