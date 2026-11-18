import type { NodeSkeleton } from "@highdea/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../../api/queryClient";
import { NodeDetailsPanel } from "./NodeDetailsPanel";

function skeleton(type: NodeSkeleton["type"], title: string): NodeSkeleton {
  return {
    id: "n1",
    parentId: "root",
    type,
    title,
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
    lineLabel: null,
    updatedAt: "2026-11-13T00:00:00Z",
  };
}

function details(extra: Record<string, unknown>) {
  return {
    id: "n1",
    body: null,
    url: null,
    previewTitle: null,
    previewDescription: null,
    previewImageUrl: null,
    imageUrl: null,
    updatedAt: "2026-11-13T00:00:00Z",
    ...extra,
  };
}

function renderPanel(
  node: NodeSkeleton,
  body: Record<string, unknown>,
  onOpenMedia = vi.fn(),
  onClose = vi.fn(),
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ data: { nodes: [details(body)] } }), { status: 200 }),
      ),
    ),
  );
  render(
    <QueryClientProvider client={createQueryClient()}>
      <NodeDetailsPanel treeId="t1" node={node} onClose={onClose} onOpenMedia={onOpenMedia} />
    </QueryClientProvider>,
  );
  return { onOpenMedia, onClose };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("M-12 Node details", () => {
  it("shows the note as plain text, never as HTML", async () => {
    renderPanel(skeleton("TEXT", "Pricing"), { body: "Line one\n<b>not bold</b>" });

    expect(await screen.findByTestId("details-note")).toHaveTextContent("<b>not bold</b>");
    expect(screen.getByRole("heading", { name: "Pricing" })).toBeInTheDocument();
  });

  it("shows a link's preview with an Open link button that opens a new tab", async () => {
    renderPanel(skeleton("LINK", "Mind map"), {
      url: "https://en.wikipedia.org/wiki/Mind_map",
      previewTitle: "Mind map - Wikipedia",
    });

    expect(await screen.findByText("Mind map - Wikipedia")).toBeInTheDocument();
    const link = screen.getByTestId("open-link");
    expect(link).toHaveAttribute("href", "https://en.wikipedia.org/wiki/Mind_map");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("opens an image full size (M-10) and closes with Esc", async () => {
    const { onOpenMedia, onClose } = renderPanel(skeleton("IMAGE", "Sketch"), {
      imageUrl: "/uploads/a.png",
    });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "View full size" }));
    expect(onOpenMedia).toHaveBeenCalledWith({
      title: "Sketch",
      type: "IMAGE",
      imageUrl: "/uploads/a.png",
      url: null,
    });

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
