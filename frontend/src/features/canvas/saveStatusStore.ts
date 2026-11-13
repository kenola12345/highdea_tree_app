import { useSyncExternalStore } from "react";

/**
 * エディタの保存状態（ツールバーの「Saving… / Saved ✓ / Couldn't save – retry」用）。
 * ノード操作のフックが開始・成功・失敗を報告し、失敗した操作は retry で同じ内容をもう一度送れるようにする。
 */
type State = { pending: number; failed: { message: string; retry: () => void } | null };

const states = new Map<string, State>();
const listeners = new Set<() => void>();
const EMPTY: State = { pending: 0, failed: null };

function update(treeId: string, change: (s: State) => State) {
  states.set(treeId, change(states.get(treeId) ?? EMPTY));
  listeners.forEach((l) => {
    l();
  });
}

export const saveStatus = {
  start(treeId: string) {
    update(treeId, (s) => ({ pending: s.pending + 1, failed: null }));
  },
  succeed(treeId: string) {
    update(treeId, (s) => ({ ...s, pending: Math.max(0, s.pending - 1) }));
  },
  fail(treeId: string, message: string, retry: () => void) {
    update(treeId, (s) => ({ ...s, failed: { message, retry } }));
  },
  clear(treeId: string) {
    update(treeId, (s) => ({ ...s, failed: null }));
  },
};

/** 現在の保存状態を購読する */
export function useSaveStatus(treeId: string): State {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => states.get(treeId) ?? EMPTY,
  );
}
