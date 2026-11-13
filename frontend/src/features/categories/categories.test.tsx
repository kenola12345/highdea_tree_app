import type { CategoryResponse } from "@highdea/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../../api/queryClient";
import { ToastProvider } from "../../components/Toast";
import { CategoriesTab } from "./CategoriesTab";
import { CategoryPicker } from "./CategoryPicker";

function category(i: number, extra: Partial<CategoryResponse> = {}): CategoryResponse {
  return {
    id: `c${String(i)}`,
    name: `Cat ${String(i)}`,
    color: "#3B82F6",
    treeCount: 0,
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
    ...extra,
  };
}

/** fetch を差し替えて描画する。responses は "METHOD /api/path" → [status, body] */
function renderWith(ui: ReactNode, responses: Record<string, [number, unknown]>) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string, init?: RequestInit) => {
      const key = `${init?.method ?? "GET"} ${input}`;
      const reply = responses[key];
      if (!reply) throw new Error(`Unmocked request: ${key}`);
      return Promise.resolve(new Response(JSON.stringify(reply[1]), { status: reply[0] }));
    }),
  );
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
}

function PickerHarness() {
  const [ids, setIds] = useState<string[]>([]);
  return <CategoryPicker selectedIds={ids} onChange={setIds} />;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CategoryPicker", () => {
  it("stops at 10 categories per tree and disables the rest", async () => {
    const categories = Array.from({ length: 12 }, (_, i) => category(i + 1));
    renderWith(<PickerHarness />, { "GET /api/categories": [200, { data: { categories } }] });
    const user = userEvent.setup();

    for (let i = 1; i <= 10; i++) {
      await user.click(await screen.findByRole("button", { name: `Cat ${String(i)}` }));
    }

    expect(screen.getByText("You can pick up to 10 categories per tree.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cat 11" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cat 1" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Cat 1" })).toBeEnabled();
  });
});

describe("M-07 Category form", () => {
  it("shows a duplicate name (ignoring case) under the name field", async () => {
    renderWith(<CategoriesTab />, {
      "GET /api/categories": [200, { data: { categories: [category(1, { name: "Work" })] } }],
      "POST /api/categories": [
        409,
        {
          error: {
            code: "CATEGORY_NAME_TAKEN",
            message: "You already have a category with this name",
          },
        },
      ],
    });
    const user = userEvent.setup();

    await user.click(await screen.findByTestId("new-category-button"));
    await user.type(screen.getByLabelText("Name"), "work");
    await user.click(screen.getByTestId("category-save"));

    expect(await screen.findByTestId("category-name-error")).toHaveTextContent(
      "You already have a category with this name",
    );
  });
});

describe("M-08 Delete category", () => {
  it("says how many trees lose the category", async () => {
    renderWith(<CategoriesTab />, {
      "GET /api/categories": [
        200,
        { data: { categories: [category(1, { name: "Work", treeCount: 3 })] } },
      ],
    });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Delete" }));

    expect(screen.getByTestId("delete-category-modal")).toHaveTextContent(
      "Remove this category from 3 trees? The trees themselves stay.",
    );
  });
});
