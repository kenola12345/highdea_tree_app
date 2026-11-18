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
- **Line colors per branch:** any idea can have a line color. The line into that idea and every line below it use the color, until a sub-branch sets its own. Ideas without a color use the nearest ancestor's color, or gray if none has one. The center idea's color therefore sets the default for the whole tree. Set in M-04, or in the Editor by clicking (or tapping) the line itself: the line is selected (thicker, with a soft yellow halo) and a small toolbar at its middle has a color swatch and "Inherit" (shown only when the idea has its own color). The color is saved on the idea the line goes into (`PATCH /api/nodes/:id` with `lineColor`). `Esc` or clicking the background deselects the line.
- **Line labels:** any parent → child line can have a short label (up to 50 characters, e.g. "because", "leads to"), stored on the child idea. It is drawn as a small pill at the middle of the line, in the line's color, in the Editor and the Tree Viewer. Set it from the branch line toolbar (Branch lines); clearing the field removes it. Can be undone.
- **Idea kinds (visual hierarchy):** any idea except the center idea can be given a **kind**, so important ideas stand out and the rest recede: **Core** (key concept: larger, heavier title, a stronger accent border and a soft accent halo around the card), **Supporting** (detail: softer card, lighter title, a light accent border and a faint halo), **Important** (something to remember: an accent bar, tint, accent border and halo), **Example** (worked example: the note is monospace, with a dashed border), **Question** (to review: a "?" badge and accent). Halos are translucent rings outside the card, strongest on the center idea, then Core, Important and Supporting. Ideas without a kind look like plain cards. Each kind shows a small label at the top of the card. The kind's look comes from the tree's node style preset (see Node style presets); the idea's own card and text colors still override it. Set in M-04.
- **Sections in the note:** a note can optionally be split into labeled sections by starting a line with `What:`, `Why:`, `Example:`, `Remember:`, `Mistakes:` or `Note:` (case doesn't matter). Cards and the details view show each section with a small label and a divider between sections. Text between ` ``` ` lines is shown as a monospace code block. Notes without these markers show as plain text.
- **Expandable cards:** a card that fits its content shows short notes in full. When the note is long (more than about 6 lines at the card's width), the card shows a compact preview with **Show more**; pressing it expands the card to the whole note with its sections and code (up to about 30 lines), and **Show less** collapses it again. Whether a card is expanded is kept only for the current visit (not saved). Cards the owner resized keep their size and don't show the toggle.
- **Center idea and parent ideas:** the center idea is drawn larger (at least 280 × 110), with a heavier, larger title, a thicker border and a translucent halo made from its own card color (so they match whatever color it has), the preset's center color and its note shown as a short description under the title. Ideas that have children get a slightly heavier title than leaf ideas, so the structure reads at a glance without making every card prominent.
- **Node style presets (per tree):** the owner picks how cards look for the whole tree: **Minimal** (clean and neutral: white cards, the default), **Midnight** (dark and technical: slate cards with light text), **Organic** (natural: soft sage cards with deep green text) or **Editorial** (warm and structured: white cards with warm brown text and serif titles). A preset sets the default card, text, border, center idea and kind accent colors. It doesn't touch the canvas (background and grid stay as the owner set them), and every card keeps an opaque background and border so it stays readable on any canvas. Set in the Canvas panel's **Nodes** section; undoable.
- **Card colors:** any idea, including the center idea, can have its own card color. It isn't inherited. Ideas without one are white, and the center idea defaults to the dark green (`#1C3A2A`). Text on a colored card switches between dark and white for contrast. Set in M-04; "Default" removes it.
- **Card shape and size:** any idea, including the center idea, can have its own shape and size. Shapes: **Rounded** (default, rounded corners), **Square** (square corners), **Pill** (fully rounded ends) and **Circle** (a circle when width equals height, otherwise an oval). Size: width 60–800 and height 40–600 (canvas units, whole numbers); **without a size the card fits its content** so it's readable: it measures the title, the note and any image, video or link preview and grows to show them (wider for long notes, up to 300 wide; images, videos and link previews with a picture are shown as a picture across the top; at most about 10 note lines, the rest ends with "…"; never smaller than 200 × 84, the center idea 240 × 96). It updates when the details load or change. Resizing gives the card a fixed size, which can be smaller (or larger) than the fitted one; text and picture then shrink to fit, with "…". Set the shape and size in M-04 ("Auto" clears the size, so the card fits its content again), or in the Editor by dragging one of the four corner handles of the selected card: the opposite corner stays in place, holding `Shift` keeps the proportions, and the new size (`PATCH /api/nodes/:id`) and position (`PATCH /api/trees/:id/nodes/positions`) are saved once on release. Lines meet each card at the middle of its facing edge whatever its shape. On pills and circles the inner padding follows the curve (it grows with the size of the rounded ends), so text never runs into the rounded edges; fitted pills and circles are made larger by that padding. The title shows as many lines as fit the card. Visitors see the same shapes and sizes.
- **Text size and color:** any idea can have its own **text size** (10–28 px for the note, the title is 2 px larger and bold; the center idea's title 3 px larger; default 13 px) and **text color** (`#RRGGBB`; default "Auto": dark or white, whichever contrasts with the card). The note is shown at 85 % strength under the title so they read as heading and body. Set in M-04. Visitors see the same.
- **Add menu and canvas items (free-form editing):** the Editor's **+ Add** button (above the zoom controls) opens a menu of things to place on the canvas. After picking one, a banner says "Click on the canvas to place it" (boxes: "Click, or drag to draw the box"), with Cancel; `Esc` cancels.
  - **Ideas:** Text, Link, Video or Image. Clicking places the new idea there: M-05 opens with that type chosen, and the idea is created at that spot under the center idea (drag it onto another idea to re-parent it). M-04 then opens for the details, as usual.
  - **Canvas items** (not ideas; stored in `node_groups` with a `kind`; up to **100** per tree):
    - **Box:** a rounded frame with an optional color and an optional **label** (a small tag at its top-left corner, shown only when set; up to 100 characters, kept in `body`), to group ideas into sections. Click for a 360 × 240 box or drag to draw it. An idea is *in* a box when its center is inside it, so dragging an idea into or out of a box adds or removes it, and boxes can sit inside bigger boxes (subsections). The whole box can be grabbed: clicking anywhere on it (outside the ideas and lines drawn on top) selects it, and dragging it moves the box with every idea and box inside it, saved once on release. Ideas and lines inside stay clickable as usual; to pan, drag the canvas outside the box.
    - **Sticky note:** a colored note (default soft yellow `#FDE68A`) with free text (up to 2,000 characters), for comments and reminders. Default 220 × 160.
    - **Text label:** large free text with no frame (the item's title, up to 100 characters), for headings and annotations on the canvas. Default 280 × 60.
  - **Editing items:** click anywhere on a box, note or label to select it. A toolbar above it has its text (a "Label" field for boxes — empty removes the label —, a title field for labels, a text area for notes), a color swatch with "Default" and Delete; corner handles resize it (at least 160 × 100 for boxes, 120 × 48 for notes and labels). Notes and labels are moved by dragging them; they don't carry ideas. `Delete` removes the selected item and `Esc` deselects it. Deleting an item never changes any idea.
  - Visitors see items in the Tree Viewer (not editable). Placing, moving, resizing, recoloring, editing and deleting items can be undone. "Tidy up" refits each box around the ideas that were in it (notes and labels stay where they are).
- **Tidy up (Editor):** the "Tidy up" button above the zoom controls lays out the whole tree again so no cards overlap, using each card's real size (fitted or resized). The center idea stays where it is; its branches are split, keeping their order, to the right and left like a mind map, at the point where both sides are about equally tall, each level placed past the widest card of the level before, and siblings spaced by their heights. All positions are saved in one `PATCH /api/trees/:id/nodes/positions` request, it's one undo step ("Tidy up"), and the view then fits the tree.
- **Undo and redo (Editor):** like Photoshop, every change made in the Editor can be undone and redone, many steps deep: adding, editing (M-04), moving, re-parenting, resizing and deleting ideas (a deleted branch comes back with its ideas, notes, links, images and connections), connecting, removing and recoloring connections, branch line colors and the canvas look. `⌘Z` / `Ctrl+Z` undoes, `⇧⌘Z` / `Ctrl+Shift+Z` / `Ctrl+Y` redoes (not while typing in a field or with a modal open). The EditorToolbar has ↶ / ↷ buttons whose tooltips name the step ("Undo Move idea"), and a **History** list of the steps; clicking a step undoes or redoes everything up to it. A new change after undoing clears the redo steps. History is kept in the browser for the current Editor session only (up to 100 steps), not saved; leaving the Editor clears it. An undo is just another change sent to the API (so other tabs and visitors see it); a restored idea or connection gets a new ID. If an undo can't be applied (for example the idea was deleted elsewhere), a toast says so and the step stays.
- **Canvas look (per tree):** the owner can change the canvas background of each tree: grid **style** (Lines, the default notebook grid; Dots; or None), grid **color** (default soft sage `#D3E0D5`), grid **opacity** (0–100 %, default 100 %), grid **spacing** (12–64, default 24 canvas units between lines or dots) and **background color** (default `#F6F9F5`). Set in the Editor with the "Canvas" button above the zoom controls, which opens a small panel; changes show at once and are saved shortly after the last change (`PATCH /api/trees/:id/canvas`), with "Reset" back to the defaults. Visitors see the same canvas look in the Tree Viewer.
- **Choosing colors:** line colors, card colors, connection colors, grid and background colors, and category colors are chosen with a color picker (any `#RRGGBB`) plus a hex field, not from a fixed palette.
- **Line style:** branch lines (parent → child) are calm solid S-shaped curves that meet each card at the middle of its facing edge (no end markers), drawn on a grid (by default a light notebook-style grid, see Canvas look) that pans and zooms with the canvas. Connections are drawn by their relationship type (see Connections).
- **Connections between ideas:** besides its parent → child branches, any two ideas in the same tree can be **connected**, for example two ideas in different branches that relate to each other. A connection is drawn as a thin dotted line (gray by default, or the color the owner picked), so it isn't mistaken for a branch, and it doesn't change the layout or the hierarchy. It has no direction. An idea can have any number of connections, and a tree up to **500**. Two ideas can be connected only once, an idea can't be connected to itself, and an idea can't be connected to its own parent or child (that line already exists). Connections are deleted with either of their ideas or with the tree. Visitors see them in the Tree Viewer too.
  - **Connect:** select an idea, press "Connect" in its toolbar, then click (or tap) the other idea. A banner says "Click another idea to connect it to “{title}”" with a Cancel button; `Esc` or clicking the background cancels.
  - **Remove:** click (or tap) a connection line in the Editor to select it, then press "Remove connection" in the small toolbar that appears. No confirmation (it's easy to redo).
  - **Relationship type:** each connection has a type, chosen in the same toolbar: **Related** (subtle dotted line, the default), **Sequence** (solid line with an arrow: one step leads to the next), **Depends on** (dashed line with an arrow: one idea needs the other) and **Contrast** (dash-dot line with a small "vs" mark: ideas that differ). Sequence and Depends on have a direction; a new one points from the idea you started connecting from, and **Swap direction** turns it around. 
  - **Focus on selection:** selecting an idea (in the Editor or the Viewer) highlights it, its parent, its children and the ideas it's connected to, with their lines, and dims the rest of the map until the selection is cleared.
  - **Color:** the same toolbar has a color swatch that opens the color picker (any `#RRGGBB`, see Choosing colors). The line changes color at once and is saved when the picker settles; "Default" (shown only when a color is set) returns it to gray. Each connection has its own color; it isn't inherited.
- **Opening links:** a `LINK` node's card has an "Open link" icon, the editor's node toolbar has "Open link", and the details view (M-12) has an "Open link" button. Links open in a new tab and only `http`/`https` URLs are opened.
- **Canvas loading (lazy, like lazy-loaded images):**
  1. The whole tree's skeleton (each node's id, parent, type, title and position) loads in one request, so the layout and connecting lines can be drawn at once.
  2. Only nodes inside the visible area (plus a margin) are drawn. Zoomed out, nodes are shown as dots or short titles; zoomed in, as full cards.
  3. Each node's heavy content (note text, link preview, thumbnail, uploaded image, video embed) is fetched in batches when the node comes into view at a readable zoom level, and cached. Images also use `loading="lazy"`.
- **Pages/modals:** P-05, P-06, M-04, M-05, M-06, M-10. **API:** `GET /api/trees/:id`, `GET /api/trees/:id/nodes`, `POST /api/trees/:id/groups`, `PATCH /api/groups/:id`, `DELETE /api/groups/:id`, `POST /api/trees/:id/nodes`, `PATCH /api/nodes/:id`, `PATCH /api/trees/:id/nodes/positions`, `DELETE /api/nodes/:id`, `POST /api/trees/:id/connections`, `PATCH /api/connections/:id`, `DELETE /api/connections/:id`, `PATCH /api/trees/:id/canvas`. **Tables:** `nodes`, `node_connections`, `node_groups`, `trees` (canvas look columns).

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
| `POST /api/trees/:id/connections` | ❌ | ✅ Owner, tree not in Trash | ✅ Owner, tree not in Trash |
| `PATCH /api/connections/:id` | ❌ | ✅ Owner, tree not in Trash | ✅ Owner, tree not in Trash |
| `DELETE /api/connections/:id` | ❌ | ✅ Owner, tree not in Trash | ✅ Owner, tree not in Trash |
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
| M-04 | Node Editor | Double-click a node, or "Edit" in the node's toolbar (P-05). Also opens right after adding a node | Type tabs (Text / Link / Video / Image), title, note, URL with live preview card (`POST /api/link-preview`), image upload with progress (`POST /api/uploads`). Switching type keeps title and note. Card color and line color (color pickers, with "Default" / "Inherit"). Shape (Rounded / Square / Pill / Circle) and size (width and height fields, "Auto" for the default size). Text size (slider, "Default") and text color (color picker, "Auto"). Kind (None / Core / Supporting / Important / Example / Question; not for the center idea). Saves with `PATCH /api/nodes/:id` |
| M-05 | Add Branch | "+" button on a selected node's toolbar, or the `Tab` key on a selected node (P-05) | Pick a type and enter a title; creates the child node next to its parent (`POST /api/trees/:id/nodes`), then opens M-04 for the details. Disabled with "This tree is full (2,000 ideas)" at the limit |
| M-06 | Delete Node | "Delete" in the node toolbar, or the `Delete` key on a selected node (P-05). Not shown for the center idea | Confirm: "Delete this idea and N ideas under it? You can undo this with ⌘Z / Ctrl+Z." N is counted from the loaded skeleton (`DELETE /api/nodes/:id`) |
| M-10 | Media Viewer | "View" in the node toolbar of an image or video node (P-05), or the image/video in the Node Details view (M-12, P-06) | Full-size image, or the embedded YouTube/Vimeo player. Close with `Esc` or the backdrop |

#### Main Screen Layout (Tree Editor, P-05)

```
+------------------------------------------------------------------------------+
| [AppHeader]  [H]             ( ☰ Menu | ☾ )             (avatar) [Edit|View] |
+------------------------------------------------------------------------------+
| [EditorToolbar]                                                              |
|  < My Trees | "Startup ideas" [PRIVATE] [#work][#side]  |      Saved ✓  |  [⚙] |
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
|           [NodeToolbar] [+ Add] [Edit] [Connect] [Delete]   <- on selection  |
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
- **EditorToolbar:** back link, tree title, visibility badge, category chips, Undo / Redo (↶ ↷) and History, save status ("Saving…" / "Saved ✓" / "Couldn't save – retry"), and Tree Settings (⚙, opens M-02). Switching to the Tree Viewer is the "Edit | View" pill on the right of the AppHeader ([common.md](./common.md) §4).
- **TreeCanvas:** the SVG canvas. Nodes are laid out from `parentId` with `d3-hierarchy` (siblings spaced by their card heights), and saved positions override the layout. Lines connect each node to its parent. Only nodes in the visible area plus a margin are drawn.
- **NodeCard:** looks different per type: TEXT (title and note), LINK (thumbnail, title, and the note or else the page title and domain), VIDEO (thumbnail with ▶, title, note or domain), IMAGE (image, title, note). When there is a note, a thin line separates it from the title. Text wraps onto as many lines as fit the card (the title up to 3 lines when there is a note, the note takes the rest, paragraph breaks kept), and the last line that fits ends with "…". The lines are measured from the card, so resizing a card shows more or less of the note. Cards show placeholders until their details are lazy-loaded. Zoomed out, cards become short titles and then dots.
- **CENTER IDEA:** the root node, larger and highlighted. It can't be deleted or moved under another node.
- **Resize handles:** four small squares on the corners of the selected card (Editor only, at card zoom). Drag one to resize the card (§3.5 Card shape and size); the same handles resize a selected box, note or label. While resizing near the screen edge, the canvas scrolls automatically so a box can be stretched past what fits on screen. On phones the touch area of each handle is at least 44 × 44 px.
- **Add button:** "+ Add" next to Tidy up (Editor only; §3.5 Add menu): Text, Link, Video, Image ideas, Box, Sticky note, Text label.
- **Tidy up button:** next to the Canvas button (Editor only; §3.5 Tidy up).
- **Canvas button:** above the zoom controls (Editor only). Opens the Canvas panel: grid style (Lines / Dots / None), grid color, grid opacity slider, background color and "Reset" (§3.5 Canvas look). On phones the panel keeps the page's 16 px side margin.
- **NodeToolbar:** appears above the selected node: "+ Add" (M-05), "Edit" (M-04), "Connect" (connect mode, §3.5 Connections), "Delete" (M-06). Delete is hidden on the root.
- **Branch lines:** in the Editor, clicking a parent → child line selects it and shows a toolbar at its middle with a **Label** field, its color swatch and "Inherit" (§3.5 Line colors per branch, Line labels).
- **Connections:** lines between connected ideas drawn by relationship type (dotted, solid with an arrow, dashed with an arrow, dash-dot with "vs"), gray or their own color, drawn over the branch lines and under the cards. In the Editor, clicking one selects it (thicker, with a soft yellow halo) and shows the relationship type, Swap direction, a color swatch, "Default" and "Remove connection" next to it.
- **MiniMap:** a whole-tree overview showing the current viewport. Click it to jump there.
- **ZoomControls / NodeCounter:** zoom out, zoom level, zoom in, fit to screen, and "142 / 2000" ideas used.

#### SPA UI/UX Points — canvas and nodes（SPAとしてのUI/UX設計ポイント）

- **Lazy-loaded canvas (§3.3):** the Editor and Viewer fetch the skeleton once (`GET /api/trees/:id`, TanStack Query key `['tree', id]`). As the viewport changes, the canvas collects visible node IDs whose details aren't cached (or whose `updatedAt` changed) and fetches them in batches of up to 100 (`GET /api/trees/:id/nodes?ids=`), at most a few requests per second while panning. Details are cached per node ID. Images also use `loading="lazy"`.
- **Drag moves save once, on drop:** while dragging a node or branch, positions update only in local state, so the drag stays smooth. On drop, one `PATCH /api/trees/:id/nodes/positions` request saves every moved node. Dropping onto another node re-parents it instead, with `PATCH /api/nodes/:id` (`parentId` plus the new position); a drop that would put a node under its own branch is refused in the UI before any request, matching `409 INVALID_MOVE`. If it fails, the nodes snap back and a toast says "Couldn't save the move".
- **Resizing saves once, on release:** while dragging a resize handle, the size and position change only in local state. On release, `PATCH /api/nodes/:id` (`width`, `height`) and `PATCH /api/trees/:id/nodes/positions` (the new center) are sent; if either fails, the card snaps back and a toast says so.
- **Canvas look is optimistic:** the Canvas panel changes the canvas at once and saves 300 ms after the last change, so dragging the opacity slider or the color picker sends one request. On failure the canvas goes back to the saved look and a toast says "Couldn't save the canvas look".
- **Connections are optimistic too:** a new connection appears at once and is removed again if `POST /api/trees/:id/connections` fails (`409 INVALID_CONNECTION` → "These ideas can't be connected", `409 CONNECTION_LIMIT_REACHED` → "This tree has the most connections allowed (500)"). The UI doesn't offer ideas that can't be connected: in connect mode, clicking the same idea, its parent or child, or an already connected idea shows a toast without a request. Deleting a node removes its connections from the canvas with it; re-parenting a node under an idea it's connected to removes that connection (the server does the same).
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
  Follows the common format `{ "data": {...} }`. `data.nodes` has one entry per requested node that belongs to this tree, with `id`, `body`, `url`, `previewTitle`, `previewDescription`, `previewImageUrl`, `imageUrl`, `imageUploadId` and `updatedAt`. `imageUrl` is the public URL of the uploaded image for `IMAGE` nodes (built from `uploads.storage_key`) and `null` otherwise; `imageUploadId` is that upload's ID (`null` otherwise), used by the Editor's undo to restore a deleted image idea. Only the upload's owner can attach it to a node, so returning it reveals nothing usable. IDs that don't exist or belong to another tree (e.g. a node deleted a moment ago) are left out instead of failing the whole batch.
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
| `lineColor` | `String \| null` | | Branch line color, `#RRGGBB`. Default `null` (inherit from the nearest ancestor) |
| `cardColor` | `String \| null` | | Card color, `#RRGGBB`. Default `null` (white; dark green for the center idea) |
| `shape` | `"ROUNDED" \| "RECTANGLE" \| "PILL" \| "ELLIPSE"` | | Card shape. Default `ROUNDED` |
| `width` | `Int \| null` | | Card width, 60–800. Default `null` (default size) |
| `height` | `Int \| null` | | Card height, 40–600. Default `null` (default size) |
| `fontSize` | `Int \| null` | | Note text size in px, 10–28. Default `null` (13) |
| `textColor` | `String \| null` | | Text color, `#RRGGBB`. Default `null` (Auto: contrast with the card) |
| `role` | `"CORE" \| "SUPPORTING" \| "IMPORTANT" \| "EXAMPLE" \| "QUESTION" \| null` | | Idea kind; `null` for none. Not allowed on the root (`400`) |
| `lineLabel` | `String \| null` | | Short label on the line from the parent to this idea, trimmed, 1–50 characters; `null` for none. Not allowed on the root (`400`) |

**Processing（処理）**

- The node count check and the insert run in one transaction that locks the tree row, so the 2,000-node limit can't be passed by two simultaneous requests. The tree's `updatedAt` is bumped in the same transaction.
- For `LINK` nodes, the server fetches the page's title, description and thumbnail and saves them in the preview fields. The fetch times out after 5 seconds; if it fails, the node is still created with the preview fields empty. To stop the server being used to reach internal addresses (SSRF), the fetch only goes to public `http`/`https` hosts: private, loopback and link-local IP addresses are refused, including after redirects.

**Response（レスポンス）**

- **Success: `201 Created`**
  Follows the common format `{ "data": {...} }`. `data.node` is the new node with both skeleton and detail fields: `id`, `parentId`, `type`, `title`, `body`, `url`, `previewTitle`, `previewDescription`, `previewImageUrl`, `imageUrl`, `imageUploadId`, `positionX`, `positionY`, `sortOrder`, `lineColor`, `cardColor`, `shape`, `width`, `height`, `fontSize`, `textColor`, `role`, `lineLabel`, `createdAt`, `updatedAt`.
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
| `lineColor` | `String \| null` | | Branch line color, `#RRGGBB`, or `null` to inherit. Allowed on any node, including the root |
| `cardColor` | `String \| null` | | Card color, `#RRGGBB`, or `null` for the default. Allowed on any node, including the root |
| `shape` | `"ROUNDED" \| "RECTANGLE" \| "PILL" \| "ELLIPSE"` | | Card shape. Allowed on any node, including the root |
| `width` | `Int \| null` | | Card width, 60–800, or `null` for the default size |
| `height` | `Int \| null` | | Card height, 40–600, or `null` for the default size |
| `fontSize` | `Int \| null` | | Note text size in px, 10–28, or `null` for the default |
| `textColor` | `String \| null` | | Text color, `#RRGGBB`, or `null` for Auto |
| `role` | `"CORE" \| "SUPPORTING" \| "IMPORTANT" \| "EXAMPLE" \| "QUESTION" \| null` | | Idea kind; `null` for none. Not allowed on the root (`400`) |
| `lineLabel` | `String \| null` | | Short label on the line from the parent to this idea, trimmed, 1–50 characters; `null` removes it. Not allowed on the root (`400`) |

**Processing（処理）**

- When `type` changes, `title` and `body` are kept, so text and links can be mixed freely in one tree. Fields that don't apply to the new type are cleared: `url` and the preview fields when leaving `LINK`/`VIDEO`, `imageUploadId` when leaving `IMAGE` (the image file is removed later by the uploads cleanup job). Changing to `LINK` fetches a preview for the new URL.
- When `parentId` changes, the server walks up from the new parent to the root. If it meets the node being moved, the move would put the node under itself, so it's refused.
- The update and the bump of the tree's `updatedAt` run in one transaction.
- A new `LINK` URL is fetched the same way as in `POST /api/trees/:id/nodes`: 5-second timeout, public hosts only (SSRF protection), and the update still succeeds with empty preview fields if the fetch fails.
- **Which endpoint saves positions:** drag moves (one node or a whole branch) use `PATCH /api/trees/:id/nodes/positions`. This endpoint is for content, type and parent; its `positionX`, `positionY` and `sortOrder` fields are only used together with a `parentId` change, so re-parenting and the node's new position are saved in one request.

**Response（レスポンス）**

- **Success: `200 OK`**
  Follows the common format `{ "data": {...} }`. `data.node` is the updated node with both skeleton and detail fields: `id`, `parentId`, `type`, `title`, `body`, `url`, `previewTitle`, `previewDescription`, `previewImageUrl`, `imageUrl`, `imageUploadId`, `positionX`, `positionY`, `sortOrder`, `lineColor`, `cardColor`, `shape`, `width`, `height`, `fontSize`, `textColor`, `role`, `lineLabel`, `createdAt`, `updatedAt`.
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

- **Summary（機能概要）:** Saves the positions (and optionally sibling order) of one or more nodes, and the positions and sizes of boxes, in one request. The Tree Editor uses it for every drag move (one node or a whole branch) and after an auto-layout. `PATCH /api/nodes/:id` sets positions only when re-parenting a node.
- **Authorization（認可）:** The tree's owner only (`USER` or `ADMIN` who owns it). The owner can still do this in a tree an admin removed. Anyone else gets `404`. Trees in the Trash can't be edited.

**Request（リクエスト）**

- **Path Parameters**

| Name | Type | Description |
|---|---|---|
| `id` | `String` | Tree ID (cuid) |

- **Body**

| Name | Type | Required | Description |
|---|---|---|---|
| `nodes` | `Array` | | 0–2,000 items (the per-tree node limit). Each node ID may appear only once. Default `[]` |
| `nodes[].id` | `String` | ✅ | Node ID. Must belong to this tree |
| `nodes[].positionX` | `Float` | ✅ | New canvas X position |
| `nodes[].positionY` | `Float` | ✅ | New canvas Y position |
| `nodes[].sortOrder` | `Int` | | New order among siblings |
| `groups` | `Array` | | 0–100 canvas items (moving a box moves the ideas inside it in the same request). Each ID once. Default `[]`. `nodes` and `groups` can't both be empty |
| `groups[].id` | `String` | ✅ | Box ID. Must belong to this tree |
| `groups[].positionX` / `positionY` | `Float` | ✅ | New top-left corner |
| `groups[].width` / `height` | `Int` | | New size (120–6,000 × 48–6,000) |

Only positions, sizes and order can be changed here. Content, type and parent are changed with `PATCH /api/nodes/:id`.

**Processing（処理）**

- All updates run in one transaction: either every node is saved or none is. The tree's `updatedAt` is bumped in the same transaction.
- Saving positions doesn't change the nodes' own `updatedAt`. A node's `updatedAt` marks a change to its content (what `GET /api/trees/:id/nodes` returns), so the canvas doesn't refetch the details of nodes that were only dragged.

**Response（レスポンス）**

- **Success: `200 OK`**
  Follows the common format `{ "data": {...} }`. `data.nodes` lists each updated node with `id`, `positionX`, `positionY`, `sortOrder` and `updatedAt` (unchanged by this endpoint); `data.groups` lists each updated box.
- **Error Responses**
  Follows the common format `{ "error": { "code", "message" } }`.
  - `400` `VALIDATION_ERROR` — `nodes` and `groups` are both empty, or `nodes` has more than 2,000 items; an ID appears twice; a position isn't a number; or an item has a field other than the ones above.
  - `401` `UNAUTHENTICATED` — No valid auth cookie, or the user is deactivated (`deletedAt` set).
  - `404` `TREE_NOT_FOUND` — The tree doesn't exist, is in the Trash, or isn't owned by the caller.
  - `404` `NODE_NOT_FOUND` — At least one node ID doesn't exist or belongs to another tree. Nothing is saved.
  - `404` `GROUP_NOT_FOUND` — At least one box ID doesn't exist or belongs to another tree. Nothing is saved.
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

#### Connections

---
##### **POST /api/trees/:id/connections**

- **Summary（機能概要）:** Connects two ideas of the same tree with an extra line, besides the parent → child branches (§3.5 Connections). Connections have no direction.
- **Authorization（認可）:** The tree's owner only (`USER` or `ADMIN` who owns it), also in a tree an admin removed. Anyone else gets `404`. Not allowed while the tree is in the Trash.

**Request（リクエスト）**

- **Path Parameters**

| Name | Type | Description |
|---|---|---|
| `id` | `String` | Tree ID (cuid) |

- **Body**

| Name | Type | Required | Description |
|---|---|---|---|
| `nodeAId` | `String` | ✅ | One of the two ideas. Must be in this tree |
| `nodeBId` | `String` | ✅ | The other idea. Must be in this tree and differ from `nodeAId` |
| `kind` | `"RELATED" \| "SEQUENCE" \| "DEPENDENCY" \| "CONTRAST"` | | Relationship type. Default `RELATED` |

**Processing（処理）**

- The two IDs are stored sorted (`node_a_id < node_b_id`), so connecting B to A is the same as A to B.
- The tree row is locked (`SELECT ... FOR UPDATE`) while the limit and duplicates are checked and the row is inserted, and the tree's `updatedAt` is bumped in the same transaction.

**Response（レスポンス）**

- **Success: `201 Created`**
  Follows the common format `{ "data": {...} }`. `data.connection`: `{ id, nodeAId, nodeBId, color, kind, arrow }`, with the IDs in stored (sorted) order. A new connection has `color` `null` (default gray), `kind` from the body (default `RELATED`) and, for `SEQUENCE` / `DEPENDENCY`, an `arrow` pointing from the first idea sent (`nodeAId` in the body) to the second.
- **Error Responses**
  Follows the common format `{ "error": { "code", "message" } }`.
  - `400` `VALIDATION_ERROR` — A field is missing or isn't a string, or `nodeAId` equals `nodeBId`.
  - `401` `UNAUTHENTICATED` — No valid auth cookie, or the user is deactivated (`deletedAt` set).
  - `404` `TREE_NOT_FOUND` — The tree doesn't exist, is in the Trash, or the caller doesn't own it.
  - `404` `NODE_NOT_FOUND` — One of the nodes doesn't exist or isn't in this tree.
  - `409` `INVALID_CONNECTION` — The ideas are already connected, or one is the other's parent.
  - `409` `CONNECTION_LIMIT_REACHED` — The tree already has 500 connections.
  - `500` `INTERNAL_ERROR` — Unexpected server error.
---

---
##### **PATCH /api/connections/:id**

- **Summary（機能概要）:** Changes a connection's line color, relationship type or direction (§3.5 Connections).
- **Authorization（認可）:** The owner of the connection's tree only (`USER` or `ADMIN` who owns it). Anyone else gets `404`. Not allowed while the tree is in the Trash.

**Request（リクエスト）**

- **Path Parameters**

| Name | Type | Description |
|---|---|---|
| `id` | `String` | Connection ID (cuid) |

- **Body**

| Name | Type | Required | Description |
|---|---|---|---|
| `color` | `String \| null` | | `#RRGGBB`, or `null` for the default gray |
| `kind` | `"RELATED" \| "SEQUENCE" \| "DEPENDENCY" \| "CONTRAST"` | | Relationship type |
| `arrow` | `"A_TO_B" \| "B_TO_A" \| null` | | Direction of the arrow between `nodeAId` and `nodeBId` (`null`: no arrow). Shown only for `SEQUENCE` and `DEPENDENCY` |

  Send only the fields to change; at least one is required.

**Processing（処理）**

- The changes are saved and the tree's `updatedAt` is bumped, in one transaction (tree row locked, like the other node edits).

**Response（レスポンス）**

- **Success: `200 OK`**
  Follows the common format `{ "data": {...} }`. `data.connection`: `{ id, nodeAId, nodeBId, color, kind, arrow }`.
- **Error Responses**
  Follows the common format `{ "error": { "code", "message" } }`.
  - `400` `VALIDATION_ERROR` — The body is empty, a value isn't allowed, or the body has other fields.
  - `401` `UNAUTHENTICATED` — No valid auth cookie, or the user is deactivated (`deletedAt` set).
  - `404` `CONNECTION_NOT_FOUND` — The connection doesn't exist (or was already deleted with one of its ideas), its tree is in the Trash, or the caller doesn't own the tree.
  - `500` `INTERNAL_ERROR` — Unexpected server error.
---

---
##### **DELETE /api/connections/:id**

- **Summary（機能概要）:** Removes a connection. The two ideas aren't changed.
- **Authorization（認可）:** The owner of the connection's tree only (`USER` or `ADMIN` who owns it). Anyone else gets `404`. Not allowed while the tree is in the Trash.

**Request（リクエスト）**

- **Path Parameters**

| Name | Type | Description |
|---|---|---|
| `id` | `String` | Connection ID (cuid) |

**Processing（処理）**

- The connection is deleted and the tree's `updatedAt` is bumped, in one transaction.

**Response（レスポンス）**

- **Success: `200 OK`**
  Follows the common format: `{ "data": null }`.
- **Error Responses**
  Follows the common format `{ "error": { "code", "message" } }`.
  - `401` `UNAUTHENTICATED` — No valid auth cookie, or the user is deactivated (`deletedAt` set).
  - `404` `CONNECTION_NOT_FOUND` — The connection doesn't exist (or was already deleted with one of its ideas), its tree is in the Trash, or the caller doesn't own the tree.
  - `500` `INTERNAL_ERROR` — Unexpected server error.
---

#### Boxes

---
##### **POST /api/trees/:id/groups**

- **Summary（機能概要）:** Adds a canvas item — a box, sticky note or text label (§3.5 Add menu and canvas items) — to the tree.
- **Authorization（認可）:** The tree's owner only (`USER` or `ADMIN` who owns it), also in a tree an admin removed. Anyone else gets `404`. Not allowed while the tree is in the Trash.

**Request（リクエスト）**

- **Path Parameters:** `id` — Tree ID (cuid)
- **Body**

| Name | Type | Required | Description |
|---|---|---|---|
| `kind` | `"BOX" \| "NOTE" \| "LABEL"` | | Default `BOX` |
| `title` | `String` | | Trimmed. 1–100 characters. Default `"Group"` (box), `"Note"` (note), `"Text"` (label). The label's text |
| `body` | `String \| null` | | Note text (`NOTE`) or the box's label (`BOX`, shown only when set), up to 2,000 characters. Not for `LABEL` |
| `color` | `String \| null` | | `#RRGGBB`, or `null` for the default (the node style's text color) |
| `positionX` / `positionY` | `Float` | ✅ | Top-left corner |
| `width` / `height` | `Int` | ✅ | 120–6,000 × 48–6,000 (a box at least 160 × 100) |

**Processing（処理）**

- The tree row is locked while the 100-item limit is checked and the box is inserted; the tree's `updatedAt` is bumped in the same transaction.

**Response（レスポンス）**

- **Success: `201 Created`** — `data.group`: `{ id, kind, title, body, color, positionX, positionY, width, height }`.
- **Error Responses**
  - `400` `VALIDATION_ERROR` — A field is missing or breaks a rule above.
  - `401` `UNAUTHENTICATED` — No valid auth cookie, or the user is deactivated.
  - `404` `TREE_NOT_FOUND` — The tree doesn't exist, is in the Trash, or isn't owned by the caller.
  - `409` `GROUP_LIMIT_REACHED` — The tree already has 100 canvas items.
  - `500` `INTERNAL_ERROR` — Unexpected server error.
---

---
##### **PATCH /api/groups/:id**

- **Summary（機能概要）:** Changes a canvas item's title, note text, color, position or size (its kind can't change).
- **Authorization（認可）:** The owner of the box's tree only. Anyone else gets `404`. Not allowed while the tree is in the Trash.

**Request（リクエスト）**

- **Path Parameters:** `id` — Box ID (cuid)
- **Body:** any of `title`, `body`, `color`, `positionX`, `positionY`, `width`, `height` (same rules as when creating); at least one.

**Processing（処理）**

- The box is updated and the tree's `updatedAt` is bumped, in one transaction (tree row locked).

**Response（レスポンス）**

- **Success: `200 OK`** — `data.group` after the change.
- **Error Responses**
  - `400` `VALIDATION_ERROR` — The body is empty, has another field, or breaks a rule.
  - `401` `UNAUTHENTICATED` — No valid auth cookie, or the user is deactivated.
  - `404` `GROUP_NOT_FOUND` — The box doesn't exist, its tree is in the Trash, or the caller doesn't own the tree.
  - `500` `INTERNAL_ERROR` — Unexpected server error.
---

---
##### **DELETE /api/groups/:id**

- **Summary（機能概要）:** Deletes a canvas item. No idea is changed.
- **Authorization（認可）:** The owner of the box's tree only. Anyone else gets `404`. Not allowed while the tree is in the Trash.

**Response（レスポンス）**

- **Success: `200 OK`** — `{ "data": null }`.
- **Error Responses**
  - `401` `UNAUTHENTICATED` — No valid auth cookie, or the user is deactivated.
  - `404` `GROUP_NOT_FOUND` — The box doesn't exist, its tree is in the Trash, or the caller doesn't own the tree.
  - `500` `INTERNAL_ERROR` — Unexpected server error.
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
| line_color | VARCHAR(7) | NULL | Branch line color `#RRGGBB`; `NULL` inherits from the nearest ancestor |
| card_color | VARCHAR(7) | NULL | Card color `#RRGGBB`; `NULL` is the default (white, dark green for the root). Not inherited |
| shape | NodeShape | NOT NULL, DEFAULT 'ROUNDED' | `ROUNDED` / `RECTANGLE` / `PILL` / `ELLIPSE` |
| width | INTEGER | NULL | Card width (canvas units, 60–800); `NULL` is the default size |
| height | INTEGER | NULL | Card height (canvas units, 40–600); `NULL` is the default size |
| font_size | INTEGER | NULL | Note text size in px (10–28); `NULL` is the default (13) |
| text_color | VARCHAR(7) | NULL | Text color `#RRGGBB`; `NULL` is Auto (contrast with the card) |
| role | NodeRole | NULL | Idea kind: `CORE` / `SUPPORTING` / `IMPORTANT` / `EXAMPLE` / `QUESTION`; `NULL` is none. Always `NULL` on the root |
| line_label | VARCHAR(50) | NULL | Label on the line from the parent to this idea; `NULL` is none. Always `NULL` on the root |
| created_at | TIMESTAMPTZ(3) | NOT NULL, DEFAULT now() | Created at |
| updated_at | TIMESTAMPTZ(3) | NOT NULL | Updated at |

**Business rules and constraints**
- Each tree has exactly one root node (`parent_id IS NULL`). Enforced in the **app layer**: TreeService creates it with the tree, and NodeService rejects creating another root or deleting the root. Also enforced in the **DB** by a partial unique index added with raw SQL in the first migration (Prisma can't express partial indexes): `CREATE UNIQUE INDEX nodes_one_root_per_tree ON nodes(tree_id) WHERE parent_id IS NULL;`
- A node's parent must belong to the same tree. Enforced in the **app layer** (NodeService).
- `role` and `line_label` are `NULL` on the root. Enforced in the **app layer** (NodeService, `400 VALIDATION_ERROR`).
- `font_size` is 10–28 or `NULL`, and `text_color` is `#RRGGBB` or `NULL`. Enforced in the **app layer** (Zod).
- `width` is 60–800 and `height` 40–600, or `NULL`. Enforced in the **app layer** (Zod). `NULL` means "fit the content": the frontend computes the size from the title and the lazily loaded details, so it isn't stored.
- `line_color` and `card_color` are `#RRGGBB` or `NULL`. Enforced in the **app layer** (Zod). Inheritance (nearest ancestor with a color, else gray) is computed by the frontend from the skeleton; the DB stores only the colors that were set.
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

#### node_connections（アイデア同士のつながり）

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PK, DEFAULT cuid() | Connection ID |
| tree_id | TEXT | NOT NULL, FK→trees.id (CASCADE) | The tree both ideas belong to |
| node_a_id | TEXT | NOT NULL, FK→nodes.id (CASCADE) | The idea with the smaller ID |
| node_b_id | TEXT | NOT NULL, FK→nodes.id (CASCADE) | The idea with the larger ID |
| color | VARCHAR(7) | NULL | Line color `#RRGGBB`; NULL = default gray |
| kind | ConnectionKind | NOT NULL, DEFAULT 'RELATED' | `RELATED` / `SEQUENCE` / `DEPENDENCY` / `CONTRAST` |
| arrow | ConnectionArrow | NULL | `A_TO_B` / `B_TO_A`; NULL = no direction |
| created_at | TIMESTAMPTZ(3) | NOT NULL, DEFAULT now() | Created at |

Indexes: `UNIQUE (node_a_id, node_b_id)`, `(tree_id)` for loading a tree's connections, `(node_b_id)` for the cascade from `nodes`.

**Business rules and constraints**
- A connection has no direction and each pair is stored once: `node_a_id < node_b_id`. Enforced in the **DB** (`CHECK (node_a_id COLLATE "C" < node_b_id COLLATE "C")`, byte order so it matches the app's string comparison, added with raw SQL in the migration, plus the unique index) and in the **app layer** (ConnectionService sorts the two IDs).
- Both ideas belong to `tree_id`, and neither is the other's parent. Enforced in the **app layer** (ConnectionService). Re-parenting a node under an idea it's connected to deletes that connection (NodeService, same transaction).
- A tree can have at most 500 connections. Enforced in the **app layer**: ConnectionService counts and inserts in one transaction with the tree row locked.
- Deleting either idea, or the tree, deletes the connection. Enforced in the **DB** (`ON DELETE CASCADE`).

#### node_groups（キャンバスの項目: ボックス・付箋・文字）

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PK, DEFAULT cuid() | Box ID |
| tree_id | TEXT | NOT NULL, FK→trees.id (CASCADE) | The tree |
| kind | GroupKind | NOT NULL, DEFAULT 'BOX' | `BOX` / `NOTE` / `LABEL` |
| title | VARCHAR(100) | NOT NULL, DEFAULT 'Group' | The label's text (boxes keep a title but don't show it) |
| body | VARCHAR(2000) | NULL | Sticky note text (`NOTE`) or the box's optional label (`BOX`) |
| color | VARCHAR(7) | NULL | `#RRGGBB`; NULL = the node style's text color |
| position_x / position_y | DOUBLE PRECISION | NOT NULL | Top-left corner (canvas units) |
| width / height | INTEGER | NOT NULL | Size (120–6,000 × 48–6,000; boxes at least 160 × 100) |
| created_at / updated_at | TIMESTAMPTZ(3) | NOT NULL | Created / updated at |

Index: `(tree_id)`.

**Business rules and constraints**
- `body` is used for `NOTE` (its text) and `BOX` (its optional label), never for `LABEL`; only `BOX` items carry ideas when moved. Enforced in the **app layer** (Zod / GroupService).
- Which ideas are in a box isn't stored: it's the ideas whose center is inside the rectangle (computed by the frontend). Deleting a box doesn't change any idea.
- A tree can have at most 100 canvas items. Enforced in the **app layer**: GroupService counts and inserts in one transaction with the tree row locked.
- Sizes and the title length are enforced in the **app layer** (Zod). Deleting the tree deletes its boxes (`ON DELETE CASCADE`).

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
