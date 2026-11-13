import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// テストごとに描画した DOM を片付ける
afterEach(() => {
  cleanup();
});
