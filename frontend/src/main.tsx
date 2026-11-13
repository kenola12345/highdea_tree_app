import "./index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("#root element is missing in index.html");

// Phase 2 で App（QueryClientProvider・ルーター・ヘッダー）に置き換える
createRoot(rootElement).render(
  <StrictMode>
    <main className="mx-auto max-w-6xl px-4 py-16 md:px-8">
      <h1 className="text-brand-700 text-3xl font-bold">Highdea Tree</h1>
      <p className="mt-2 text-slate-600">Visualize and organize your ideas.</p>
    </main>
  </StrictMode>,
);
