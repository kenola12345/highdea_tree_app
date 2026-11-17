import type { NodeDetails, NodeSkeleton } from "@highdea/shared";
import { describe, expect, it } from "vitest";

import {
  autoCardSize,
  bannerHeight,
  countLines,
  noteContent,
  shapePadding,
  textMetrics,
} from "./cardContent";
import { contentsOf, rectAround } from "./GroupBox";
import { cardSize, layoutTree } from "./layout";
import { cardAppearance } from "./nodeStyles";
import { isStructured, parseNote } from "./noteSections";
import { tidyLayout } from "./tidyLayout";
import { chunk, pickIdsToFetch } from "./useNodeDetails";
import { detailLevel, fitTransform, nodesInRect, visibleWorldRect } from "./viewport";

function node(
  id: string,
  parentId: string | null,
  extra: Partial<NodeSkeleton> = {},
): NodeSkeleton {
  return {
    id,
    parentId,
    type: "TEXT",
    title: id,
    positionX: 0,
    positionY: 0,
    sortOrder: 0,
    lineColor: null,
    cardColor: null,
    shape: "ROUNDED",
    width: null,
    height: null,
    fontSize: null,
    textColor: null,
    role: null,
    updatedAt: "2026-11-13T00:00:00Z",
    ...extra,
  };
}

describe("layoutTree", () => {
  it("puts the one root at the origin and links every child to its parent", () => {
    const layout = layoutTree([
      node("root", null),
      node("a", "root"),
      node("b", "root"),
      node("a1", "a"),
    ]);

    expect(layout.nodes.filter((n) => n.isRoot).map((n) => n.id)).toEqual(["root"]);
    expect(layout.byId.get("root")).toMatchObject({ x: 0, y: 0 });
    expect(layout.links.map((l) => `${l.source.id}->${l.target.id}`).sort()).toEqual([
      "a->a1",
      "root->a",
      "root->b",
    ]);
  });

  it("orders siblings by sortOrder, top to bottom, to the right of the parent", () => {
    const layout = layoutTree([
      node("root", null),
      node("second", "root", { sortOrder: 2 }),
      node("first", "root", { sortOrder: 1 }),
    ]);
    const first = layout.byId.get("first");
    const second = layout.byId.get("second");

    expect(first?.y).toBeLessThan(second?.y ?? 0);
    expect(first?.x).toBeGreaterThan(0);
  });

  it("lets a saved position win over the automatic layout", () => {
    const layout = layoutTree([
      node("root", null),
      node("a", "root", { positionX: -500, positionY: 320 }),
    ]);

    expect(layout.byId.get("a")).toMatchObject({ x: -500, y: 320 });
  });

  it("skips nodes whose parent isn't in the list", () => {
    const layout = layoutTree([node("root", null), node("orphan", "deleted")]);

    expect(layout.nodes.map((n) => n.id)).toEqual(["root"]);
  });
});

describe("viewport culling", () => {
  it("keeps only nodes inside the visible area plus the margin", () => {
    const layout = layoutTree([
      node("root", null),
      node("near", "root", { positionX: 400, positionY: 0 }),
      node("far", "root", { positionX: 5000, positionY: 5000 }),
    ]);
    const rect = visibleWorldRect({ x: 400, y: 300, k: 1 }, 800, 600);

    expect(
      nodesInRect(layout.nodes, rect)
        .map((n) => n.id)
        .sort(),
    ).toEqual(["near", "root"]);
  });

  it("switches from dots to titles to full cards as you zoom in", () => {
    expect(detailLevel(0.2)).toBe("dot");
    expect(detailLevel(0.5)).toBe("title");
    expect(detailLevel(1)).toBe("card");
  });

  it("fits the whole tree on screen without zooming past 100%", () => {
    const t = fitTransform({ minX: -100, minY: -50, maxX: 100, maxY: 50 }, 1000, 800);

    expect(t.k).toBe(1);
    expect(t).toMatchObject({ x: 500, y: 400 });
  });
});

describe("node details loading", () => {
  const cached: NodeDetails = {
    id: "a",
    body: null,
    url: null,
    previewTitle: null,
    previewDescription: null,
    previewImageUrl: null,
    imageUrl: null,
    imageUploadId: null,
    updatedAt: "2026-11-13T00:00:00Z",
  };

  it("skips nodes already cached with the same updatedAt, and nodes being fetched", () => {
    const ids = pickIdsToFetch(
      [
        { id: "a", updatedAt: "2026-11-13T00:00:00Z" },
        { id: "b", updatedAt: "2026-11-13T00:00:00Z" },
        { id: "c", updatedAt: "2026-11-13T00:00:00Z" },
      ],
      (id) => (id === "a" ? cached : undefined),
      new Set(["c"]),
    );

    expect(ids).toEqual(["b"]);
  });

  it("refetches a node whose content changed", () => {
    const ids = pickIdsToFetch(
      [{ id: "a", updatedAt: "2026-11-14T00:00:00Z" }],
      () => cached,
      new Set(),
    );

    expect(ids).toEqual(["a"]);
  });

  it("splits requests into batches of at most 100 IDs", () => {
    const batches = chunk(
      Array.from({ length: 250 }, (_, i) => String(i)),
      100,
    );

    expect(batches.map((b) => b.length)).toEqual([100, 100, 50]);
  });
});

describe("cards fit their content when no size is set", () => {
  const details = (extra: Partial<NodeDetails>): NodeDetails => ({
    id: "n",
    body: null,
    url: null,
    previewTitle: null,
    previewDescription: null,
    previewImageUrl: null,
    imageUrl: null,
    imageUploadId: null,
    updatedAt: "2026-11-13T00:00:00Z",
    ...extra,
  });
  const text = (title: string) => ({
    type: "TEXT" as const,
    title,
    shape: "ROUNDED" as const,
    fontSize: null,
    role: null,
    isRoot: false,
  });

  it("keeps the old default size for a short idea, and never goes below it", () => {
    expect(autoCardSize(text("Pricing"), undefined)).toEqual({ width: 200, height: 84 });
    expect(autoCardSize({ ...text("Startup ideas"), isRoot: true }, undefined)).toEqual({
      width: 280,
      height: 110,
    });
  });

  it("grows taller and wider for a long note, up to its limits", () => {
    const short = autoCardSize(text("Plan"), details({ body: "A short note" }));
    const long = autoCardSize(text("Plan"), details({ body: "word ".repeat(80) }));
    const huge = autoCardSize(text("Plan"), details({ body: "word ".repeat(2000) }));
    expect(long.height).toBeGreaterThan(short.height);
    expect(long.width).toBeGreaterThan(200);
    expect(huge.width).toBeLessThanOrEqual(300);
    expect(huge.height).toBeLessThanOrEqual(460);
  });

  it("makes room for a picture on top for images, videos and links with a preview image", () => {
    const image = autoCardSize(
      { ...text("Photo"), type: "IMAGE" },
      details({ imageUrl: "/u/a.png" }),
    );
    const link = autoCardSize(
      { ...text("Docs"), type: "LINK" },
      details({ url: "https://example.com", previewImageUrl: "https://example.com/p.png" }),
    );
    expect(image.height).toBeGreaterThanOrEqual(14 + bannerHeight(image.width));
    expect(link.height).toBeGreaterThanOrEqual(14 + bannerHeight(link.width));
  });

  it("uses a larger text size to size the card", () => {
    const normal = autoCardSize(text("Plan"), details({ body: "word ".repeat(40) }));
    const big = autoCardSize(
      { ...text("Plan"), fontSize: 20 },
      details({ body: "word ".repeat(40) }),
    );
    expect(big.height).toBeGreaterThan(normal.height);
  });

  it("counts wrapped lines, keeps paragraph breaks and breaks a word only when it can't fit", () => {
    expect(countLines("one", 400, 13, 500)).toBe(1);
    expect(countLines("one\n\ntwo", 400, 13, 500)).toBe(3);
    expect(countLines("a".repeat(200), 400, 13, 100)).toBeGreaterThan(1);
  });

  it("layout uses the fitted size for cards without a size, and the saved size otherwise", () => {
    const l = layoutTree(
      [node("root", null), node("a", "root"), node("b", "root", { width: 120, height: 60 })],
      new Map([["a", { width: 280, height: 180 }]]),
    );
    expect(cardSize(l.byId.get("a") ?? { isRoot: false })).toEqual({ width: 280, height: 180 });
    expect(cardSize(l.byId.get("b") ?? { isRoot: false })).toEqual({ width: 120, height: 60 });
  });
});

describe("text stays inside pills and circles", () => {
  it("puts the corners of the text area inside the rounded ends of a pill and inside an ellipse", () => {
    for (const [w, h] of [
      [200, 84],
      [360, 200],
      [300, 300],
    ] as const) {
      // ピル: 文字の四角の左上の角（余白＋文字のブロックの上 12px）が、左端の半円の内側にある
      const pill = shapePadding("PILL", w, h);
      const r = Math.min(w, h) / 2;
      const top = pill.y + 12;
      expect((r - pill.x) ** 2 + (r - top) ** 2).toBeLessThanOrEqual(r * r);
      // 楕円: 文字の四角の角が楕円の内側にある
      const el = shapePadding("ELLIPSE", w, h);
      const dx = (w / 2 - el.x) / (w / 2);
      const dy = (h / 2 - (el.y + 12)) / (h / 2);
      expect(dx * dx + dy * dy).toBeLessThanOrEqual(1);
    }
  });
});

describe("note sections", () => {
  it("splits a note into labeled sections and code blocks, and leaves a plain note as one block", () => {
    expect(parseNote("Just a thought.")).toEqual([
      { label: null, kind: "text", text: "Just a thought." },
    ]);
    const blocks = parseNote(
      "Intro line\nWhy: keeps things simple\nexample: like this\n```\nconst a = 1;\n```\nmistakes: forgetting await",
    );
    expect(blocks).toEqual([
      { label: null, kind: "text", text: "Intro line" },
      { label: "Why", kind: "text", text: "keeps things simple" },
      { label: "Example", kind: "text", text: "like this" },
      { label: null, kind: "code", text: "const a = 1;" },
      { label: "Mistakes", kind: "text", text: "forgetting await" },
    ]);
    expect(isStructured(blocks)).toBe(true);
    expect(isStructured(parseNote("plain"))).toBe(false);
  });
});

describe("node style presets and idea kinds", () => {
  const base = {
    preset: "MINIMAL" as const,
    role: null,
    isRoot: false,
    hasChildren: false,
    cardColor: null,
    textColor: null,
    readableOn: () => "#000000",
  };

  it("uses the preset's card, text and center colors", () => {
    expect(cardAppearance(base)).toMatchObject({ background: "#FFFFFF", text: "#1C3A2A" });
    expect(cardAppearance({ ...base, preset: "MIDNIGHT" })).toMatchObject({
      background: "#2B3447",
      text: "#E6EAF2",
    });
    expect(cardAppearance({ ...base, isRoot: true, preset: "EDITORIAL" })).toMatchObject({
      background: "#4A3B2C",
      titleWeight: 800,
    });
  });

  it("gives each kind its own treatment, and the owner's colors win over the preset", () => {
    expect(cardAppearance({ ...base, role: "CORE" })).toMatchObject({
      titleWeight: 800,
      titleBoost: 2,
    });
    expect(cardAppearance({ ...base, role: "SUPPORTING" })).toMatchObject({
      background: "#F4F7F3",
      titleWeight: 600,
    });
    expect(cardAppearance({ ...base, role: "EXAMPLE" }).border).toContain("dashed");
    expect(cardAppearance({ ...base, role: "EXAMPLE" }).noteFont).toContain("monospace");
    expect(cardAppearance({ ...base, role: "IMPORTANT" }).background).toContain("color-mix");
    expect(
      cardAppearance({ ...base, role: "IMPORTANT", cardColor: "#123456", textColor: "#FFEEDD" }),
    ).toMatchObject({ background: "#123456", text: "#FFEEDD" });
    // 枝を持つアイデアは題名が少し強い
    expect(cardAppearance({ ...base, hasChildren: true }).titleWeight).toBe(800);
  });
});

describe("expandable cards", () => {
  const long = Array.from({ length: 30 }, (_, i) => `Line ${String(i)} of a long note.`).join("\n");
  const plan = {
    type: "TEXT" as const,
    title: "Plan",
    shape: "ROUNDED" as const,
    fontSize: null,
    role: null,
    isRoot: false,
  };
  const details: NodeDetails = {
    id: "n",
    body: long,
    url: null,
    previewTitle: null,
    previewDescription: null,
    previewImageUrl: null,
    imageUrl: null,
    imageUploadId: null,
    updatedAt: "2026-11-13T00:00:00Z",
  };

  it("collapses a long note and grows when expanded; a short note isn't expandable", () => {
    const collapsed = autoCardSize(plan, details, false);
    const expanded = autoCardSize(plan, details, true);
    expect(expanded.height).toBeGreaterThan(collapsed.height);
    expect(expanded.width).toBeGreaterThanOrEqual(collapsed.width);
    const metrics = textMetrics(null, false);
    expect(noteContent(plan, details, 200, metrics)?.expandable).toBe(true);
    expect(noteContent(plan, { ...details, body: "Short." }, 200, metrics)?.expandable).toBe(false);
  });

  it("makes room for the kind label", () => {
    const plain = autoCardSize(plan, { ...details, body: "Short." });
    const core = autoCardSize({ ...plan, role: "CORE" }, { ...details, body: "Short." });
    expect(core.height).toBeGreaterThan(plain.height);
  });
});

describe("tidy up", () => {
  it("lays out every idea so no two cards overlap, keeping the center idea in place", () => {
    const skeleton = [
      node("root", null, { positionX: 50, positionY: 20 }),
      ...["a", "b", "c", "d", "e"].map((id) => node(id, "root", { positionX: 1, positionY: 1 })),
      ...["a1", "a2", "a3"].map((id) => node(id, "a", { positionX: 1, positionY: 1 })),
      node("d1", "d", { positionX: 1, positionY: 1, width: 300, height: 220 }),
      node("d2", "d", { positionX: 1, positionY: 1 }),
    ];
    const layout = layoutTree(skeleton, new Map([["b", { width: 280, height: 180 }]]));
    const placed = tidyLayout(layout.nodes);
    expect(placed.map((p) => p.id).sort()).toEqual(
      ["a", "a1", "a2", "a3", "b", "c", "d", "d1", "d2", "e"].sort(),
    );
    const root = layout.byId.get("root");
    const boxes = [
      ...placed.map((p) => {
        const n = layout.byId.get(p.id);
        const s = cardSize(n ?? { isRoot: false });
        return { id: p.id, x: p.x, y: p.y, ...s };
      }),
      { id: "root", x: root?.x ?? 0, y: root?.y ?? 0, ...cardSize(root ?? { isRoot: true }) },
    ];
    for (const a of boxes) {
      for (const b of boxes) {
        if (a.id >= b.id) continue;
        const overlapX = Math.abs(a.x - b.x) < (a.width + b.width) / 2;
        const overlapY = Math.abs(a.y - b.y) < (a.height + b.height) / 2;
        expect(overlapX && overlapY, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
    // 右に前半（a, b, c）、左に後半（d, e）
    expect(placed.find((p) => p.id === "a")?.x).toBeGreaterThan(50);
    expect(placed.find((p) => p.id === "e")?.x).toBeLessThan(50);
  });
});

describe("boxes", () => {
  const group = (id: string, x: number, y: number, w: number, h: number) => ({
    id,
    kind: "BOX" as const,
    title: "Group",
    body: null,
    color: null,
    positionX: x,
    positionY: y,
    width: w,
    height: h,
  });

  it("an idea is in a box when its center is inside; a box is inside when it fits completely", () => {
    const outer = group("outer", 0, 0, 500, 400);
    const inner = group("inner", 50, 60, 200, 150);
    const overlapping = group("over", 400, 300, 300, 300);
    const { nodeIds, groupIds } = contentsOf(
      outer,
      [
        { id: "in", x: 100, y: 100 },
        { id: "edge", x: 500, y: 400 },
        { id: "out", x: 510, y: 100 },
      ],
      [outer, inner, overlapping],
    );
    expect(nodeIds).toEqual(["in", "edge"]);
    expect(groupIds).toEqual(["inner"]);
  });

  it("draws a box around cards with padding and room for the header, never smaller than 160 × 100", () => {
    const rect = rectAround([
      { x: 0, y: 0, width: 200, height: 84 },
      { x: 300, y: 120, width: 200, height: 84 },
    ]);
    expect(rect).toEqual({ positionX: -124, positionY: -110, width: 548, height: 296 });
    expect(rectAround([{ x: 0, y: 0, width: 60, height: 40 }])).toMatchObject({
      width: 160,
      height: 132,
    });
    expect(rectAround([])).toBeNull();
  });
});
