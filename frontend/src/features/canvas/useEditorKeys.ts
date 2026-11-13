import { useEffect, useRef } from "react";

type Handlers = {
  enabled: boolean;
  onAdd: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onDeselect: () => void;
};

/**
 * エディタのキーボード操作: Tab → 枝を追加（M-05）、Delete/Backspace → 削除（M-06）、Enter → 編集（M-04）、Esc → 選択解除。
 * 入力欄に文字を打っている間やモーダルが開いている間は反応しない。
 */
export function useEditorKeys(handlers: Handlers): void {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const h = ref.current;
      if (!h.enabled || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      if (e.key === "Tab") {
        e.preventDefault();
        h.onAdd();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        h.onDelete();
      } else if (e.key === "Enter") {
        e.preventDefault();
        h.onEdit();
      } else if (e.key === "Escape") {
        h.onDeselect();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}
