// エディタの「元に戻す / やり直す」の履歴（manifests/nodes.md §3.5 Undo and redo）。
// 変更ごとに「元に戻す操作」と「やり直す操作」を API の操作として持ち、再生は useHistoryActions が行う。
// 履歴はブラウザのメモリだけに持つ（保存しない）。ツリーごとに分け、エディタを離れたら消す。
import type {
  NodeConnection,
  NodeDetails,
  NodeGroup,
  NodeSkeleton,
  UpdateConnectionBody,
  UpdateGroupBody,
  UpdateNodeBody,
  UpdateTreeCanvasBody,
} from "@highdea/shared";
import { useSyncExternalStore } from "react";

/** 作り直すための、ノード1件のすべての項目（id と parentId は履歴の中の ID） */
export type RestorableNode = {
  id: string;
  parentId: string;
  type: NodeSkeleton["type"];
  title: string;
  body: string | null;
  url: string | null;
  imageUploadId: string | null;
  positionX: number;
  positionY: number;
  sortOrder: number;
  lineColor: string | null;
  cardColor: string | null;
  shape: NodeSkeleton["shape"];
  width: number | null;
  height: number | null;
  fontSize: number | null;
  textColor: string | null;
  role: NodeSkeleton["role"];
};

/** 履歴の1つの操作。ID は記録したときのもので、再生するときに今の ID へ読み替える */
export type HistoryOp =
  | { kind: "updateNode"; id: string; body: UpdateNodeBody }
  | {
      kind: "positions";
      items: { id: string; positionX: number; positionY: number; sortOrder?: number }[];
      /** 一緒に動かしたボックス（中のアイデアと同じリクエストで保存する） */
      groups?: GroupRect[];
    }
  | { kind: "createGroup"; group: NodeGroup }
  | { kind: "deleteGroup"; id: string }
  | { kind: "groupUpdate"; id: string; body: UpdateGroupBody }
  | { kind: "createNodes"; nodes: RestorableNode[]; connections: NodeConnection[] }
  | { kind: "deleteNode"; id: string }
  | { kind: "createConnection"; connection: NodeConnection }
  | { kind: "deleteConnection"; id: string }
  | { kind: "connectionUpdate"; id: string; body: UpdateConnectionBody }
  | { kind: "canvas"; body: UpdateTreeCanvasBody };

/** ボックスの位置と大きさ（位置の一括保存で送る形） */
export type GroupRect = {
  id: string;
  positionX: number;
  positionY: number;
  width?: number;
  height?: number;
};

/** 履歴の1手。undo は前から順に、redo も前から順に実行する */
export type HistoryStep = { label: string; undo: HistoryOp[]; redo: HistoryOp[] };

type TreeHistory = {
  past: HistoryStep[];
  future: HistoryStep[];
  /** 作り直して ID が変わったもの: 古い ID → 今の ID */
  ids: Map<string, string>;
  busy: boolean;
  /** 元に戻す・やり直すを順に実行するための待ち行列 */
  queue: Promise<unknown>;
  /** まとめて1手にする間の記録先（付け替え・大きさの変更など、複数のリクエストで1つの操作のとき） */
  group: { label: string; steps: HistoryStep[] } | null;
};

/** 戻せる手数の上限 */
export const MAX_STEPS = 100;

const histories = new Map<string, TreeHistory>();
const listeners = new Set<() => void>();
/** 再生中のツリー（再生で起きた変更は記録しない） */
const replaying = new Set<string>();

function historyOf(treeId: string): TreeHistory {
  let h = histories.get(treeId);
  if (!h) {
    h = {
      past: [],
      future: [],
      ids: new Map(),
      busy: false,
      queue: Promise.resolve(),
      group: null,
    };
    histories.set(treeId, h);
  }
  return h;
}

function emit() {
  for (const listener of listeners) listener();
}

/** 新しい変更を記録する（やり直しの手は消える）。再生中・まとめ中はそれに合わせる */
export function recordStep(treeId: string, step: HistoryStep) {
  if (replaying.has(treeId)) return;
  const h = historyOf(treeId);
  if (h.group) {
    h.group.steps.push(step);
    return;
  }
  h.past = [...h.past, step].slice(-MAX_STEPS);
  h.future = [];
  emit();
}

/**
 * fn の中で起きた変更を1手にまとめる（例: 付け替え = ノードの移動 + 枝の位置の保存）。
 * 元に戻すときは後の変更から順に戻す。fn が失敗しても、成功した分は1手として残す。
 */
export async function runAsOneStep(treeId: string, label: string, fn: () => Promise<unknown>) {
  const h = historyOf(treeId);
  const outer = h.group;
  const group = { label, steps: [] as HistoryStep[] };
  h.group = group;
  try {
    await fn();
  } finally {
    h.group = outer;
    if (group.steps.length > 0) {
      recordStep(treeId, {
        label,
        undo: [...group.steps].reverse().flatMap((s) => s.undo),
        redo: group.steps.flatMap((s) => s.redo),
      });
    }
  }
}

/** 記録した ID を今の ID に読み替える */
export function resolveId(treeId: string, id: string): string {
  return historyOf(treeId).ids.get(id) ?? id;
}

/** 作り直して ID が変わったことを覚える（その ID を指していたほかの古い ID もまとめて付け替える） */
export function remapId(treeId: string, recordedId: string, newId: string) {
  const ids = historyOf(treeId).ids;
  const current = ids.get(recordedId) ?? recordedId;
  for (const [key, value] of ids) if (value === current) ids.set(key, newId);
  ids.set(recordedId, newId);
  ids.set(current, newId);
}

/** 再生中かどうか（再生で起きた変更は記録しない） */
export function isReplaying(treeId: string) {
  return replaying.has(treeId);
}

/**
 * 1手を元に戻す / やり直す。run は操作を順に実行する関数（useHistoryActions が渡す）。
 * 失敗したら手はそのまま（どちらの山にも動かさない）にして false を返す。戻す手がなければ何もせず false。
 */
export function step(
  treeId: string,
  direction: "undo" | "redo",
  run: (ops: HistoryOp[]) => Promise<void>,
): Promise<boolean> {
  const h = historyOf(treeId);
  // 素早く続けて押されたときも取りこぼさないよう、前の手が終わってから順に実行する
  const next = h.queue.then(() => runStep(treeId, h, direction, run));
  h.queue = next.catch(() => false);
  return next;
}

async function runStep(
  treeId: string,
  h: TreeHistory,
  direction: "undo" | "redo",
  run: (ops: HistoryOp[]) => Promise<void>,
): Promise<boolean> {
  const source = direction === "undo" ? h.past : h.future;
  const target = source.at(-1);
  if (!target) return false;
  h.busy = true;
  replaying.add(treeId);
  emit();
  try {
    await run(direction === "undo" ? target.undo : target.redo);
    if (direction === "undo") {
      h.past = h.past.slice(0, -1);
      h.future = [...h.future, target];
    } else {
      h.future = h.future.slice(0, -1);
      h.past = [...h.past, target];
    }
    return true;
  } catch {
    return false;
  } finally {
    replaying.delete(treeId);
    h.busy = false;
    emit();
  }
}

/** ツリーの履歴を消す（エディタを離れたとき） */
export function clearHistory(treeId: string) {
  histories.delete(treeId);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const EMPTY = { past: [] as HistoryStep[], future: [] as HistoryStep[], busy: false };

/** 画面用: 戻せる手・やり直せる手・再生中か */
export function useHistoryState(treeId: string) {
  return useSyncExternalStore(subscribe, () => {
    const h = histories.get(treeId);
    return h ? cached(h) : EMPTY;
  });
}

// useSyncExternalStore は同じ状態なら同じオブジェクトを返す必要がある
const snapshots = new WeakMap<
  TreeHistory,
  { past: HistoryStep[]; future: HistoryStep[]; busy: boolean }
>();
function cached(h: TreeHistory) {
  const prev = snapshots.get(h);
  if (prev && prev.past === h.past && prev.future === h.future && prev.busy === h.busy) return prev;
  const next = { past: h.past, future: h.future, busy: h.busy };
  snapshots.set(h, next);
  return next;
}

/** ノードの骨格と詳細から、作り直すための項目をまとめる。必要な内容がなければ null */
export function toRestorable(
  node: NodeSkeleton,
  details: NodeDetails | undefined,
): RestorableNode | null {
  if (node.parentId === null) return null;
  if (node.type !== "TEXT" && !details) return null;
  return {
    id: node.id,
    parentId: node.parentId,
    type: node.type,
    title: node.title,
    body: details?.body ?? null,
    url: details?.url ?? null,
    imageUploadId: details?.imageUploadId ?? null,
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
  };
}

/** ノードの編集を元に戻すための本文（変えた項目の前の値）。前の値が分からない項目があれば null（記録しない） */
export function undoBodyFor(
  before: NodeSkeleton,
  details: NodeDetails | undefined,
  body: UpdateNodeBody,
): UpdateNodeBody | null {
  const undo: UpdateNodeBody = {};
  if (body.title !== undefined) undo.title = before.title;
  if (body.body !== undefined) {
    if (!details) return null;
    undo.body = details.body;
  }
  const typeChanged = body.type !== undefined && body.type !== before.type;
  if (typeChanged) undo.type = before.type;
  // 種類を戻すときは、元の種類に必要な URL・画像も一緒に戻す
  if (
    body.url !== undefined ||
    (typeChanged && (before.type === "LINK" || before.type === "VIDEO"))
  ) {
    if (before.type === "LINK" || before.type === "VIDEO") {
      if (!details?.url) return null;
      undo.url = details.url;
    }
  }
  if (body.imageUploadId !== undefined || (typeChanged && before.type === "IMAGE")) {
    if (before.type === "IMAGE") {
      if (!details?.imageUploadId) return null;
      undo.imageUploadId = details.imageUploadId;
    }
  }
  if (body.parentId !== undefined) {
    if (before.parentId === null) return null;
    undo.parentId = before.parentId;
    undo.positionX = before.positionX;
    undo.positionY = before.positionY;
    undo.sortOrder = before.sortOrder;
  }
  for (const key of [
    "lineColor",
    "cardColor",
    "shape",
    "width",
    "height",
    "fontSize",
    "textColor",
    "role",
  ] as const) {
    if (body[key] !== undefined) Object.assign(undo, { [key]: before[key] });
  }
  return Object.keys(undo).length > 0 ? undo : null;
}

/** 編集の内容から、履歴に出す名前を決める */
export function labelForUpdate(body: UpdateNodeBody): string {
  const keys = Object.keys(body);
  if (body.parentId !== undefined) return "Move idea";
  if (keys.every((k) => k === "lineColor")) return "Change line color";
  if (keys.every((k) => k === "width" || k === "height")) return "Resize idea";
  if (keys.every((k) => k === "role")) return "Change kind";
  return "Edit idea";
}
