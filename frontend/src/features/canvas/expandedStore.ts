// カードの「Show more / Show less」の状態（manifests/nodes.md §3.5 Expandable cards）。
// 今の表示の間だけ覚える（保存しない）。ツリーごとに、広げているアイデアの ID を持つ。
import { useSyncExternalStore } from "react";

const expanded = new Map<string, Set<string>>();
const listeners = new Set<() => void>();
let version = 0;

function setOf(treeId: string): Set<string> {
  let s = expanded.get(treeId);
  if (!s) {
    s = new Set();
    expanded.set(treeId, s);
  }
  return s;
}

export function isExpanded(treeId: string, nodeId: string): boolean {
  return expanded.get(treeId)?.has(nodeId) ?? false;
}

export function toggleExpanded(treeId: string, nodeId: string) {
  const s = setOf(treeId);
  if (s.has(nodeId)) s.delete(nodeId);
  else s.add(nodeId);
  version += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 1枚のカードが広がっているか（変わると再描画） */
export function useIsExpanded(treeId: string, nodeId: string): boolean {
  return useSyncExternalStore(subscribe, () => isExpanded(treeId, nodeId));
}

/** どれかのカードの開閉が変わるたびに増える番号（大きさの計算し直しのきっかけ） */
export function useExpandedVersion(): number {
  return useSyncExternalStore(subscribe, () => version);
}
