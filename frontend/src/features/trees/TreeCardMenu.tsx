import { useEffect, useId, useRef, useState } from "react";

type TreeCardMenuProps = { onEdit: () => void; onDelete: () => void };

/** ツリーカードの「…」メニュー: Edit details（M-02）と Delete（M-03） */
export function TreeCardMenu({ onEdit, onDelete }: TreeCardMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  // メニューの外をクリック・Esc で閉じる
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const item = "block w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50";
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Tree actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        data-testid="tree-card-menu"
        onClick={() => {
          setOpen((v) => !v);
        }}
        className="flex size-9 items-center justify-center rounded-lg text-lg text-slate-500 hover:bg-slate-100"
      >
        ⋯
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            Edit details
          </button>
          <button
            type="button"
            role="menuitem"
            className={`${item} text-red-700`}
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
