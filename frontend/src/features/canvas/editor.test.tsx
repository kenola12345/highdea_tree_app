import type { NodeSkeleton, TreeDetailResponse } from "@highdea/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PREVIEW_DEBOUNCE_MS, useLinkPreview } from "../../api/linkPreview";
import { useCreateNode } from "../../api/nodes";
import { createQueryClient } from "../../api/queryClient";
import { queryKeys } from "../../api/queryKeys";
import { ColorField } from "../../components/ColorField";
import { OpenLink } from "../../components/OpenLink";
import { ToastProvider } from "../../components/Toast";
import { buildUpdateBody } from "../nodes/nodeForm";
import { parseSize } from "../nodes/NodeShapeFields";
import { canReparent, findDropTarget } from "./dropTarget";
import { cardSize, DEFAULT_LINE_COLOR, layoutTree } from "./layout";
import { linkGeometry } from "./NodeLink";
import { resizeBox } from "./ResizeHandles";
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
    lineColor: null,
    cardColor: null,
    shape: "ROUNDED",
    width: null,
    height: null,
    fontSize: null,
    textColor: null,
    role: null,
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
  const values = {
    title: "Pricing",
    body: "Free tier first",
    url: "",
    newUploadId: null,
    lineColor: null,
    cardColor: null,
    shape: "ROUNDED" as const,
    width: null,
    height: null,
    fontSize: null,
    textColor: null,
    role: null,
  };

  it("keeps title and note when switching to Link, and requires the URL", () => {
    expect(
      buildUpdateBody(
        {
          type: "TEXT",
          url: null,
          lineColor: null,
          cardColor: null,
          shape: "ROUNDED" as const,
          width: null,
          height: null,
          fontSize: null,
          textColor: null,
          role: null,
        },
        { ...values, type: "LINK" },
      ),
    ).toEqual({
      ok: false,
      field: "url",
      message: "Enter a URL",
    });
    expect(
      buildUpdateBody(
        {
          type: "TEXT",
          url: null,
          lineColor: null,
          cardColor: null,
          shape: "ROUNDED" as const,
          width: null,
          height: null,
          fontSize: null,
          textColor: null,
          role: null,
        },
        { ...values, type: "LINK", url: "https://example.com" },
      ),
    ).toEqual({
      ok: true,
      body: { title: "Pricing", body: "Free tier first", type: "LINK", url: "https://example.com" },
    });
  });

  it("doesn't send the old type's fields, so the server clears them", () => {
    const result = buildUpdateBody(
      {
        type: "LINK",
        url: "https://example.com",
        lineColor: null,
        cardColor: null,
        shape: "ROUNDED" as const,
        width: null,
        height: null,
        fontSize: null,
        textColor: null,
        role: null,
      },
      { ...values, type: "TEXT", url: "https://example.com" },
    );

    expect(result).toEqual({
      ok: true,
      body: { title: "Pricing", body: "Free tier first", type: "TEXT" },
    });
  });

  it("requires an uploaded image when switching to Image", () => {
    expect(
      buildUpdateBody(
        {
          type: "TEXT",
          url: null,
          lineColor: null,
          cardColor: null,
          shape: "ROUNDED" as const,
          width: null,
          height: null,
          fontSize: null,
          textColor: null,
          role: null,
        },
        { ...values, type: "IMAGE" },
      ),
    ).toMatchObject({ ok: false, field: "image" });
    expect(
      buildUpdateBody(
        {
          type: "TEXT",
          url: null,
          lineColor: null,
          cardColor: null,
          shape: "ROUNDED" as const,
          width: null,
          height: null,
          fontSize: null,
          textColor: null,
          role: null,
        },
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
      canvas: {
        gridStyle: "LINES",
        gridColor: null,
        gridOpacity: 100,
        gridSpacing: 24,
        backgroundColor: null,
        nodeStyle: "MINIMAL",
      },
      connections: [],
      groups: [],
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

describe("line colors", () => {
  it("each line uses the nearest set color up the branch, or gray", () => {
    const colored = layoutTree([
      { ...node("root", null, 0, 0), lineColor: "#3B82F6" },
      { ...node("a", "root", 300, -100), lineColor: "#EF4444" },
      node("a1", "a", 600, -100),
      node("b", "root", 300, 200),
    ]);
    const plain = layoutTree([node("root", null, 0, 0), node("b", "root", 300, 200)]);

    expect(colored.byId.get("a1")?.branchColor).toBe("#EF4444");
    expect(colored.byId.get("b")?.branchColor).toBe("#3B82F6");
    expect(plain.byId.get("b")?.branchColor).toBe(DEFAULT_LINE_COLOR);
  });

  it("M-04 sends lineColor only when it changed, and null to inherit again", () => {
    const original = {
      type: "TEXT" as const,
      url: null,
      lineColor: "#EF4444",
      cardColor: null,
      shape: "ROUNDED" as const,
      width: null,
      height: null,
      fontSize: null,
      textColor: null,
      role: null,
    };
    const values = {
      type: "TEXT" as const,
      title: "T",
      body: "",
      url: "",
      newUploadId: null,
      cardColor: null,
      shape: "ROUNDED" as const,
      width: null,
      height: null,
      fontSize: null,
      textColor: null,
      role: null,
    };

    expect(buildUpdateBody(original, { ...values, lineColor: "#EF4444" })).toEqual({
      ok: true,
      body: { title: "T", body: null },
    });
    expect(buildUpdateBody(original, { ...values, lineColor: null })).toEqual({
      ok: true,
      body: { title: "T", body: null, lineColor: null },
    });
  });

  it("draws S-curves from the facing sides of the cards", () => {
    const a = layout.byId.get("a");
    const root = layout.byId.get("root");
    if (!a || !root) throw new Error("layout");

    const side = linkGeometry(root, a, "card");
    expect(side.start.x).toBeGreaterThan(root.x);
    expect(side.end.x).toBeLessThan(a.x);
    expect(side.controls?.[0].y).toBe(side.start.y);

    const dots = linkGeometry(root, a, "dot");
    expect(dots.start).toEqual({ x: root.x, y: root.y });
    expect(dots.controls).toBeNull();
  });
});

describe("open link", () => {
  it("only links http/https URLs and opens them in a new tab", () => {
    const { rerender } = render(<OpenLink url="https://example.com/page" />);
    const link = screen.getByTestId("open-link");
    expect(link).toHaveAttribute("href", "https://example.com/page");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    rerender(<OpenLink url="javascript:alert(1)" />);
    expect(screen.queryByTestId("open-link")).not.toBeInTheDocument();
  });
});

describe("card colors and color picker", () => {
  it("M-04 sends cardColor only when it changed", () => {
    const original = {
      type: "TEXT" as const,
      url: null,
      lineColor: null,
      cardColor: null,
      shape: "ROUNDED" as const,
      width: null,
      height: null,
      fontSize: null,
      textColor: null,
      role: null,
    };
    const values = {
      type: "TEXT" as const,
      title: "T",
      body: "",
      url: "",
      newUploadId: null,
      lineColor: null,
      shape: "ROUNDED" as const,
      width: null,
      height: null,
      fontSize: null,
      textColor: null,
      role: null,
    };

    expect(
      buildUpdateBody(original, {
        ...values,
        cardColor: null,
        shape: "ROUNDED" as const,
        width: null,
        height: null,
        fontSize: null,
        textColor: null,
        role: null,
      }),
    ).toEqual({
      ok: true,
      body: { title: "T", body: null },
    });
    expect(
      buildUpdateBody(original, {
        ...values,
        cardColor: "#FDE68A",
        shape: "ROUNDED" as const,
        width: null,
        height: null,
        fontSize: null,
        textColor: null,
        role: null,
      }),
    ).toEqual({
      ok: true,
      body: {
        title: "T",
        body: null,
        cardColor: "#FDE68A",
      },
    });
  });

  it("ColorField accepts a typed hex color, ignores half-typed values, and resets to Default", async () => {
    const onChange = vi.fn();
    render(
      <ColorField
        id="card-color"
        value="#FFFFFF"
        onChange={onChange}
        fallbackColor="#FFFFFF"
        fallbackLabel="Default"
      />,
    );
    const user = userEvent.setup();
    const input = screen.getByRole("textbox");

    await user.clear(input);
    await user.type(input, "#12");
    expect(onChange).not.toHaveBeenCalledWith("#12");
    await user.type(input, "ab34");
    expect(onChange).toHaveBeenLastCalledWith("#12AB34");

    await user.click(screen.getByTestId("card-color-default"));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

describe("card shape and size", () => {
  it("cardSize uses the node's own width and height, else the default size", () => {
    expect(cardSize({ isRoot: false })).toEqual({ width: 200, height: 84 });
    expect(cardSize({ isRoot: true, width: null, height: null })).toEqual({
      width: 240,
      height: 96,
    });
    expect(cardSize({ isRoot: false, width: 120, height: null })).toEqual({
      width: 120,
      height: 84,
    });
  });

  it("lines meet a resized card at the middle of its facing edge", () => {
    const l = layoutTree([
      node("root", null, 0, 0),
      { ...node("a", "root", 400, 0), width: 300, height: 100 },
    ]);
    const root = l.byId.get("root");
    const a = l.byId.get("a");
    if (!root || !a) throw new Error("layout");
    expect(linkGeometry(root, a, "card").end).toEqual({ x: 400 - 150, y: 0 });
  });

  it("resizing from a corner keeps the opposite corner in place", () => {
    const start = { x: 0, y: 0, width: 200, height: 100 };
    // 右下を (+40, +20) 動かす → 左上の角 (-100, -50) は動かない
    const se = resizeBox(start, "se", 40, 20, false);
    expect(se).toEqual({ x: 20, y: 10, width: 240, height: 120 });
    expect(se.x - se.width / 2).toBe(-100);
    expect(se.y - se.height / 2).toBe(-50);
    // 左上を (-40, -20) 動かす → 右下の角 (100, 50) は動かない
    const nw = resizeBox(start, "nw", -40, -20, false);
    expect(nw.x + nw.width / 2).toBe(100);
    expect(nw.y + nw.height / 2).toBe(50);
  });

  it("resizing keeps the size within 60–800 × 40–600 and keeps the ratio with Shift", () => {
    const start = { x: 0, y: 0, width: 200, height: 100 };
    expect(resizeBox(start, "se", -1000, -1000, false)).toMatchObject({ width: 60, height: 40 });
    expect(resizeBox(start, "se", 5000, 5000, false)).toMatchObject({ width: 800, height: 600 });
    expect(resizeBox(start, "se", 100, 0, true)).toMatchObject({ width: 300, height: 150 });
  });

  it("M-04 size fields: empty is the default size, out-of-range or decimals are errors", () => {
    expect(parseSize({ width: "", height: " " })).toEqual({ ok: true, width: null, height: null });
    expect(parseSize({ width: "120", height: "80" })).toEqual({ ok: true, width: 120, height: 80 });
    expect(parseSize({ width: "59", height: "80.5" })).toEqual({
      ok: false,
      errors: {
        width: "Use a whole number from 60 to 800",
        height: "Use a whole number from 40 to 600",
      },
    });
  });

  it("M-04 sends shape and size only when they changed, and null for Auto", () => {
    const original = {
      type: "TEXT" as const,
      url: null,
      lineColor: null,
      cardColor: null,
      shape: "ROUNDED" as const,
      width: 300,
      height: 120,
      fontSize: null,
      textColor: null,
      role: null,
    };
    const values = {
      type: "TEXT" as const,
      title: "T",
      body: "",
      url: "",
      newUploadId: null,
      lineColor: null,
      cardColor: null,
      fontSize: null,
      textColor: null,
      role: null,
    };

    expect(
      buildUpdateBody(original, { ...values, shape: "ROUNDED", width: 300, height: 120 }),
    ).toEqual({ ok: true, body: { title: "T", body: null } });
    expect(
      buildUpdateBody(original, { ...values, shape: "ELLIPSE", width: null, height: null }),
    ).toEqual({
      ok: true,
      body: { title: "T", body: null, shape: "ELLIPSE", width: null, height: null },
    });
  });
});

describe("text size and color", () => {
  it("M-04 sends fontSize and textColor only when they changed, and null for Default / Auto", () => {
    const original = {
      type: "TEXT" as const,
      url: null,
      lineColor: null,
      cardColor: null,
      shape: "ROUNDED" as const,
      width: null,
      height: null,
      fontSize: 18,
      textColor: "#B91C1C",
      role: null,
    };
    const values = {
      type: "TEXT" as const,
      title: "T",
      body: "",
      url: "",
      newUploadId: null,
      lineColor: null,
      cardColor: null,
      shape: "ROUNDED" as const,
      width: null,
      height: null,
      role: null,
    };

    expect(buildUpdateBody(original, { ...values, fontSize: 18, textColor: "#B91C1C" })).toEqual({
      ok: true,
      body: { title: "T", body: null },
    });
    expect(buildUpdateBody(original, { ...values, fontSize: null, textColor: null })).toEqual({
      ok: true,
      body: { title: "T", body: null, fontSize: null, textColor: null },
    });
  });
});
