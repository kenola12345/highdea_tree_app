# Coding Standards — 2. Frontend（フロントエンド規約）

Part of the coding standards. Start from [index.md](./index.md). Section numbers (§N) refer to the files listed there.

React 19.3, Vite 8.3, React Router 8.5, TanStack Query 5.107, Tailwind CSS 4.3, d3-hierarchy / d3-zoom / d3-selection *(manifest)*.

### 2.1 Directory Structure

Follow manifest §8 exactly:

```
frontend/src/
├── main.tsx
├── App.tsx           # QueryClientProvider, router, AppHeader
├── router.tsx        # routes and guards (guest-only, login-required, owner redirect)
├── api/              # fetch client (401 handling, error details) and TanStack Query hooks per resource
├── pages/            # P-01 Landing … P-11 NotFound, one file per page
├── features/
│   ├── auth/  trees/  canvas/  nodes/  categories/
│   ├── explore/  trash/  settings/  admin/
├── components/       # shared UI: AppHeader, Modal, ConfirmDialog, Toast, Pagination, FormField
└── lib/              # helpers (dates, URLs, video embeds)
```

- `pages/` files are named after the page and keep the screen ID in a comment: `pages/TreeEditorPage.tsx` (`// P-05 Tree Editor`). Pages compose features; they hold no fetch logic of their own.
- Modals live in their feature folder and keep the modal ID: `features/nodes/NodeEditorModal.tsx` (`// M-04`).
- `components/` only holds UI that knows nothing about a resource. A component that imports a resource hook belongs in `features/`.
- `features/<a>/` never imports from `features/<b>/` internals. If two features need it, move it to `components/` or `lib/`.

### 2.2 Component Design

- Function components only, one exported component per file, props typed with a `type XxxProps`.
- Keep components presentational where possible: data comes from a hook, events go out as callbacks.
- Add a `data-testid` to elements E2E tests act on (buttons, form fields, node cards, modals): `data-testid="node-card"`, `data-testid="add-branch-button"`.
- Business rules shown in the UI *(manifest §4.3)* are derived from data, never hard-coded per screen: the center idea has no Delete action, "+ Add" is disabled at `MAX_NODES_PER_TREE`, a removed tree's visibility switch is disabled with the admin's reason.

❌ Bad: fetches inside a leaf, mixes the root check with the markup, no test id.
```tsx
export function NodeToolbar({ nodeId }: { nodeId: string }) {
  const [node, setNode] = useState<any>(null);
  useEffect(() => {
    fetch(`/api/nodes/${nodeId}`).then((r) => r.json()).then(setNode);
  }, []);
  return <button onClick={() => fetch(`/api/nodes/${nodeId}`, { method: "DELETE" })}>Delete</button>;
}
```

✅ Good: typed props, the rule comes from data, the action is a callback.
```tsx
type NodeToolbarProps = {
  node: NodeSkeleton;
  canAddChild: boolean;
  onAddBranch: (parentId: string) => void;
  onDelete: (nodeId: string) => void;
};

export function NodeToolbar({ node, canAddChild, onAddBranch, onDelete }: NodeToolbarProps) {
  const isRoot = node.parentId === null;
  return (
    <div role="toolbar" className="flex gap-1 rounded-lg bg-white p-1 shadow">
      <button
        type="button"
        data-testid="add-branch-button"
        disabled={!canAddChild}
        title={canAddChild ? "Add branch" : "This tree is full (2,000 ideas)"}
        onClick={() => onAddBranch(node.id)}
      >
        +
      </button>
      {!isRoot && (
        <button type="button" data-testid="delete-node-button" onClick={() => onDelete(node.id)}>
          Delete
        </button>
      )}
    </div>
  );
}
```

### 2.3 Custom Hooks

- Every API call goes through a hook in `api/` (e.g. `api/trees.ts` exports `useMyTrees`, `useCreateTree`). Components never call `fetch` directly.
- All hooks use the one fetch client, `api/client.ts`. It sends `credentials: "same-origin"`, unwraps `{ data }`, throws `ApiError` for `{ error }`, and handles `401` *(manifest §4.3)*.
- Query keys come from one factory, `api/queryKeys.ts`. Don't write key arrays inline. The top-level keys match the manifest's invalidation rules: `['me']`, `['trees']`, `['trash']`, `['categories']`, `['explore']`, `['tree', id]`, `['nodeDetails', treeId, id]`, `['user', username]`.
- Hooks that aren't about the API (e.g. `features/canvas/useVisibleNodes.ts`, `usePointerDrag.ts`) start with `use` and return typed values.

```ts
// frontend/src/api/client.ts
import type { ApiErrorBody, ErrorCode } from "@highdea/shared";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: { field: string; message: string }[],
  ) {
    super(message);
  }
}

/** 共通 fetch クライアント。{ data } を取り出し、{ error } は ApiError として投げる。 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "same-origin",
    headers: init?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...init,
  });
  if (res.ok) return ((await res.json()) as { data: T }).data;

  const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
  const error = new ApiError(
    res.status,
    body?.error.code ?? "INTERNAL_ERROR",
    body?.error.message ?? "Something went wrong",
    body?.error.details,
  );
  // セッション切れ（7日の有効期限など）。/me 以外の 401 はログイン画面へ戻す
  if (res.status === 401 && path !== "/auth/me") onUnauthenticated();
  throw error;
}
```

```ts
// frontend/src/api/queryKeys.ts
export const queryKeys = {
  me: ["me"] as const,
  trees: (params?: { page: number; category?: string }) => ["trees", params ?? {}] as const,
  tree: (id: string) => ["tree", id] as const,
  nodeDetails: (treeId: string, id: string) => ["nodeDetails", treeId, id] as const,
  trash: (page = 1) => ["trash", page] as const,
  categories: ["categories"] as const,
  explore: (params: { page: number; q?: string; category?: string }) => ["explore", params] as const,
  user: (username: string) => ["user", username] as const,
};
```

❌ Bad: inline key, forgets the other caches the manifest lists.
```ts
useMutation({
  mutationFn: (id: string) => apiFetch(`/trees/${id}`, { method: "DELETE" }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["myTrees"] }),
});
```

✅ Good: invalidates every cache that manifest §4.3 names for "trash a tree".
```ts
export function useMoveTreeToTrash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (treeId: string) => apiFetch<{ tree: TreeResponse }>(`/trees/${treeId}`, { method: "DELETE" }),
    onSuccess: async ({ tree }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["trees"] }),
        queryClient.invalidateQueries({ queryKey: ["trash"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.categories }),
        ...(tree.visibility === "PUBLIC"
          ? [
              queryClient.invalidateQueries({ queryKey: ["explore"] }),
              queryClient.invalidateQueries({ queryKey: queryKeys.user(tree.owner.username) }),
            ]
          : []),
      ]);
    },
  });
}
```

### 2.4 Styling (Tailwind CSS 4)

- Tailwind utility classes only. No CSS modules, no inline `style`, except values computed at runtime (canvas `transform`, node positions).
- Tailwind 4 is configured in CSS (`@import "tailwindcss";` + `@theme`), in `src/index.css`. There is no `tailwind.config.js`. Colors, fonts and spacing used in more than one place are `@theme` tokens.
- **Mobile side gutter:** text sits at least `px-4` (16 px) from the screen edge on phones. The page container defines this once (e.g. `components/PageContainer.tsx`: `mx-auto max-w-6xl px-4 md:px-8`). Use the container; don't invent another padding value. When adding or moving text, check it at a phone width.
- Mobile-first: base classes are for phones, `md:` / `lg:` add the desktop layout.
- Long class lists are sorted by `prettier-plugin-tailwindcss`. Variants are chosen with a lookup object or `clsx`, not with string concatenation.

```css
/* frontend/src/index.css */
@import "tailwindcss";

@theme {
  --color-brand-500: #16a34a;
  --color-brand-600: #15803d;
  --color-canvas: #f8fafc;
  --font-sans: "Inter", system-ui, sans-serif;
}
```

❌ Bad: dynamic class names that Tailwind can't detect, and an invented gutter.
```tsx
<span className={`bg-${color}-500 px-[13px]`}>{category.name}</span>
```

✅ Good: user colors are runtime values (`category.color` is a hex string), so they go in `style`; layout uses the standard classes.
```tsx
<span
  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs text-white"
  style={{ backgroundColor: category.color }}
>
  {category.name}
</span>
```

### 2.5 State Management

| Kind of state | Where it lives | Example |
|---|---|---|
| Server state | TanStack Query only | trees, node skeleton, node details, categories, `/me` |
| URL state | React Router search params | Explore `?q=&category=&page=`, `/login?next=` |
| Form state | local `useState` + the shared Zod schema | M-01 New Tree, M-04 Node Editor |
| Canvas view state | local state / refs inside `features/canvas/` | zoom transform, selected node, drag in progress |

- Don't copy server data into `useState` or a global store. Read it from the query cache.
- No global state library (Redux, Zustand) in v1. If one seems necessary, discuss it first.
- The logged-in user comes from `useMe()` (`GET /api/auth/me`). A `401` from `/me` means "guest", not an error *(manifest)*. `role` from `/me` only shows or hides admin buttons; it is never a security check.
- Drag moves are optimistic: update the `['tree', id]` cache, send `PATCH /api/trees/:id/nodes/positions`, and roll back with the saved snapshot on error.

```ts
export function useSavePositions(treeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nodes: PositionUpdate[]) =>
      apiFetch(`/trees/${treeId}/nodes/positions`, { method: "PATCH", body: JSON.stringify({ nodes }) }),
    onMutate: async (nodes) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tree(treeId) });
      const previous = queryClient.getQueryData<TreeDetailResponse>(queryKeys.tree(treeId));
      queryClient.setQueryData<TreeDetailResponse>(queryKeys.tree(treeId), (old) =>
        old ? applyPositions(old, nodes) : old,
      );
      return { previous };
    },
    // 失敗したらドラッグ前の位置に戻す
    onError: (_err, _nodes, ctx) => queryClient.setQueryData(queryKeys.tree(treeId), ctx?.previous),
  });
}
```

### 2.6 Forms and Errors

- Forms validate with the same schema the backend uses (`@highdea/shared`) before sending.
- When the server returns `VALIDATION_ERROR`, show each `details[]` item next to its field (`FormField` takes an `error` prop). Other error codes are shown as a form-level message or a toast.
- A `404` for a page's main resource (tree, user) shows P-11 Not Found, whatever the reason *(manifest)*.

### 2.7 Canvas

- The canvas is SVG drawn by React. D3 is used only for layout (`d3-hierarchy`) and the zoom transform (`d3-zoom`). D3 never adds or removes DOM elements that React renders.
- Draw only nodes inside the visible area plus a margin; fetch node details in batches (`GET /api/trees/:id/nodes?ids=`) for nodes that are visible at a readable zoom *(manifest §3.5)*.
- Gestures use Pointer Events only (one code path for mouse, touch and pen) *(manifest)*. Don't add separate `touchstart` / `mousedown` handlers.
