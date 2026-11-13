import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom には ResizeObserver がないため、キャンバス（大きさの追従に使う）を描画するテスト用に何もしない版を用意する
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
if (!("ResizeObserver" in globalThis)) globalThis.ResizeObserver = ResizeObserverStub;

// テストごとに描画した DOM を片付ける
afterEach(() => {
  cleanup();
});
