import type { GroupKind } from "@highdea/shared";
import type React from "react";
import { useEffect, useRef, useState } from "react";

import type { NodeType } from "../nodes/nodeForm";
import { LineColorControl } from "./ConnectOverlays";

/**
 * 選択中のキャンバスの項目の上に出すツールバー（manifests/nodes.md §3.5 Add menu and canvas items）:
 * 文（ボックス・文字は題名、付箋は文）、色、Delete（アイデアは変わらない）。文は入力を終えたとき（Enter・フォーカスが外れた）に保存する。
 */
export function GroupToolbar({
  rect,
  kind,
  title,
  body,
  color,
  defaultColor,
  disabled,
  onRename,
  onBodyChange,
  onColorChange,
  onDelete,
}: {
  rect: { x: number; y: number; width: number; height: number };
  kind: GroupKind;
  title: string;
  /** 付箋の文 */
  body: string | null;
  color: string | null;
  defaultColor: string;
  /** 保存中（一時ID）のボックスはまだ変えられない */
  disabled: boolean;
  onRename: (title: string) => void;
  /** 付箋の文を変える */
  onBodyChange: (body: string | null) => void;
  onColorChange: (color: string | null) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(title);
  const [noteDraft, setNoteDraft] = useState(body ?? "");
  const commit = () => {
    const next = draft.trim().slice(0, 100);
    if (next && next !== title) onRename(next);
    else setDraft(title);
  };
  const commitNote = () => {
    const next = noteDraft.slice(0, 2000);
    if (next !== (body ?? "")) onBodyChange(next.trim() === "" ? null : next);
  };
  return (
    <div
      role="toolbar"
      aria-label="Box actions"
      data-testid="group-toolbar"
      className="bg-surface animate-pop-in absolute z-10 flex w-max max-w-[calc(100vw-2rem)] origin-bottom -translate-x-1/2 -translate-y-full flex-wrap items-center justify-center gap-0.5 rounded-xl border border-slate-200 p-1 shadow-lg"
      style={{ left: rect.x + rect.width / 2, top: Math.max(rect.y - 8, 56) }}
    >
      {kind === "NOTE" ? (
        <label className="flex items-center">
          <span className="sr-only">Note text</span>
          <textarea
            value={noteDraft}
            disabled={disabled}
            rows={2}
            maxLength={2000}
            placeholder="Write a note…"
            onChange={(e) => {
              setNoteDraft(e.target.value);
            }}
            onBlur={commitNote}
            data-testid="group-body-input"
            className="focus:border-brand-600 w-52 resize-none rounded-lg border border-slate-200 bg-transparent px-2 py-1 text-sm focus:outline-none"
          />
        </label>
      ) : (
        <label className="flex items-center">
          <span className="sr-only">Box title</span>
          <input
            value={draft}
            disabled={disabled}
            maxLength={100}
            onChange={(e) => {
              setDraft(e.target.value);
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setDraft(title);
                e.currentTarget.blur();
              }
            }}
            data-testid="group-title-input"
            className="focus:border-brand-600 min-h-11 w-40 rounded-lg border border-transparent bg-transparent px-2 text-sm font-bold hover:border-slate-200 focus:outline-none md:min-h-9"
          />
        </label>
      )}
      <LineColorControl
        testId="group-color"
        label={kind === "BOX" ? "Box color" : kind === "NOTE" ? "Note color" : "Text color"}
        value={color}
        fallbackColor={defaultColor}
        fallbackLabel="Default"
        disabled={disabled}
        onChange={onColorChange}
      />
      <button
        type="button"
        onClick={onDelete}
        disabled={disabled}
        data-testid="delete-group-button"
        className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap text-red-700 hover:bg-red-50 disabled:opacity-40 md:min-h-9"
      >
        Delete
      </button>
    </div>
  );
}

/** 置く場所を選んでいる間の案内（キャンバスの上端）。左右はページと同じ 16px（inset-x-4） */
export function PlaceBanner({ text, onCancel }: { text: string; onCancel: () => void }) {
  return (
    <div
      role="status"
      data-testid="place-banner"
      className="bg-surface animate-drop-in absolute inset-x-4 top-3 z-20 mx-auto flex max-w-md items-center gap-3 rounded-full border border-slate-200 py-1.5 pr-1.5 pl-5 text-sm font-semibold shadow-md"
    >
      <p className="min-w-0 flex-1">{text}</p>
      <button
        type="button"
        onClick={onCancel}
        data-testid="place-cancel"
        className="hover:text-ink min-h-11 shrink-0 rounded-full px-4 font-bold text-slate-600 hover:bg-slate-100 md:min-h-9"
      >
        Cancel
      </button>
    </div>
  );
}

export type AddChoice = { kind: "idea"; type: NodeType } | { kind: "item"; item: GroupKind };

const IDEAS: { type: NodeType; label: string; icon: string }[] = [
  { type: "TEXT", label: "Text idea", icon: "✎" },
  { type: "LINK", label: "Link", icon: "🔗" },
  { type: "VIDEO", label: "Video", icon: "▶" },
  { type: "IMAGE", label: "Image", icon: "🖼" },
];
const ITEMS: { item: GroupKind; label: string; icon: string; hint: string }[] = [
  { item: "BOX", label: "Box", icon: "▦", hint: "Group ideas into a section" },
  { item: "NOTE", label: "Sticky note", icon: "▤", hint: "A colored note" },
  { item: "LABEL", label: "Text", icon: "T", hint: "A heading on the canvas" },
];

/**
 * 「+ Add」ボタンとメニュー（manifests/nodes.md §3.5 Add menu）: アイデア（Text / Link / Video / Image）と、
 * キャンバスの項目（Box / Sticky note / Text）。選ぶと、キャンバスで置く場所を選ぶ。
 */
export function AddMenu({ onChoose }: { onChoose: (choice: AddChoice) => void }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
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
  const choose = (choice: AddChoice) => {
    setOpen(false);
    onChoose(choice);
  };
  const row =
    "flex min-h-11 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm font-semibold text-slate-800 hover:bg-slate-100 md:min-h-9";
  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        data-testid="add-button"
        className="bg-ink text-surface flex min-h-11 items-center gap-1.5 rounded-xl px-3.5 text-sm font-bold shadow-sm md:min-h-9"
      >
        <span aria-hidden="true" className="text-base leading-none">
          +
        </span>
        Add
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Add"
          data-testid="add-menu"
          className="bg-surface animate-pop-in absolute right-0 bottom-full mb-2 w-60 origin-bottom-right rounded-2xl border border-slate-200 p-2 shadow-xl"
        >
          <p className="px-2.5 pt-1 pb-1 text-xs font-semibold text-slate-400">Ideas</p>
          {IDEAS.map((i) => (
            <button
              key={i.type}
              type="button"
              role="menuitem"
              onClick={() => {
                choose({ kind: "idea", type: i.type });
              }}
              data-testid={`add-${i.type}`}
              className={row}
            >
              <span aria-hidden="true" className="w-5 text-center">
                {i.icon}
              </span>
              {i.label}
            </button>
          ))}
          <hr className="my-1.5 border-slate-200" />
          <p className="px-2.5 pt-1 pb-1 text-xs font-semibold text-slate-400">On the canvas</p>
          {ITEMS.map((i) => (
            <button
              key={i.item}
              type="button"
              role="menuitem"
              title={i.hint}
              onClick={() => {
                choose({ kind: "item", item: i.item });
              }}
              data-testid={`add-${i.item}`}
              className={row}
            >
              <span aria-hidden="true" className="w-5 text-center font-black">
                {i.icon}
              </span>
              {i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 置く場所を選ぶ層（キャンバスの上に重ねる）。クリックでその場所、ボックスはドラッグで大きさごと描ける。
 * 描いている間は四角の見本を出す。座標は画面のまま返し、ワールド座標への変換はエディタが行う。
 */
export function PlacementLayer({
  allowDraw,
  onPlace,
}: {
  allowDraw: boolean;
  onPlace: (start: { x: number; y: number }, end: { x: number; y: number }) => void;
}) {
  const [draw, setDraw] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const local = (e: React.PointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };
  return (
    <div
      ref={box}
      data-testid="placement-layer"
      className="absolute inset-0 z-[5] cursor-crosshair touch-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = local(e);
        setDraw({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
      }}
      onPointerMove={(e) => {
        if (!draw || !allowDraw) return;
        const p = local(e);
        setDraw({ ...draw, x1: p.x, y1: p.y });
      }}
      onPointerUp={(e) => {
        if (!draw) return;
        setDraw(null);
        onPlace(
          { x: e.clientX - (local(e).x - draw.x0), y: e.clientY - (local(e).y - draw.y0) },
          {
            x: e.clientX,
            y: e.clientY,
          },
        );
      }}
    >
      {draw && allowDraw && Math.abs(draw.x1 - draw.x0) + Math.abs(draw.y1 - draw.y0) > 8 && (
        <div
          aria-hidden="true"
          className="border-ink/60 bg-ink/5 absolute rounded-2xl border-2 border-dashed"
          style={{
            left: Math.min(draw.x0, draw.x1),
            top: Math.min(draw.y0, draw.y1),
            width: Math.abs(draw.x1 - draw.x0),
            height: Math.abs(draw.y1 - draw.y0),
          }}
        />
      )}
    </div>
  );
}
