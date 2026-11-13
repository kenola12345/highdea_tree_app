import type { NodeSkeleton, TreeDetailResponse } from "@highdea/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PREVIEW_DEBOUNCE_MS, useLinkPreview } from "../../api/linkPreview";
import { useCreateNode } from "../../api/nodes";
import { createQueryClient } from "../../api/queryClient";
import { queryKeys } from "../../api/queryKeys";
import { ToastProvider } from "../../components/Toast";
import { buildUpdateBody } from "../nodes/nodeForm";
import { canReparent, findDropTarget } from "./dropTarget";
import { layoutTree } from "./layout";
import { branchIds, countDescendants, newChildPosition } from "./treeOps";

function node(id: string, parentId: string | null, x: number, y: number): NodeSkeleton {
  return {
    id,
    parentId,
    type: "TEXT",
    title: id,
    positionX: x,
    positionY: y,
    sortOrder: 0,
    updatedAt: "2026-11-13T00:00:00Z",
  };
}

// root ─ a ─ a1
//      └ b
const skeleton = [
  node("root", null, 0, 0),
  node("a", "root", 300, -100),
  node("a1", "a", 600, -100),
  node("b", "root", 300, 200),
];
const layout = layoutTree(skeleton);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("drop target rules", () => {
  it("finds the card under the pointer but never one inside the dragged branch", () => {
    const branch = branchIds(skeleton, "a");

    expect(findDropTarget(layout.nodes, { x: 300, y: 200 }, branch)?.id).toBe("b");
    expect(findDropTarget(layout.nodes, { x: 600, y: -100 }, branch)).toBeNull();
    expect(findDropTarget(layout.nodes, { x: 2000, y: 2000 }, branch)).toBeNull();
  });

  it("refuses moving the center idea under another idea", () => {
    const root = layout.byId.get("root");
    const b = layout.byId.get("b");
    if (!root || !b) throw new Error("layout");

    expect(canReparent(root, b, branchIds(skeleton, "root"))).toBe(false);
  });

  it("refuses a target inside the dragged node's own branch, and allows another branch", () => {
    const a = layout.byId.get("a");
    const a1 = layout.byId.get("a1");
    const b = layout.byId.get("b");
    if (!a || !a1 || !b) throw new Error("layout");
    const branch = branchIds(skeleton, "a");

    expect(canReparent(a, a1, branch)).toBe(false);
    expect(canReparent(a, b, branch)).toBe(true);
  });
});

describe("M-06 delete count", () => {
  it("counts every idea under the node", () => {
    expect(countDescendants(skeleton, "root")).toBe(3);
    expect(countDescendants(skeleton, "a")).toBe(1);
    expect(countDescendants(skeleton, "b")).toBe(0);
  });
});

describe("M-04 type switch", () => {
  const values = { title: "Pricing", body: "Free tier first", url: "", newUploadId: null };

  it("keeps title and note when switching to Link, and requires the URL", () => {
    expect(buildUpdateBody({ type: "TEXT", url: null }, { ...values, type: "LINK" })).toEqual({
      ok: false,
      field: "url",
      message: "Enter a URL",
    });
    expect(
      buildUpdateBody(
        { type: "TEXT", url: null },
        { ...values, type: "LINK", url: "https://example.com" },
      ),
    ).toEqual({
      ok: true,
      body: { title: "Pricing", body: "Free tier first", type: "LINK", url: "https://example.com" },
    });
  });

  it("doesn't send the old type's fields, so the server clears them", () => {
    const result = buildUpdateBody(
      { type: "LINK", url: "https://example.com" },
      { ...values, type: "TEXT", url: "https://example.com" },
    );

    expect(result).toEqual({
      ok: true,
      body: { title: "Pricing", body: "Free tier first", type: "TEXT" },
    });
  });

  it("requires an uploaded image when switching to Image", () => {
    expect(
      buildUpdateBody({ type: "TEXT", url: null }, { ...values, type: "IMAGE" }),
    ).toMatchObject({ ok: false, field: "image" });
    expect(
      buildUpdateBody(
        { type: "TEXT", url: null },
        { ...values, type: "IMAGE", newUploadId: "up1" },
      ),
    ).toMatchObject({
      ok: true,
      body: { type: "IMAGE", imageUploadId: "up1" },
    });
  });
});

describe("optimistic add", () => {
  it("shows the new idea at once, then removes it and says the tree is full on NODE_LIMIT_REACHED", async () => {
    const queryClient = createQueryClient();
    const tree: TreeDetailResponse = {
      tree: {
        id: "t1",
        title: "T",
        description: null,
        visibility: "PRIVATE",
        categories: [],
        removedAt: null,
        removalReason: null,
        createdAt: "2026-11-01T00:00:00Z",
        updatedAt: "2026-11-01T00:00:00Z",
      },
      owner: { username: "alice", displayName: "Alice", avatarUrl: null },
      isOwner: true,
      nodes: [node("root", null, 0, 0)],
    };
    queryClient.setQueryData(queryKeys.tree("t1"), tree);
    let respond: (r: Response) => void = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            respond = resolve;
          }),
      ),
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    );
    const { result } = renderHook(() => useCreateNode("t1"), { wrapper });
    const nodesNow = () =>
      queryClient.getQueryData<TreeDetailResponse>(queryKeys.tree("t1"))?.nodes.map((n) => n.id);

    act(() => {
      result.current.mutate({ type: "TEXT", parentId: "root", title: "One too many" });
    });
    await waitFor(() => {
      expect(nodesNow()).toHaveLength(2);
    });
    expect(nodesNow()?.[1]).toMatch(/^temp-/);

    respond(
      new Response(JSON.stringify({ error: { code: "NODE_LIMIT_REACHED", message: "full" } }), {
        status: 409,
      }),
    );

    await waitFor(() => {
      expect(nodesNow()).toEqual(["root"]);
    });
    expect(await screen.findByText("This tree is full (2,000 ideas).")).toBeInTheDocument();
  });
});

describe("link preview while typing", () => {
  it("waits until typing stops, then fetches once", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              preview: {
                url: "https://example.com/b",
                title: "B",
                description: null,
                imageUrl: null,
              },
            },
          }),
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(({ url }) => useLinkPreview(url, true), {
      initialProps: { url: "https://example.com/a" },
    });

    act(() => {
      vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS - 100);
    });
    rerender({ url: "https://example.com/b" });
    act(() => {
      vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS - 100);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current).toMatchObject({ status: "ready", preview: { title: "B" } });
  });
});

describe("new branch placement", () => {
  it("goes to the right of a parent without children, and below the lowest child otherwise", () => {
    expect(newChildPosition(layout, "b")).toEqual({ x: 600, y: 200 });
    expect(newChildPosition(layout, "a")).toEqual({ x: 600, y: 20 });
  });

  it("moves further down instead of covering another card", () => {
    const crowded = layoutTree([...skeleton, node("blocker", "b", 600, 20)]);

    expect(newChildPosition(crowded, "a")).toEqual({ x: 600, y: 140 });
  });
});
