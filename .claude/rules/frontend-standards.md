---
paths: "frontend/**/*"
---

# Frontend Coding Standards（フロントエンド規約）

## トリガー（いつ参照するか）
- When adding or changing a page (P-xx), modal (M-xx) or component
- When adding or changing an API hook, the fetch client, query keys or cache invalidation in `frontend/src/api/`
- When writing Tailwind styles or adding or moving text (check the mobile side gutter)
- When working on the tree canvas, drag and drop, gestures or lazy loading
- When building a form or showing API errors
- When rendering user content (node notes, links, video embeds)

## 目的（何のために）
- To keep components, hooks, server state and styling consistent
- To make sure every change invalidates the right caches and shows business rules the same way
- To prevent XSS in user content

## 参照ファイル
Read `standards/frontend.md`. Also read `standards/api.md` when changing `frontend/src/api/`, and the XSS section of `standards/security.md` (§9.5) when rendering user content.
