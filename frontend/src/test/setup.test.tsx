import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// テスト環境（jsdom・Testing Library・jest-dom）が動くことの確認
describe("test setup", () => {
  it("renders a component and finds it by role", () => {
    render(<h1>Highdea Tree</h1>);

    expect(screen.getByRole("heading", { name: "Highdea Tree" })).toBeInTheDocument();
  });
});
