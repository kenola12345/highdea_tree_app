import type { NodeDetails, NodeSkeleton } from "@highdea/shared";
import { describe, expect, it } from "vitest";

import { layoutTree } from "./layout";
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
