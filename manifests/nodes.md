# Nodes — Tree Editor Canvas, Nodes, Image Uploads and Link Previews

Shared types, error codes and authorization rules are defined in [common.md](./common.md). Start from [index.md](./index.md).

## 1. Overview

The Tree Editor canvas (lazy loading, drag, touch gestures), idea nodes of every type, image uploads and link previews. Related: [trees.md](./trees.md) (the tree a node belongs to, `GET /api/trees/:id` returns the node skeleton), [explore.md](./explore.md) (the read-only viewer uses the same canvas).

## 2. Functional Requirements

### 3.5 Idea Nodes & Canvas

- Add child nodes branching from any node. Every node except the root has exactly one parent; a tree has exactly one root.
- Node types: `TEXT` (raw thought), `LINK` (website), `VIDEO` (YouTube or Vimeo, embedded), `IMAGE` (uploaded image). Every node has a title (1–200 characters) and an optional note (up to 10,000 characters).
- A node's type can be changed at any time; title and note are kept, so text and links can be mixed freely.
- Drag nodes to reposition, or drop a node onto another node to move it there (re-parent) with its whole branch. Works with mouse on desktop and with touch on phones and tablets (long-press to pick up a node). The root can't be moved under another node, and no node can be moved under its own branch.
- Deleting a node deletes its whole branch, permanently, after a confirmation that shows how many ideas are affected. The root can't be deleted (delete the tree instead).
- A tree can have at most **2,000 nodes**.
- **Canvas loading (lazy, like lazy-loaded images):**
  1. The whole tree's skeleton (each node's id, parent, type, title and position) loads in one request, so the layout and connecting lines can be drawn at once.
  2. Only nodes inside the visible area (plus a margin) are drawn. Zoomed out, nodes are shown as dots or short titles; zoomed in, as full cards.
  3. Each node's heavy content (note text, link preview, thumbnail, uploaded image, video embed) is fetched in batches when the node comes into view at a readable zoom level, and cached. Images also use `loading="lazy"`.
- **Pages/modals:** P-05, P-06, M-04, M-05, M-06, M-10. **API:** `GET /api/trees/:id`, `GET /api/trees/:id/nodes`, `POST /api/trees/:id/nodes`, `PATCH /api/nodes/:id`, `PATCH /api/trees/:id/nodes/positions`, `DELETE /api/nodes/:id`. **Tables:** `nodes`.

### 3.6 Images & Link Previews

- `IMAGE` nodes use uploaded images: PNG, JPEG, WebP or GIF, up to 5 MB, checked from the file's content (no SVG). Stored on local disk (`backend/uploads/`) in development; cloud storage (S3) later. Max 60 uploads per user per hour.
- Uploaded images are served at public, unguessable URLs; anyone with an image's URL can view it.
- For `LINK` nodes, the **backend fetches a preview** (page title, description, thumbnail) when the link is saved and stores it on the node. The editor also shows a live preview while the user types (max 30 previews per user per minute; results cached for 10 minutes). The server never fetches private or internal addresses (SSRF protection).
- **Pages/modals:** M-04. **API:** `POST /api/uploads`, `POST /api/link-preview`, plus the node endpoints in §3.5. **Tables:** `uploads`, `nodes` (preview fields, `image_upload_id`).

## 3. Authorization

Shared rules (owner, `404` instead of `403`, what "public tree" means): see [common.md — Authorization Rules](./common.md#authorization-rules). Endpoint-specific conditions are in each cell.

| Endpoint | Guest | `USER` | `ADMIN` |
|---|---|---|---|
| `GET /api/trees/:id/nodes` | ✅ public trees | ✅ public trees; own trees | ✅ public trees; own trees |
| `POST /api/trees/:id/nodes` | ❌ | ✅ Owner, tree not in Trash | ✅ Owner, tree not in Trash |
| `PATCH /api/nodes/:id` | ❌ | ✅ Owner, tree not in Trash | ✅ Owner, tree not in Trash |
| `PATCH /api/trees/:id/nodes/positions` | ❌ | ✅ Owner, tree not in Trash | ✅ Owner, tree not in Trash |
| `DELETE /api/nodes/:id` | ❌ | ✅ Owner, tree not in Trash, not the root | ✅ Owner, tree not in Trash, not the root |
| `POST /api/uploads` | ❌ | ✅ | ✅ |
| `POST /api/link-preview` | ❌ | ✅ | ✅ |

## 4. Screens

### Pages

| ID | Screen | URL | Summary | Access |
|---|---|---|---|---|
| P-05 | Tree Editor | `/trees/:id/edit` | The canvas: add, edit, move, re-parent and delete idea nodes; pan and zoom; lazy loading. Tree settings in a modal | Owner (`USER`, `ADMIN`) |

### Modals

| ID | Modal | Trigger | Main functions |
|---|---|---|---|
| M-04 | Node Editor | Double-click a node, or "Edit" in the node's toolbar (P-05). Also opens right after adding a node | Type tabs (Text / Link / Video / Image), title, note, URL with live preview card (`POST /api/link-preview`), image upload with progress (`POST /api/uploads`). Switching type keeps title and note. Saves with `PATCH /api/nodes/:id` |
| M-05 | Add Branch | "+" button on a selected node's toolbar, or the `Tab` key on a selected node (P-05) | Pick a type and enter a title; creates the child node next to its parent (`POST /api/trees/:id/nodes`), then opens M-04 for the details. Disabled with "This tree is full (2,000 ideas)" at the limit |
| M-06 | Delete Node | "Delete" in the node toolbar, or the `Delete` key on a selected node (P-05). Not shown for the center idea | Confirm: "Delete this idea and N ideas under it? This can't be undone." N is counted from the loaded skeleton (`DELETE /api/nodes/:id`) |
| M-10 | Media Viewer | Click an image node or a video node at readable zoom, in the Editor (P-05) or Viewer (P-06) | Full-size image, or the embedded YouTube/Vimeo player. Close with `Esc` or the backdrop |

#### Main Screen Layout (Tree Editor, P-05)

```
+------------------------------------------------------------------------------+
| [AppHeader]  Highdea Tree   Explore   My Trees   Trash   Settings   (avatar) |
+------------------------------------------------------------------------------+
| [EditorToolbar]                                                              |
|  < My Trees | "Startup ideas" [PRIVATE] [#work][#side]  | Saved ✓ |  [⚙] [👁] |
+------------------------------------------------------------------------------+
| [TreeCanvas]  (SVG, pan = drag background, zoom = wheel / pinch)             |
|                                                                              |
|                       [NodeCard: LINK]                                       |
|                      /  ┌───────────────┐                                    |
|   [NodeCard: TEXT]--+   │ thumb │ title │                                    |
|   ┌────────────┐    |   └───────────────┘                                    |
|   │ "Pricing"  │    |                                                        |
|   └────────────┘    |      ╔═══════════════╗      [NodeCard: IMAGE]           |
|          \__________+------║  CENTER IDEA  ║------ ┌──────────┐              |
|                            ╚═══════════════╝       │  (img)   │              |
|                                   |                └──────────┘              |
|                                   |                                          |
|                     [NodeToolbar] [+ Add] [Edit] [Delete]   <- on selection  |
|                            [NodeCard: VIDEO] ▶                               |
|                                                                              |
|   · · ·  (far nodes drawn as dots when zoomed out)                           |
|                                                                              |
| [MiniMap]                                            [ZoomControls]          |
| ┌────────┐                                           [ - ] 80% [ + ] [Fit]   |
| │ ▢  ·:· │                                           [NodeCounter] 142/2000  |
| └────────┘                                                                   |
+------------------------------------------------------------------------------+
```

- **AppHeader:** shared navigation on every page.
- **EditorToolbar:** back link, tree title, visibility badge, category chips, save status ("Saving…" / "Saved ✓" / "Couldn't save – retry"), Tree Settings (⚙, opens M-02) and "View as visitor" (👁, opens the Tree Viewer).
- **TreeCanvas:** the SVG canvas. Nodes are laid out from `parentId` with `d3-hierarchy`, and saved positions override the layout. Lines connect each node to its parent. Only nodes in the visible area plus a margin are drawn.
- **NodeCard:** looks different per type: TEXT (title, first line of the note), LINK (thumbnail, page title, domain), VIDEO (thumbnail with ▶), IMAGE (image). Cards show placeholders until their details are lazy-loaded. Zoomed out, cards become short titles and then dots.
- **CENTER IDEA:** the root node, larger and highlighted. It can't be deleted or moved under another node.
- **NodeToolbar:** appears above the selected node: "+ Add" (M-05), "Edit" (M-04), "Delete" (M-06). Delete is hidden on the root.
- **MiniMap:** a whole-tree overview showing the current viewport. Click it to jump there.
- **ZoomControls / NodeCounter:** zoom out, zoom level, zoom in, fit to screen, and "142 / 2000" ideas used.

#### SPA UI/UX Points — canvas and nodes（SPAとしてのUI/UX設計ポイント）

- **Lazy-loaded canvas (§3.3):** the Editor and Viewer fetch the skeleton once (`GET /api/trees/:id`, TanStack Query key `['tree', id]`). As the viewport changes, the canvas collects visible node IDs whose details aren't cached (or whose `updatedAt` changed) and fetches them in batches of up to 100 (`GET /api/trees/:id/nodes?ids=`), at most a few requests per second while panning. Details are cached per node ID. Images also use `loading="lazy"`.
- **Drag moves save once, on drop:** while dragging a node or branch, positions update only in local state, so the drag stays smooth. On drop, one `PATCH /api/trees/:id/nodes/positions` request saves every moved node. Dropping onto another node re-parents it instead, with `PATCH /api/nodes/:id` (`parentId` plus the new position); a drop that would put a node under its own branch is refused in the UI before any request, matching `409 INVALID_MOVE`. If it fails, the nodes snap back and a toast says "Couldn't save the move".
- **Optimistic node edits with rollback:** adding a branch (M-05) shows the new node immediately with a temporary ID, then swaps in the real one. On `409 NODE_LIMIT_REACHED` the temporary node is removed and a "tree is full" message appears. Edits and deletes update the canvas first and roll back on error. The "Saving… / Saved ✓" indicator in the toolbar reflects pending requests.
- **Link preview while typing (M-04):** the URL field waits 500 ms after the user stops typing before calling `POST /api/link-preview`, which keeps normal use far under the 30-per-minute limit. `422 PREVIEW_UNAVAILABLE` shows "No preview available" without blocking the save, and `400 URL_NOT_ALLOWED` shows an error under the URL field.
- **Image uploads (M-04):** the upload shows progress, then the node is saved with the returned `imageUploadId`. If saving returns `404 UPLOAD_NOT_FOUND` (the cleanup job removed the image in between), the form keeps everything else and asks the user to upload the image again. `413` and `415` show "Max 5 MB" or "PNG, JPEG, WebP or GIF only" under the file field.
- **Full editing on phones, including drag:** every page works on phones, and the Editor supports the same editing as on desktop: adding, editing, dragging and re-parenting nodes. The canvas uses Pointer Events (one code path for mouse, touch and pen) with `touch-action: none`, so the browser doesn't scroll or zoom the page while the user works on the canvas. Touch gestures are kept from clashing like this:

  | Gesture | Desktop | Phone / tablet |
  |---|---|---|
  | Pan the canvas | Drag the background | One-finger drag on the background, or two-finger drag anywhere |
  | Zoom | Mouse wheel, `+`/`-` buttons | Pinch, `+`/`-` buttons |
  | Select a node | Click | Tap |
  | Edit a node (M-04) | Double-click | Double-tap |
  | Drag a node (with its branch) | Press and drag the node | **Long-press the node (about 300 ms) until it lifts**, then drag. The phone vibrates briefly where supported. A quick swipe that starts on a node still pans, so panning never grabs a node by accident |
  | Re-parent a node | Drop it onto another node (the target highlights) | Same: drop it onto another node |

  While dragging near the screen edge, the canvas scrolls automatically so a node can be carried across a large tree. Moves still save once, on drop (see the drag point above). On phones, the node toolbar buttons are at least 44 × 44 px, and modals open as full-screen sheets.

## 5. API

#### Nodes

---
##### **GET /api/trees/:id/nodes**

- **Summary（機能概要）:** Returns the heavy content of a batch of nodes. The canvas calls it as nodes come into view at a readable zoom level (lazy loading), and caches the results.
- **Authorization（認可）:** Same as `GET /api/trees/:id`: the owner, or anyone when the tree is `PUBLIC`, not removed, and the owner isn't deactivated. Login is optional.

**Request（リクエスト）**

- **Path Parameters**

| Name | Type | Description |
|---|---|---|
| `id` | `String` | Tree ID (cuid) |

- **Query Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `ids` | `String` | ✅ | Comma-separated node IDs, 1–100 per request. Duplicates are ignored |

**Response（レスポンス）**

- **Success: `200 OK`**
  Follows the common format `{ "data": {...} }`. `data.nodes` has one entry per requested node that belongs to this tree, with `id`, `body`, `url`, `previewTitle`, `previewDescription`, `previewImageUrl`, `imageUrl` and `updatedAt`. `imageUrl` is the public URL of the uploaded image for `IMAGE` nodes (built from `uploads.storage_key`) and `null` otherwise. IDs that don't exist or belong to another tree (e.g. a node deleted a moment ago) are left out instead of failing the whole batch.
- **Error Responses**
  Follows the common format `{ "error": { "code", "message" } }`.
  - `400` `VALIDATION_ERROR` — `ids` is missing or empty, or has more than 100 IDs.
  - `404` `TREE_NOT_FOUND` — The tree doesn't exist, is deleted, or the caller isn't allowed to see it.
  - `500` `INTERNAL_ERROR` — Unexpected server error.
---

---
##### **POST /api/trees/:id/nodes**

- **Summary（機能概要）:** Adds a new idea node branching from an existing node. Used by the Tree Editor.
- **Authorization（認可）:** The tree's owner only (`USER` or `ADMIN` who owns it). The owner can still add nodes to a tree an admin removed. Anyone else gets `404`. Trees in the Trash can't be edited.

**Request（リクエスト）**

- **Path Parameters**

| Name | Type | Description |
|---|---|---|
| `id` | `String` | Tree ID (cuid) |

- **Body**
  Required fields depend on `type`. Fields that don't apply to the type are rejected. Clients can't send the link preview fields; only the server sets them.

| Name | Type | Required | Description |
|---|---|---|---|
| `parentId` | `String` | ✅ | The node to branch from. Must be in this tree. A second root can't be created |
| `type` | `"TEXT" \| "LINK" \| "VIDEO" \| "IMAGE"` | ✅ | Node type |
| `title` | `String` | ✅ | Trimmed. 1–200 characters. For `TEXT` nodes, this is the thought itself |
| `body` | `String \| null` | | Longer note, allowed on any type. Up to 10,000 characters |
| `url` | `String` | `LINK`, `VIDEO` | `http` or `https`, up to 2,048 characters. For `VIDEO`: a YouTube or Vimeo URL |
| `imageUploadId` | `String` | `IMAGE` | ID of an image uploaded with `POST /api/uploads` by the same user |
| `positionX` | `Float` | | Canvas X position. Default `0`; the editor normally sends the position where the node was placed |
| `positionY` | `Float` | | Canvas Y position. Default `0` |
| `sortOrder` | `Int` | | Order among siblings. Default: after the parent's last child |

**Processing（処理）**

- The node count check and the insert run in one transaction that locks the tree row, so the 2,000-node limit can't be passed by two simultaneous requests. The tree's `updatedAt` is bumped in the same transaction.
- For `LINK` nodes, the server fetches the page's title, description and thumbnail and saves them in the preview fields. The fetch times out after 5 seconds; if it fails, the node is still created with the preview fields empty. To stop the server being used to reach internal addresses (SSRF), the fetch only goes to public `http`/`https` hosts: private, loopback and link-local IP addresses are refused, including after redirects.

**Response（レスポンス）**

- **Success: `201 Created`**
  Follows the common format `{ "data": {...} }`. `data.node` is the new node with both skeleton and detail fields: `id`, `parentId`, `type`, `title`, `body`, `url`, `previewTitle`, `previewDescription`, `previewImageUrl`, `imageUrl`, `positionX`, `positionY`, `sortOrder`, `createdAt`, `updatedAt`.
- **Error Responses**
  Follows the common format `{ "error": { "code", "message" } }`.
  - `400` `VALIDATION_ERROR` — A required field for the type is missing, a field doesn't apply to the type, or a rule above is broken (title length, body length, URL format, unsupported video site, preview fields sent).
  - `401` `UNAUTHENTICATED` — No valid auth cookie, or the user is deactivated (`deletedAt` set).
  - `404` `TREE_NOT_FOUND` — The tree doesn't exist, is in the Trash, or isn't owned by the caller.
  - `404` `PARENT_NOT_FOUND` — `parentId` doesn't exist or belongs to another tree.
  - `404` `UPLOAD_NOT_FOUND` — `imageUploadId` doesn't exist or was uploaded by another user.
  - `409` `NODE_LIMIT_REACHED` — The tree already has 2,000 nodes.
  - `500` `INTERNAL_ERROR` — Unexpected server error. The transaction is rolled back.
---

---
##### **PATCH /api/nodes/:id**

- **Summary（機能概要）:** Edits a node: its content, its position on the canvas, its order among siblings, or its parent (moving the node and its whole subtree to another branch). Used by the Tree Editor.
- **Authorization（認可）:** The owner of the node's tree only (`USER` or `ADMIN` who owns it). The owner can still edit nodes in a tree an admin removed. Anyone else gets `404`. Nodes in a tree in the Trash can't be edited.

**Request（リクエスト）**

- **Path Parameters**

| Name | Type | Description |
|---|---|---|
| `id` | `String` | Node ID (cuid) |

- **Body**
  Send only the fields to change; at least one is required. `type` can be changed freely between `TEXT`, `LINK`, `VIDEO` and `IMAGE` (see Processing). Fields that don't apply to the node's resulting type, and the link preview fields, are rejected.

| Name | Type | Required | Description |
|---|---|---|---|
| `type` | `"TEXT" \| "LINK" \| "VIDEO" \| "IMAGE"` | | Changes the node's type. The fields the new type requires must be sent in the same request (`url` for `LINK`/`VIDEO`, `imageUploadId` for `IMAGE`) |
| `title` | `String` | | Trimmed. 1–200 characters |
| `body` | `String \| null` | | Up to 10,000 characters. `null` clears it |
| `url` | `String` | | `LINK` and `VIDEO` only. Same rules as when creating. Changing a `LINK` URL fetches a new preview |
| `imageUploadId` | `String` | | `IMAGE` only. Replaces the image with another upload by the same user |
| `parentId` | `String` | | Moves the node, with its whole subtree, under another node in the same tree. Not allowed on the root |
| `positionX` | `Float` | | Canvas X position |
| `positionY` | `Float` | | Canvas Y position |
| `sortOrder` | `Int` | | Order among siblings |

**Processing（処理）**

- When `type` changes, `title` and `body` are kept, so text and links can be mixed freely in one tree. Fields that don't apply to the new type are cleared: `url` and the preview fields when leaving `LINK`/`VIDEO`, `imageUploadId` when leaving `IMAGE` (the image file is removed later by the uploads cleanup job). Changing to `LINK` fetches a preview for the new URL.
- When `parentId` changes, the server walks up from the new parent to the root. If it meets the node being moved, the move would put the node under itself, so it's refused.
- The update and the bump of the tree's `updatedAt` run in one transaction.
- A new `LINK` URL is fetched the same way as in `POST /api/trees/:id/nodes`: 5-second timeout, public hosts only (SSRF protection), and the update still succeeds with empty preview fields if the fetch fails.
- **Which endpoint saves positions:** drag moves (one node or a whole branch) use `PATCH /api/trees/:id/nodes/positions`. This endpoint is for content, type and parent; its `positionX`, `positionY` and `sortOrder` fields are only used together with a `parentId` change, so re-parenting and the node's new position are saved in one request.

**Response（レスポンス）**

- **Success: `200 OK`**
  Follows the common format `{ "data": {...} }`. `data.node` is the updated node with both skeleton and detail fields: `id`, `parentId`, `type`, `title`, `body`, `url`, `previewTitle`, `previewDescription`, `previewImageUrl`, `imageUrl`, `positionX`, `positionY`, `sortOrder`, `createdAt`, `updatedAt`.
- **Error Responses**
  Follows the common format `{ "error": { "code", "message" } }`.
  - `400` `VALIDATION_ERROR` — The body is empty, includes preview fields, has a field that doesn't apply to the node's resulting type, changes `type` without the fields the new type requires, or breaks a rule above (lengths, URL format, unsupported video site).
  - `401` `UNAUTHENTICATED` — No valid auth cookie, or the user is deactivated (`deletedAt` set).
  - `404` `NODE_NOT_FOUND` — The node doesn't exist, its tree is in the Trash, or the caller doesn't own the tree.
  - `404` `PARENT_NOT_FOUND` — The new `parentId` doesn't exist or belongs to another tree.
  - `404` `UPLOAD_NOT_FOUND` — `imageUploadId` doesn't exist or was uploaded by another user.
  - `409` `INVALID_MOVE` — The move isn't allowed: the node is the root, or the new parent is the node itself or one of its descendants.
  - `500` `INTERNAL_ERROR` — Unexpected server error. The transaction is rolled back.
---

---
##### **PATCH /api/trees/:id/nodes/positions**

- **Summary（機能概要）:** Saves the positions (and optionally sibling order) of one or more nodes in one request. The Tree Editor uses it for every drag move (one node or a whole branch) and after an auto-layout. `PATCH /api/nodes/:id` sets positions only when re-parenting a node.
- **Authorization（認可）:** The tree's owner only (`USER` or `ADMIN` who owns it). The owner can still do this in a tree an admin removed. Anyone else gets `404`. Trees in the Trash can't be edited.

**Request（リクエスト）**

- **Path Parameters**

| Name | Type | Description |
|---|---|---|
| `id` | `String` | Tree ID (cuid) |

- **Body**

| Name | Type | Required | Description |
|---|---|---|---|
| `nodes` | `Array` | ✅ | 1–2,000 items (the per-tree node limit). Each node ID may appear only once |
| `nodes[].id` | `String` | ✅ | Node ID. Must belong to this tree |
| `nodes[].positionX` | `Float` | ✅ | New canvas X position |
| `nodes[].positionY` | `Float` | ✅ | New canvas Y position |
| `nodes[].sortOrder` | `Int` | | New order among siblings |

Only positions and order can be changed here. Content, type and parent are changed with `PATCH /api/nodes/:id`.

**Processing（処理）**

- All updates run in one transaction: either every node is saved or none is. The tree's `updatedAt` is bumped in the same transaction.

**Response（レスポンス）**

- **Success: `200 OK`**
  Follows the common format `{ "data": {...} }`. `data.nodes` lists each updated node with `id`, `positionX`, `positionY`, `sortOrder` and `updatedAt`.
- **Error Responses**
  Follows the common format `{ "error": { "code", "message" } }`.
  - `400` `VALIDATION_ERROR` — `nodes` is missing, empty, or has more than 2,000 items; an ID appears twice; a position isn't a number; or an item has a field other than the ones above.
  - `401` `UNAUTHENTICATED` — No valid auth cookie, or the user is deactivated (`deletedAt` set).
  - `404` `TREE_NOT_FOUND` — The tree doesn't exist, is in the Trash, or isn't owned by the caller.
  - `404` `NODE_NOT_FOUND` — At least one node ID doesn't exist or belongs to another tree. Nothing is saved.
  - `500` `INTERNAL_ERROR` — Unexpected server error. The transaction is rolled back.
---

---
##### **DELETE /api/nodes/:id**

- **Summary（機能概要）:** Permanently deletes a node and its whole subtree (every branch under it). The editor asks for confirmation first, showing how many ideas will be deleted. Nodes don't go to the Trash; only whole trees do.
- **Authorization（認可）:** The owner of the node's tree only (`USER` or `ADMIN` who owns it). The owner can still do this in a tree an admin removed. Anyone else gets `404`. Nodes in a tree in the Trash can't be deleted.

**Request（リクエスト）**

- **Path Parameters**

| Name | Type | Description |
|---|---|---|
| `id` | `String` | Node ID (cuid) |

**Processing（処理）**

- The node is deleted, and the DB deletes its descendants with it (`ON DELETE CASCADE` on `parent_id`). The IDs of all deleted nodes are collected first, and the delete and the bump of the tree's `updatedAt` run in one transaction.
- Images used by deleted `IMAGE` nodes aren't deleted here; the uploads cleanup job removes them once nothing uses them.

**Response（レスポンス）**

- **Success: `200 OK`**
  Follows the common format `{ "data": {...} }`. `data.deletedNodeIds` lists the IDs of the node and all its descendants, so the editor can drop them from the canvas and its cache.
- **Error Responses**
  Follows the common format `{ "error": { "code", "message" } }`.
  - `401` `UNAUTHENTICATED` — No valid auth cookie, or the user is deactivated (`deletedAt` set).
  - `404` `NODE_NOT_FOUND` — The node doesn't exist (or was already deleted), its tree is in the Trash, or the caller doesn't own the tree.
  - `409` `CANNOT_DELETE_ROOT` — The node is the root (center idea). To remove it, delete the whole tree instead.
  - `500` `INTERNAL_ERROR` — Unexpected server error. The transaction is rolled back.
---

#### Uploads

---
##### **POST /api/uploads**

- **Summary（機能概要）:** Uploads one image file and returns its ID. The editor then uses the ID as `imageUploadId` when creating or editing an `IMAGE` node. Files are stored in `backend/uploads/` in development (S3 later).
- **Authorization（認可）:** Logged-in users (`USER`, `ADMIN`). The upload is owned by the logged-in user, and only that user can attach it to a node.

**Request（リクエスト）**

- **Body** (`multipart/form-data`)

| Name | Type | Required | Description |
|---|---|---|---|
| `file` | `File` | ✅ | Exactly one image. Allowed formats: PNG, JPEG, WebP, GIF. Max 5 MB |

**Processing（処理）**

- The file type is checked from the file's actual content (its first bytes), not only from the file name or the `Content-Type` the browser sent. SVG isn't allowed, because an SVG file can contain scripts.
- The server generates the stored file name, `storage_key`: a cryptographically random value (`crypto.randomUUID()`, 122 random bits) plus the extension of the detected type, e.g. `3f2b…-….png`. A cuid isn't used here because cuid v1 is partly predictable. The original file name is saved only as data and never used as a path.
- Uploaded files are served at `/uploads/:storageKey` with the detected `Content-Type` and `X-Content-Type-Options: nosniff`. These URLs are public: anyone who has an image's URL can view it, including images in private trees. The random `storage_key` makes the URLs impossible to guess. An access-checked route (e.g. `GET /api/uploads/:id/file`) can be added when storage moves to S3.
- An upload that no node uses is removed by the daily uploads cleanup job, with no grace period. If that happens between uploading and saving the node, the node save returns `404 UPLOAD_NOT_FOUND` and the editor asks the user to upload the image again.

**Response（レスポンス）**

- **Success: `201 Created`**
  Follows the common format `{ "data": {...} }`. `data.upload`: `id`, `url` (public URL of the image), `originalName`, `mimeType`, `sizeBytes`, `createdAt`.
- **Error Responses**
  Follows the common format `{ "error": { "code", "message" } }`.
  - `400` `VALIDATION_ERROR` — No file was sent, more than one file was sent, or the request isn't `multipart/form-data`.
  - `401` `UNAUTHENTICATED` — No valid auth cookie, or the user is deactivated (`deletedAt` set).
  - `413` `FILE_TOO_LARGE` — The file is larger than 5 MB.
  - `415` `UNSUPPORTED_FILE_TYPE` — The file isn't a PNG, JPEG, WebP or GIF image (checked from its content).
  - `429` `RATE_LIMITED` — More than 60 uploads from the same user within 1 hour. Stops one user from filling the server's disk before the daily cleanup job runs.
  - `500` `INTERNAL_ERROR` — Unexpected server error. If the file was written but saving the record failed, the file is deleted.
---

#### Link preview

---
##### **POST /api/link-preview**

- **Summary（機能概要）:** Fetches a web page and returns its title, description and thumbnail, so the editor can show a preview card while the user is adding a link, before the node is saved. Nothing is stored. When the `LINK` node is saved, the server fetches the preview itself (see `POST /api/trees/:id/nodes`); clients can't send preview fields.
- **Authorization（認可）:** Logged-in users (`USER`, `ADMIN`). Guests can't use it, so it can't be used anonymously to make the server fetch pages.

**Request（リクエスト）**

- **Body**

| Name | Type | Required | Description |
|---|---|---|---|
| `url` | `String` | ✅ | `http` or `https` URL, up to 2,048 characters |

**Processing（処理）**

- **SSRF protection:** the server resolves the host name and refuses private, loopback and link-local IP addresses (e.g. `10.x`, `192.168.x`, `127.0.0.1`, `169.254.x`, `::1`). It checks again after every redirect, follows at most 3 redirects, and only uses ports 80 and 443.
- **Limits:** the whole fetch times out after 5 seconds, and at most 1 MB of the response is read. Only `text/html` responses are parsed.
- **What is read:** `og:title`, `og:description` and `og:image` (Open Graph tags), falling back to `<title>` and `<meta name="description">`. A relative `og:image` is turned into a full URL.
- **Cache:** results are kept in memory for 10 minutes per URL, so saving the node right after previewing doesn't fetch the page a second time.

**Response（レスポンス）**

- **Success: `200 OK`**
  Follows the common format `{ "data": {...} }`. `data.preview`: `url` (the final URL after redirects), `title`, `description`, `imageUrl`. Any of `title`, `description` and `imageUrl` can be `null` if the page doesn't have it.
- **Error Responses**
  Follows the common format `{ "error": { "code", "message" } }`.
  - `400` `VALIDATION_ERROR` — `url` is missing, too long, or not an `http`/`https` URL.
  - `400` `URL_NOT_ALLOWED` — The URL points to a private or internal address, or uses a port other than 80/443 (directly or after a redirect).
  - `401` `UNAUTHENTICATED` — No valid auth cookie, or the user is deactivated (`deletedAt` set).
  - `422` `PREVIEW_UNAVAILABLE` — The page couldn't be fetched or read: timeout, error status, too many redirects, or not an HTML page. The editor can still save the link without a preview.
  - `429` `RATE_LIMITED` — More than 30 preview requests from the same user within 1 minute. The editor waits until the user stops typing before requesting a preview, so normal use stays far below this.
  - `500` `INTERNAL_ERROR` — Unexpected server error.
---

## 6. Data

Full Prisma schema, ER diagram and deletion policy: [common.md — Data Modeling](./common.md#5-data-modelingデータモデリング).

#### nodes（アイデアノード）

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PK, DEFAULT cuid() | Node ID |
| tree_id | TEXT | NOT NULL, FK→trees.id | The tree it belongs to |
| parent_id | TEXT | NULL, FK→nodes.id | Parent node. NULL means the root (center idea) |
| type | NodeType | NOT NULL, DEFAULT 'TEXT' | `TEXT` / `LINK` / `VIDEO` / `IMAGE` |
| title | VARCHAR(200) | NOT NULL | The idea in short. For `TEXT` nodes this is the thought itself |
| body | TEXT | NULL | Longer note, allowed on any type |
| url | TEXT | NULL | Required for `LINK` and `VIDEO` |
| preview_title | VARCHAR(300) | NULL | `LINK` only: page title fetched by the server |
| preview_description | VARCHAR(1000) | NULL | `LINK` only: page description fetched by the server |
| preview_image_url | TEXT | NULL | `LINK` only: thumbnail URL fetched by the server |
| preview_fetched_at | TIMESTAMPTZ(3) | NULL | When the preview was last fetched |
| image_upload_id | TEXT | NULL, FK→uploads.id | Required for `IMAGE` |
| position_x | DOUBLE PRECISION | NOT NULL, DEFAULT 0 | Canvas X position |
| position_y | DOUBLE PRECISION | NOT NULL, DEFAULT 0 | Canvas Y position |
| sort_order | INTEGER | NOT NULL, DEFAULT 0 | Order among siblings, used by the d3-hierarchy layout |
| created_at | TIMESTAMPTZ(3) | NOT NULL, DEFAULT now() | Created at |
| updated_at | TIMESTAMPTZ(3) | NOT NULL | Updated at |

**Business rules and constraints**
- Each tree has exactly one root node (`parent_id IS NULL`). Enforced in the **app layer**: TreeService creates it with the tree, and NodeService rejects creating another root or deleting the root. Also enforced in the **DB** by a partial unique index added with raw SQL in the first migration (Prisma can't express partial indexes): `CREATE UNIQUE INDEX nodes_one_root_per_tree ON nodes(tree_id) WHERE parent_id IS NULL;`
- A node's parent must belong to the same tree. Enforced in the **app layer** (NodeService).
- A node can't be moved under itself or under one of its own descendants. Enforced in the **app layer** (NodeService walks up the ancestors when `parentId` changes). Moving a node (with its subtree) to another parent in the same tree is allowed; the root can't be moved.
- A node's `type` can be changed. `title` and `body` are kept; fields that don't apply to the new type are cleared in the same update. Enforced in the **app layer** (NodeService).
- Required fields depend on the type. Enforced in the **app layer** (a Zod discriminated union on `type`):
  - `TEXT`: `title` only.
  - `LINK`: `url` (http/https).
  - `VIDEO`: `url` from an allowed provider (YouTube or Vimeo).
  - `IMAGE`: `image_upload_id`, pointing to an upload owned by the same user.
- Preview fields are set only by the server after it fetches the link (`POST /api/link-preview` or when a `LINK` node is saved). Clients can't write them directly. Enforced in the **app layer**.
- Deleting a node deletes its whole subtree. Enforced in the **DB** (self-FK `ON DELETE CASCADE`); the UI asks for confirmation first.
- A tree can have at most 2,000 nodes. Enforced in the **app layer**: NodeService counts the tree's nodes and inserts the new one in the same transaction, locking the tree row (`SELECT ... FOR UPDATE`) so two simultaneous adds can't go over the limit.

#### uploads（アップロード画像）

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PK, DEFAULT cuid() | Upload ID |
| owner_id | TEXT | NOT NULL, FK→users.id | Uploader |
| storage_key | VARCHAR(255) | NOT NULL, UNIQUE | Relative path in `backend/uploads/` (an S3 key later) |
| original_name | VARCHAR(255) | NOT NULL | Original file name |
| mime_type | VARCHAR(100) | NOT NULL | e.g. `image/png` |
| size_bytes | INTEGER | NOT NULL | File size |
| created_at | TIMESTAMPTZ(3) | NOT NULL, DEFAULT now() | Uploaded at |

**Business rules and constraints**
- Only image MIME types are accepted, up to a size limit. Enforced in the **app layer** (Multer limits plus a content check). Allowed formats: PNG, JPEG, WebP, GIF. Maximum size: 5 MB.
- The server generates `storage_key` from a cryptographically random value (`crypto.randomUUID()`) plus the file extension, because upload URLs are public and must not be guessable (cuid v1 is partly predictable). The client's file name is never used as a path. Enforced in the **app layer** (UploadService).
- An upload can't be deleted while a node still uses it. Enforced in the **DB** (FK `ON DELETE RESTRICT`).
- Uploads not used by any node are deleted by a daily cleanup job, with no grace period: any upload with no node pointing to it is deleted, however new it is. Enforced in the **app layer** (a scheduled job, run at a low-traffic time). If the job deletes an image between upload and node save, the node save fails with `404 UPLOAD_NOT_FOUND` and the editor asks the user to upload it again.
