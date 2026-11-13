# Frontend Implementation Task List（フロントエンド実装タスクリスト）

> Source: `manifests/` v1.0 (the Screens sections of common.md, users.md, trees.md, nodes.md, explore.md; the API specs; common.md §7–§9) and `standards/` (general, frontend, api, security, testing).
> Each task fits in 15 minutes or less. Mark it `[x]` when done. Tasks are numbered `<Phase>-<n>`.
> Paths are relative to the project root `highdea_tree_app/` (the repository root). The format matches `backend-tasks.md`; "Backend" dependencies refer to its Phases.

**Screen rule:** each page or modal task means "implement exactly what the manifest says for it": access, API calls, business-rule UI, loading / empty / error states, and `data-testid` on every element tests act on (`standards/frontend.md` §2.2).

**Backend dependency:** the plan assumes the backend is built first (`backend-tasks.md`). If a backend Phase isn't done yet, the frontend Phase can still be built and unit-tested with `apiFetch` mocked in Vitest; manual checks in the browser wait for the backend. No mock server is planned.

---

## Phase 1: Environment Setup（環境構築・基本設定） 【直列】
- Depends on: none (the root `highdea_tree_app/`, root `package.json`, `tsconfig.base.json`, ESLint and Prettier from backend Phase 1 exist). Doesn't touch `backend/`
- Main files: `frontend/package.json`, `frontend/index.html`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/src/{main.tsx,index.css}`, `frontend/vitest.config.ts`, `frontend/playwright.config.ts`, root `package.json` (scripts only)

- [x] 1-1 Create `frontend/` with Vite's React + TypeScript template, then delete the template's demo files and assets. Check: `frontend/` is listed in the root workspaces and `npm install` succeeds from the root
- [x] 1-2 Set the dependencies in `frontend/package.json`: `react@19.3`, `react-dom@19.3`, `react-router@8.5`, `@tanstack/react-query@5.107`, `d3-hierarchy@3.1`, `d3-zoom@3.0`, `d3-selection@3.0`, `clsx`, `@highdea/shared` (workspace); dev: `vite@8.3`, `@vitejs/plugin-react`, `tailwindcss@4.3`, `@tailwindcss/vite`, `@types/d3-hierarchy`, `@types/d3-zoom`, `@types/d3-selection`, `vitest@5.1`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `@playwright/test@1.65`
- [x] 1-3 Create `frontend/tsconfig.json` from `standards/general.md` §1.1. Check: `npm run typecheck -w frontend` passes
- [x] 1-4 Write `frontend/vite.config.ts`: React and Tailwind plugins, dev server on port `5173`, proxy `/api` and `/uploads` to `http://localhost:3000` (same origin, so the auth cookie is sent; manifest §9)
- [x] 1-5 Write `frontend/src/index.css` with `@import "tailwindcss";` and the `@theme` tokens (brand colors, canvas background, font) from `standards/frontend.md` §2.4, and import it in `main.tsx`
- [x] 1-6 Write `frontend/index.html` (viewport meta, `lang="en"`, title "Highdea Tree") and a minimal `main.tsx` rendering "Highdea Tree". Check: `npm run dev -w frontend` shows the text with Tailwind styles applied
- [x] 1-7 Add frontend scripts: `dev`, `build`, `preview`, `typecheck`, `test` (Vitest), `test:e2e` (Playwright)
- [x] 1-8 Create `frontend/vitest.config.ts` (jsdom, `@testing-library/jest-dom` setup file) and one sample test. Check: `npm test -w frontend` passes
- [x] 1-9 Create `frontend/playwright.config.ts`: test dir `tests/e2e`, projects for Desktop Chrome and a phone (e.g. Pixel 7, touch enabled), `webServer` entries that start the backend and frontend when they aren't running
- [x] 1-10 Update the root `package.json` scripts: `dev` runs the backend and frontend together (add `concurrently`), `test` runs every workspace, `test:e2e` runs `npm run test:e2e -w frontend`. Check: `npm run dev` starts both, and `http://localhost:5173/api/health` returns `200` through the proxy

---

## Phase 2: Common Foundation（共通基盤） 【直列】
- Depends on: Phase 1; Backend Phase 3 for `GET /api/auth/me` (or mocked in tests)
- Main files: `frontend/src/{App.tsx,router.tsx}`, `frontend/src/api/{client,queryKeys,queryClient,invalidate,auth}.ts`, `frontend/src/features/auth/{useMe,useLogout}.ts`, `frontend/src/components/**`, `frontend/src/lib/**`, `frontend/src/pages/*.tsx` (all 11 created here as placeholders), `frontend/src/features/trees/{TreeCard,VisibilityBadge}.tsx`, `frontend/src/features/categories/CategoryChip.tsx`
- Why serial: creates every shared file (router, query keys, header, shared components, placeholder pages), so screen Phases only touch their own files

- [ ] 2-1 Implement `frontend/src/api/client.ts`: `apiFetch<T>` (`/api` prefix, `credentials: "same-origin"`, JSON unless `FormData`, unwraps `{ data }`), `ApiError` (`status`, `code`, `message`, `details`) and a settable `onUnauthenticated` callback (`standards/frontend.md` §2.3)
- [ ] 2-2 Create `frontend/src/api/queryKeys.ts` with every key: `me`, `trees`, `tree`, `nodeDetails`, `trash`, `categories`, `explore`, `exploreCategories`, `user` (`standards/frontend.md` §2.3)
- [ ] 2-3 Create `frontend/src/api/queryClient.ts`: no retry on 4xx, one retry on network/5xx, sensible `staleTime`; and `frontend/src/api/invalidate.ts` with `invalidateAfterTreeChange(queryClient, tree)` covering `['trees']`, `['trash']`, `['categories']` and, for public trees, `['explore']` and the owner's profile (manifest common.md §4 SPA points)
- [ ] 2-4 Implement `frontend/src/api/auth.ts` (`useMeQuery`: `401` → `null` user, not an error) and `frontend/src/features/auth/useMe.ts` (returns `{ user, isGuest, isAdmin, isLoading }`) and `useLogout.ts` (`POST /api/auth/logout`, clear the query cache, go to `/`)
- [ ] 2-5 Wire the session-expiry rule in `App.tsx`: `onUnauthenticated` clears `['me']` and navigates to `/login?next=<current url>` (any `401` except from `/me`)
- [ ] 2-6 Create the 11 placeholder pages in `frontend/src/pages/`: `LandingPage` (P-01), `SignupPage` (P-02), `LoginPage` (P-03), `MyTreesPage` (P-04), `TreeEditorPage` (P-05), `TreeViewerPage` (P-06), `ExplorePage` (P-07), `UserProfilePage` (P-08), `TrashPage` (P-09), `SettingsPage` (P-10), `NotFoundPage` (P-11), each with its screen ID comment and a heading
- [ ] 2-7 Implement the guards in `frontend/src/router.tsx`: `GuestOnly` (logged in → `/me`) and `RequireAuth` (guest → `/login?next=<url>`), showing a spinner while `/me` loads
- [ ] 2-8 Register every route in `router.tsx`: `/`, `/signup`, `/login` (guest only), `/me`, `/trash`, `/settings`, `/trees/:id/edit` (login required), `/trees/:id`, `/explore`, `/u/:username` (anyone), `*` → P-11. Check: each URL shows its placeholder; `/me` as a guest goes to `/login?next=%2Fme`
- [ ] 2-9 Implement `frontend/src/App.tsx`: `QueryClientProvider`, `ToastProvider`, router, `AppHeader` on every page
- [ ] 2-10 Implement `frontend/src/components/AppHeader.tsx`: logo → `/`, Explore; guests: "Log in", "Sign up"; logged in: My Trees, Trash, Settings, avatar, Log out. Collapses into a menu button on phones
- [ ] 2-11 Implement `frontend/src/components/PageContainer.tsx` (`mx-auto max-w-6xl px-4 md:px-8`, the standard mobile gutter) and use it in every placeholder page
- [ ] 2-12 Implement `frontend/src/components/Modal.tsx`: portal, backdrop click and `Esc` close, focus trap, `aria-modal`, title; centered dialog on desktop, **full-screen sheet on phones** (manifest nodes.md)
- [ ] 2-13 Implement `frontend/src/components/ConfirmDialog.tsx` (built on `Modal`; message, danger button, pending state) and `frontend/src/components/Toast.tsx` (`ToastProvider` + `useToast`, auto-dismiss, `aria-live`)
- [ ] 2-14 Implement `frontend/src/components/FormField.tsx` (label, input slot, error text, `aria-describedby`) and `Pagination.tsx` (from `{ page, limit, total }`, page count `ceil(total / limit)`, writes `?page=` to the URL)
- [ ] 2-15 Implement `frontend/src/components/{Spinner,EmptyState,ErrorState}.tsx` for loading, empty and error states
- [ ] 2-16 Implement `frontend/src/lib/forms.ts`: `useApiForm(schema)` that validates with a shared Zod schema before sending and maps a server `VALIDATION_ERROR`'s `details` to field errors (manifest "Field-level errors")
- [ ] 2-17 Implement `frontend/src/lib/dates.ts` (UTC ISO → viewer's local date/time, relative "updated 3 days ago", `daysLeft(purgeAt)`) and `frontend/src/lib/urls.ts` (`safeHttpUrl`, `domainOf`)
- [ ] 2-18 Implement `frontend/src/lib/videoEmbed.ts` (YouTube/Vimeo URL → fixed embed URL and thumbnail, else `null`) (`standards/security.md` §9.5)
- [ ] 2-19 Implement the shared tree pieces used by several Phases: `frontend/src/features/categories/CategoryChip.tsx`, `frontend/src/features/trees/VisibilityBadge.tsx` (Private / Public / "Removed by admin") and `frontend/src/features/trees/TreeCard.tsx` (title, description, category chips, visibility badge, node count, last updated, optional owner link and menu slot)
- [ ] 2-20 Implement `NotFoundPage` (P-11): "This page doesn't exist or isn't public." with links to Explore and Home; export a `<NotFound />` that pages render on a `404` for their main resource
- [ ] 2-21 Unit tests: `apiFetch` (unwrap, `ApiError` with `details`, `401` callback except `/me`), `useApiForm` mapping `details`, `daysLeft`, `videoEmbed` (valid YouTube, `youtu.be`, Vimeo, others `null`), guards (redirects)

---

## Phase 3: Landing & Auth Screens（ランディング・認証画面） 【並列可】
- Depends on: Phase 2; Backend Phase 3
- Main files: `frontend/src/pages/{LandingPage,SignupPage,LoginPage}.tsx`, `frontend/src/features/auth/{SignupForm,LoginForm}.tsx`, `frontend/src/api/authMutations.ts`, `frontend/src/features/auth/*.test.tsx` (no overlap with other Phases)
- Screens: P-01, P-02, P-03
- APIs: `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me`

- [ ] 3-1 Implement `frontend/src/api/authMutations.ts`: `useSignup` and `useLogin` (on success set `['me']` with the returned user)
- [ ] 3-2 Implement `SignupForm.tsx`: email, username (hint "3–30: a-z, 0-9, _"), display name, password (8–72), shared `signupSchema`; server errors under fields (`EMAIL_TAKEN`, `USERNAME_TAKEN`, `USERNAME_RESERVED` → username/email field); `429` → form message
- [ ] 3-3 Implement `SignupPage` (P-02): form in `PageContainer`, link to Log in; on success → `/me`
- [ ] 3-4 Implement `LoginForm.tsx` + `LoginPage` (P-03): email, password; `INVALID_CREDENTIALS` → one form-level message; `429` → "Too many attempts, try again later"; on success → `?next=` (only same-site paths starting with `/`) or `/me`
- [ ] 3-5 Implement `LandingPage` (P-01): what Highdea Tree is, a sample tree image, buttons to Explore and Sign up; logged-in users see "Go to My Trees" instead
- [ ] 3-6 Unit tests: signup field errors from `details`, login redirect to `next`, `next` pointing to another site is ignored, landing buttons for guest vs. logged-in

---

## Phase 4: Categories（カテゴリ） 【並列可】
- Depends on: Phase 2; Backend Phase 6
- Main files: `frontend/src/api/categories.ts`, `frontend/src/features/categories/{CategoryFormModal,DeleteCategoryModal,CategoryPicker,CategoriesTab,ColorPicker}.tsx` + tests (no overlap with other Phases)
- Screens: M-07, M-08, the Settings Categories tab (content for P-10), the category picker used by M-01 / M-02
- APIs: `GET /api/categories`, `POST /api/categories`, `PATCH /api/categories/:id`, `DELETE /api/categories/:id`

- [ ] 4-1 Implement `frontend/src/api/categories.ts`: `useCategories`, `useCreateCategory`, `useUpdateCategory` (also invalidates cached trees showing the category), `useDeleteCategory` (invalidates `['categories']`, `['trees']`, `['tree']`)
- [ ] 4-2 Implement `ColorPicker.tsx`: a preset palette plus a `#RRGGBB` input, keyboard accessible
- [ ] 4-3 Implement `CategoryFormModal.tsx` (M-07): name and color, create or edit mode, `CATEGORY_NAME_TAKEN` under the name field, `CATEGORY_LIMIT_REACHED` (100) as a form message; returns the created category to its caller
- [ ] 4-4 Implement `DeleteCategoryModal.tsx` (M-08): "Remove this category from N trees? The trees themselves stay." with N from `treeCount`
- [ ] 4-5 Implement `CategoryPicker.tsx`: multi-select of the user's categories, max 10 (further options disabled with a hint), "+ New category" opens M-07 and selects the new category
- [ ] 4-6 Implement `CategoriesTab.tsx`: list sorted A–Z with color, name and tree count; "+ New category", "Edit" and "Delete" per row; empty state
- [ ] 4-7 Unit tests: picker stops at 10, M-07 shows the duplicate-name error under the field, M-08 shows the tree count

---

## Phase 5: Settings & Account（設定・アカウント） 【並列可】
- Depends on: Phase 2, Phase 4 (`CategoriesTab`, imported only); Backend Phase 4
- Main files: `frontend/src/pages/SettingsPage.tsx`, `frontend/src/api/users.ts`, `frontend/src/features/settings/{ProfileTab,AccountTab,ChangeEmailUsernameForm,ChangePasswordForm,DeleteAccountModal}.tsx` + tests (no overlap with other Phases)
- Screens: P-10, M-11
- APIs: `PATCH /api/users/me`, `PATCH /api/users/me/account`, `PATCH /api/users/me/password`, `POST /api/users/me/deactivate`

- [ ] 5-1 Implement `frontend/src/api/users.ts` (settings part): `useUpdateProfile`, `useUpdateAccount`, `useChangePassword`, `useDeactivate` (update or clear `['me']`)
- [ ] 5-2 Implement `SettingsPage` (P-10): tabs Profile / Account / Categories, the active tab kept in `?tab=`, accessible tab list
- [ ] 5-3 Implement `ProfileTab.tsx`: display name and avatar URL (with preview), saved toast
- [ ] 5-4 Implement `ChangeEmailUsernameForm.tsx`: new email and/or username plus current password; `WRONG_PASSWORD` under the password field; `EMAIL_TAKEN` / `USERNAME_TAKEN` / `USERNAME_RESERVED` under their fields; `429` message; note that the old username is released immediately
- [ ] 5-5 Implement `ChangePasswordForm.tsx`: current and new password (8–72, must differ); `WRONG_PASSWORD`; success toast; clears the fields
- [ ] 5-6 Implement `AccountTab.tsx` with both forms and the "Delete account" button
- [ ] 5-7 Implement `DeleteAccountModal.tsx` (M-11): explains the effects (profile and public trees disappear, email and username stay taken, no undo), asks for the password, then clears the cache and goes to `/` as a guest
- [ ] 5-8 Unit tests: wrong password shown under the field, M-11 calls deactivate and navigates to `/`, tab state follows `?tab=`

---

## Phase 6: My Trees & Trash（マイツリー・ゴミ箱） 【並列可】
- Depends on: Phase 2, Phase 4 (`CategoryPicker`, `CategoryFormModal`, imported only); Backend Phases 5, 6
- Main files: `frontend/src/pages/{MyTreesPage,TrashPage}.tsx`, `frontend/src/api/{trees,trash}.ts`, `frontend/src/features/trees/{NewTreeModal,TreeSettingsModal,MoveToTrashModal,TreeCardMenu,MyTreesFilter}.tsx`, `frontend/src/features/trash/{TrashList,TrashItem}.tsx` + tests (no overlap with other Phases)
- Screens: P-04, P-09, M-01, M-02, M-03
- APIs: `GET /api/trees`, `POST /api/trees`, `PATCH /api/trees/:id`, `DELETE /api/trees/:id`, `GET /api/trash`, `POST /api/trees/:id/restore`, `GET /api/categories`

- [ ] 6-1 Implement `frontend/src/api/trees.ts` (list and mutations): `useMyTrees({ page, categoryId })`, `useCreateTree`, `useUpdateTree` (also updates `['tree', id]`), `useMoveTreeToTrash`, all invalidating with `invalidateAfterTreeChange`
- [ ] 6-2 Implement `frontend/src/api/trash.ts`: `useTrash(page)`, `useRestoreTree`
- [ ] 6-3 Implement `MyTreesFilter.tsx`: category filter from the user's categories, kept in `?category=`; `CATEGORY_NOT_FOUND` resets the filter
- [ ] 6-4 Implement `MyTreesPage` (P-04) part 1: grid of `TreeCard`s (responsive columns), paging, loading / empty ("Create your first tree") / error states
- [ ] 6-5 `MyTreesPage` part 2: "+ New tree" button, "Removed by admin" badge on removed trees, card click → `/trees/:id/edit`
- [ ] 6-6 Implement `TreeCardMenu.tsx`: "Edit details" (M-02) and "Delete" (M-03)
- [ ] 6-7 Implement `NewTreeModal.tsx` (M-01): title, description, center idea text (defaults to the title), visibility, `CategoryPicker`; on success navigate to `/trees/:id/edit`
- [ ] 6-8 Implement `TreeSettingsModal.tsx` (M-02) part 1: edit title, description, visibility, categories; saved toast
- [ ] 6-9 `TreeSettingsModal` part 2: for a removed tree, show the admin's reason and disable the visibility switch with "Removed by an admin; can't be made public"; handle `409 TREE_REMOVED`; "Move to Trash" button opens M-03
- [ ] 6-10 Implement `MoveToTrashModal.tsx` (M-03): "This tree will be in Trash for 10 days, then deleted permanently."; from the Editor, go to `/me` afterwards (an `onDone` prop)
- [ ] 6-11 Implement `TrashItem.tsx` and `TrashList.tsx`: title, deleted date, "X days left" from `purgeAt`, Restore button with pending state; `TREE_NOT_IN_TRASH` / `TREE_NOT_FOUND` → toast and refresh
- [ ] 6-12 Implement `TrashPage` (P-09): list, paging, empty state ("Trash is empty"), note about the 10-day window
- [ ] 6-13 Unit tests: M-01 defaults the center idea to the title, M-02 disables visibility for removed trees, Trash shows the right days left, restore invalidates `['trees']` and `['trash']`

---

## Phase 7: Tree Canvas Core（ツリーキャンバス基盤） 【並列可】
- Depends on: Phase 2; Backend Phases 5, 8 (`GET /api/trees/:id`, `GET /api/trees/:id/nodes`)
- Main files: `frontend/src/api/{tree,nodeDetails}.ts`, `frontend/src/features/canvas/{TreeCanvas,NodeCard,NodeLink,MiniMap,ZoomControls,NodeCounter,layout,viewport,useZoom,useVisibleNodes,useNodeDetails}.ts(x)`, `frontend/src/features/nodes/MediaViewerModal.tsx` + tests (no overlap with other Phases)
- Screens: the shared canvas for P-05 and P-06, M-10
- APIs: `GET /api/trees/:id`, `GET /api/trees/:id/nodes?ids=`

- [ ] 7-1 Implement `frontend/src/api/tree.ts`: `useTree(id)` (`['tree', id]`, returns tree, owner, `isOwner`, skeleton nodes); `404` exposed as `notFound`
- [ ] 7-2 Implement `features/canvas/layout.ts`: build the hierarchy from the flat skeleton with `d3-hierarchy` (siblings by `sortOrder`), compute default positions, let saved positions override; return nodes and parent links. Pure function
- [ ] 7-3 Implement `features/canvas/useZoom.ts`: `d3-zoom` on the SVG for wheel, pinch and background drag; expose the transform plus `zoomIn`, `zoomOut`, `fitToScreen`, `centerOn(point)`; set `touch-action: none` on the canvas
- [ ] 7-4 Implement `features/canvas/viewport.ts` + `useVisibleNodes.ts`: nodes inside the visible area plus a margin, and the level of detail from the zoom (dot / short title / full card)
- [ ] 7-5 Implement `features/canvas/NodeLink.tsx`: the line from a node to its parent
- [ ] 7-6 Implement `features/canvas/NodeCard.tsx` part 1: the TEXT and LINK cards (title, first line of the note; thumbnail, page title, domain), a placeholder until details load, the larger highlighted center idea
- [ ] 7-7 `NodeCard.tsx` part 2: VIDEO (thumbnail with ▶) and IMAGE (`loading="lazy"`), dot and short-title forms when zoomed out, selected state, `data-testid="node-card"`
- [ ] 7-8 Implement `frontend/src/api/nodeDetails.ts` + `features/canvas/useNodeDetails.ts`: collect visible node IDs at readable zoom whose details aren't cached or whose `updatedAt` changed; fetch in batches of up to 100, throttled to a few requests per second while panning; cache per node ID (`['nodeDetails', treeId, id]`)
- [ ] 7-9 Implement `features/canvas/TreeCanvas.tsx`: SVG with the zoom transform, draws visible links and cards, emits `onNodeSelect`, `onNodeOpen` (double-click / double-tap) and pointer events for nodes and background, so the Editor can add dragging without editing this file
- [ ] 7-10 Implement `features/canvas/ZoomControls.tsx` (−, zoom %, +, Fit) and `NodeCounter.tsx` ("142 / 2000")
- [ ] 7-11 Implement `features/canvas/MiniMap.tsx`: whole-tree overview with the current viewport rectangle; click to jump there
- [ ] 7-12 Implement `features/nodes/MediaViewerModal.tsx` (M-10): full-size image or the YouTube/Vimeo embed from `videoEmbed`; close with `Esc` or the backdrop
- [ ] 7-13 Performance check: render a fake 2,000-node skeleton; panning and zooming stay smooth and only visible nodes are in the DOM
- [ ] 7-14 Unit tests: `layout` (one root, sibling order, saved positions win), `useVisibleNodes` culling, `useNodeDetails` batches at most 100 IDs and skips cached ones

---

## Phase 8: Tree Editor（ツリーエディタ） 【並列可】
- Depends on: Phase 6 (`TreeSettingsModal`, `MoveToTrashModal`, imported only), Phase 7 (canvas); Backend Phases 7, 8
- Main files: `frontend/src/pages/TreeEditorPage.tsx`, `frontend/src/api/{nodes,uploads,linkPreview}.ts`, `frontend/src/features/canvas/{EditorToolbar,NodeToolbar,SaveStatus,useNodeDrag,useLongPress,useAutoScroll,useEditorKeys,dropTarget}.ts(x)` (new files only), `frontend/src/features/nodes/{NodeEditorModal,AddBranchModal,DeleteNodeModal,LinkPreviewCard,ImageUploadField,TypeTabs}.tsx` + tests (no overlap with other Phases)
- Screens: P-05, M-04, M-05, M-06 (opens M-02, M-03, M-10)
- APIs: `GET /api/trees/:id`, `GET /api/trees/:id/nodes`, `POST /api/trees/:id/nodes`, `PATCH /api/nodes/:id`, `PATCH /api/trees/:id/nodes/positions`, `DELETE /api/nodes/:id`, `POST /api/uploads`, `POST /api/link-preview`, `PATCH /api/trees/:id`, `DELETE /api/trees/:id`

- [ ] 8-1 Implement `TreeEditorPage` (P-05) shell: load `useTree`; `404` → `<NotFound />`; `isOwner === false` → redirect to `/trees/:id`; lay out `EditorToolbar`, `TreeCanvas`, `MiniMap`, `ZoomControls`, `NodeCounter`
- [ ] 8-2 Implement `features/canvas/SaveStatus.tsx` ("Saving…" / "Saved ✓" / "Couldn't save – retry") driven by pending node mutations
- [ ] 8-3 Implement `features/canvas/EditorToolbar.tsx`: back to My Trees, title, visibility badge, category chips, `SaveStatus`, ⚙ (M-02, with "Move to Trash" → M-03 → `/me`), 👁 "View as visitor" → `/trees/:id`; removed trees show the admin's reason in a banner
- [ ] 8-4 Implement `features/canvas/NodeToolbar.tsx` above the selected node: "+ Add" (disabled at 2,000 with "This tree is full (2,000 ideas)"), "Edit", "Delete" (hidden on the root); buttons at least 44 × 44 px on phones
- [ ] 8-5 Implement `features/canvas/useEditorKeys.ts`: `Tab` → M-05, `Delete` → M-06 (not on the root), `Enter` → M-04, `Esc` → deselect; ignored while typing in an input
- [ ] 8-6 Implement `frontend/src/api/nodes.ts` part 1: `useCreateNode` (optimistic node with a temporary ID in `['tree', id]`, swap in the real one; on `409 NODE_LIMIT_REACHED` remove it and show "tree is full")
- [ ] 8-7 `api/nodes.ts` part 2: `useUpdateNode` and `useDeleteNode` (optimistic, rollback on error with a toast; delete removes the whole subtree from the skeleton), and `useSavePositions` (`standards/frontend.md` §2.5)
- [ ] 8-8 Implement `features/nodes/AddBranchModal.tsx` (M-05): type and title; creates the child next to its parent, then opens M-04 for the new node
- [ ] 8-9 Implement `features/nodes/DeleteNodeModal.tsx` (M-06): "Delete this idea and N ideas under it? This can't be undone." with N counted from the skeleton; `CANNOT_DELETE_ROOT` handled
- [ ] 8-10 Implement `features/nodes/TypeTabs.tsx` + `NodeEditorModal.tsx` (M-04) part 1: Text / Link / Video / Image tabs, title (1–200) and note (≤ 10,000, counter); switching type keeps title and note; save with `PATCH /api/nodes/:id`
- [ ] 8-11 Implement `frontend/src/api/linkPreview.ts` + `features/nodes/LinkPreviewCard.tsx`: URL field waits 500 ms after typing, then `POST /api/link-preview`; `422` → "No preview available" (save still allowed); `400 URL_NOT_ALLOWED` → error under the URL field; `429` → quiet retry later
- [ ] 8-12 M-04 Video tab: URL accepted only for YouTube/Vimeo (shared schema), embed preview from `videoEmbed`
- [ ] 8-13 Implement `frontend/src/api/uploads.ts` (upload with progress via `XMLHttpRequest`) + `features/nodes/ImageUploadField.tsx`: progress bar, `413` "Max 5 MB", `415` "PNG, JPEG, WebP or GIF only", `429` message; on save, `404 UPLOAD_NOT_FOUND` keeps the form and asks to upload again
- [ ] 8-14 Wire node actions in `TreeEditorPage`: select (click/tap), open M-04 (double-click/double-tap), open M-10 on image/video nodes at readable zoom, focus a new node after M-05
- [ ] 8-15 Implement `features/canvas/useLongPress.ts`: pointer down on a node starts a ~300 ms timer; moving first cancels it (so a quick swipe pans); on fire, lift the node and vibrate where supported. Mouse drags start immediately
- [ ] 8-16 Implement `features/canvas/useNodeDrag.ts`: move the node and its whole branch in local state only while dragging (smooth), using Pointer Events with pointer capture
- [ ] 8-17 Implement `features/canvas/useAutoScroll.ts`: pan the canvas while a dragged node is near the screen edge
- [ ] 8-18 On drop onto empty space: one `PATCH /api/trees/:id/nodes/positions` for every moved node; snap back and toast "Couldn't save the move" on error
- [ ] 8-19 Implement `features/canvas/dropTarget.ts` + re-parent on drop: highlight the node under the pointer; refuse the root as the dragged node and any target inside the dragged branch (no request, matches `409 INVALID_MOVE`); otherwise `PATCH /api/nodes/:id` with `parentId` and the new position; rollback on error
- [ ] 8-20 Phone check: on a phone viewport, long-press drag, pinch zoom, two-finger pan, double-tap edit, toolbar sizes and full-screen modals all work, and the page itself never scrolls or zooms while using the canvas
- [ ] 8-21 Unit tests: drop-target rules (own branch refused), optimistic create rollback on `NODE_LIMIT_REACHED`, M-04 type switch keeps title/note and clears the old type's fields, M-06 count, link preview debounce

---

## Phase 9: Explore & User Profile（Explore・ユーザープロフィール） 【並列可】
- Depends on: Phase 2; Backend Phases 4, 9
- Main files: `frontend/src/pages/{ExplorePage,UserProfilePage}.tsx`, `frontend/src/api/{explore,profile}.ts`, `frontend/src/features/explore/{ExploreSearch,CategoryChips,ExploreFeed}.tsx`, `frontend/src/features/explore/ProfileHeader.tsx` + tests (no overlap with other Phases)
- Screens: P-07, P-08
- APIs: `GET /api/explore`, `GET /api/explore/categories`, `GET /api/users/:username`

- [ ] 9-1 Implement `frontend/src/api/explore.ts`: `useExplore({ q, category, page })` and `useExploreCategories({ q, limit })`
- [ ] 9-2 Implement `ExploreSearch.tsx`: search box synced to `?q=` (trimmed, 1–100, submit on Enter or after typing stops), clear button
- [ ] 9-3 Implement `CategoryChips.tsx`: popular categories (`key`, `name`, `treeCount`), selected chip in `?category=`, horizontal scroll on phones
- [ ] 9-4 Implement `ExploreFeed.tsx` + `ExplorePage` (P-07): `TreeCard`s linking to `/trees/:id` and the owner's `/u/:username`, paging, loading / empty ("No public trees match") / error states
- [ ] 9-5 Implement `frontend/src/api/profile.ts` (`useUserProfile(username, page)`; `404` → `notFound`) and `ProfileHeader.tsx` (avatar with a fallback, display name, `@username`, join date)
- [ ] 9-6 Implement `UserProfilePage` (P-08): header, the user's public trees with paging, empty state; `404` → `<NotFound />`
- [ ] 9-7 Unit tests: search and chip state round-trip through the URL, profile `404` renders P-11

---

## Phase 10: Tree Viewer & Admin Removal（ツリービューア・管理者削除） 【並列可】
- Depends on: Phase 7 (canvas, M-10); Backend Phases 5, 8, 9
- Main files: `frontend/src/pages/TreeViewerPage.tsx`, `frontend/src/api/admin.ts`, `frontend/src/features/admin/RemoveTreeModal.tsx`, `frontend/src/features/explore/ViewerHeader.tsx` + tests (no overlap with other Phases)
- Screens: P-06, M-09 (opens M-10)
- APIs: `GET /api/trees/:id`, `GET /api/trees/:id/nodes`, `POST /api/admin/trees/:id/remove`

- [ ] 10-1 Implement `ViewerHeader.tsx`: title, owner (link to `/u/:username`), categories, description; "Edit" button for owners (`isOwner`); "Remove" button only for `ADMIN` on public trees
- [ ] 10-2 Implement `TreeViewerPage` (P-06): `useTree`; `404` → `<NotFound />`; read-only `TreeCanvas` with zoom, MiniMap and lazy details; image/video nodes open M-10; no editing gestures
- [ ] 10-3 Implement `frontend/src/api/admin.ts` (`useRemoveTree`, invalidates `['explore']`, the owner's profile and `['tree', id]`) and `RemoveTreeModal.tsx` (M-09): required reason (1–500), "Removes the tree from public view and makes it private."; `TREE_ALREADY_REMOVED` → toast; after success the viewer shows P-11
- [ ] 10-4 Unit tests: buttons per role (guest, owner, admin), M-09 requires a reason

---

## Phase 11: Integration & Final Checks（統合・最終確認） 【直列】
- Depends on: Phases 3–10; all backend Phases
- Main files: `frontend/tests/e2e/**`, `frontend-tasks.md`

- [ ] 11-1 E2E helpers in `frontend/tests/e2e/helpers.ts`: reset and seed the test data through the backend, `loginAs(page, email)`
- [ ] 11-2 E2E `auth.spec.ts`: sign up → `/me`; log in with `next`; logged-in user opening `/login` → `/me`; guest opening `/me` → `/login?next=`; log out
- [ ] 11-3 E2E `trees.spec.ts`: create a tree (M-01) → editor; edit details (M-02); move to Trash (M-03); restore from Trash (P-09)
- [ ] 11-4 E2E `editor.spec.ts` (desktop): add a branch (M-05 → M-04), edit a link node with a preview, drag a node and reload (position kept), re-parent, delete a branch (M-06)
- [ ] 11-5 E2E `editor-mobile.spec.ts` (phone project): long-press drag saves the position; a quick swipe on a node pans instead
- [ ] 11-6 E2E `explore.spec.ts`: Explore search and category chip; open a tree in the Viewer; open the owner's profile; a private tree URL shows P-11
- [ ] 11-7 E2E `admin.spec.ts`: admin removes a public tree (M-09) → gone from Explore; owner sees the "Removed by admin" badge and the disabled visibility switch
- [ ] 11-8 E2E `settings.spec.ts`: change the display name; change the password and log in with it; create, rename and delete a category; delete the account (M-11) → can't log in
- [ ] 11-9 Run `npm run lint`, `npm run typecheck -w frontend`, `npm test -w frontend`, `npm run test:e2e` and fix failures
- [ ] 11-10 Mobile layout pass at 375 px: every page and modal keeps the `px-4` side gutter for text, nothing scrolls sideways, modals are full-screen sheets (`standards/frontend.md` §2.4)
- [ ] 11-11 Accessibility pass: keyboard-only flow through header, forms and modals; focus returns after closing a modal; labels on every input; color contrast of category chips with white text
- [ ] 11-12 Coverage check: every page (P-01–P-11) and modal (M-01–M-11) in the manifest is reachable and matches its spec; list gaps here as new tasks
- [ ] 11-13 Review with `standards/review-checklist.md` (Frontend and Security sections)

---

## 並列実装サマリー（Parallel Implementation Summary）

| Phase | Type | Depends on | Backend Phases | Can run in parallel with | Reason (dependencies, shared files) |
|---|---|---|---|---|---|
| 1 Environment setup | 直列 | — | 1 (root files) | — | Creates `frontend/` and the toolchain |
| 2 Common foundation | 直列 | 1 | 3 | — | Creates every shared file: router with all routes, query keys, header, shared components, placeholder pages, `TreeCard` |
| 3 Landing & auth | 並列可 | 2 | 3 | 4, 5*, 6*, 7, 8*, 9, 10* | Own pages and `features/auth` form files only |
| 4 Categories | 並列可 | 2 | 6 | 3, 7, 9, 10* | Own `features/categories` files |
| 5 Settings & account | 並列可 | 2, 4 | 4 | 3, 6, 7, 9, 10 | Imports `CategoriesTab` (read only); own `features/settings` files |
| 6 My Trees & Trash | 並列可 | 2, 4 | 5, 6 | 3, 5, 7, 9, 10 | Imports `CategoryPicker` / M-07 (read only); own `features/trees` and `features/trash` files |
| 7 Canvas core | 並列可 | 2 | 5, 8 | 3, 4, 5, 6, 9 | Own `features/canvas` files and M-10 |
| 8 Tree Editor | 並列可 | 6, 7 | 7, 8 | 3, 4, 5, 9, 10 | Adds **new** files in `features/canvas` and `features/nodes`; imports Phase 6 modals and Phase 7 canvas without editing them |
| 9 Explore & profile | 並列可 | 2 | 4, 9 | 3, 4, 5, 6, 7, 8, 10 | Own `features/explore` files and pages |
| 10 Viewer & admin | 並列可 | 7 | 5, 8, 9 | 3, 4, 5, 6, 8, 9 | Own page, `features/admin`, `ViewerHeader` |
| 11 Integration | 直列 | 3–10 | all | — | E2E across every screen needs everything |

\* once its own dependencies are done.

Parallel Phases never edit the same file. Shared files (`router.tsx`, `App.tsx`, `api/client.ts`, `api/queryKeys.ts`, `api/invalidate.ts`, `components/**`, `lib/**`, `TreeCard`, `CategoryChip`, `VisibilityBadge`) are finished in Phase 2 and only imported afterwards. Each page file is created as a placeholder in Phase 2 and filled in by exactly one later Phase. If a screen Phase finds it needs a change to a shared file, stop and make that change as a separate serial task first.

### 推奨実行順序（Recommended Order）
1. Phase 1 → Phase 2 (serial)
2. Phase 3 / Phase 4 / Phase 7 / Phase 9 (parallel)
3. Phase 5 / Phase 6 (after Phase 4) and Phase 10 (after Phase 7), in parallel
4. Phase 8 (after Phases 6 and 7; the largest Phase, can overlap with anything still running)
5. Phase 11 (integration, serial)

---

**Coverage: all 11 pages (P-01–P-11) and all 11 modals (M-01–M-11) are covered**. Every screen operation maps to an endpoint in the manifest.

| Screen | Phase | Screen | Phase |
|---|---|---|---|
| P-01 Landing | 3 | M-01 New Tree | 6 |
| P-02 Sign up | 3 | M-02 Tree Settings | 6 |
| P-03 Log in | 3 | M-03 Move to Trash | 6 |
| P-04 My Trees | 6 | M-04 Node Editor | 8 |
| P-05 Tree Editor | 8 | M-05 Add Branch | 8 |
| P-06 Tree Viewer | 10 | M-06 Delete Node | 8 |
| P-07 Explore | 9 | M-07 Category Form | 4 |
| P-08 User Profile | 9 | M-08 Delete Category | 4 |
| P-09 Trash | 6 | M-09 Remove Tree | 10 |
| P-10 Settings | 5 | M-10 Media Viewer | 7 |
| P-11 Not Found | 2 | M-11 Delete Account | 5 |

**要確認 (to confirm):** none blocking. Every screen operation has a matching endpoint. The production hosting setup (manifest §7.4) still needs a decision before deployment; it doesn't affect these tasks because the frontend always calls `/api` on its own origin.

Totals: 11 Phases, 124 tasks.
