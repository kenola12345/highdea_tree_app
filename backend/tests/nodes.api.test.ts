import { Readable } from "node:stream";

import { MAX_NODES_PER_TREE } from "@highdea/shared";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import { ssrfDeps, type TransportResponse } from "../src/lib/ssrfGuard.js";
import { clearPreviewCache } from "../src/services/linkPreview.service.js";
import { prisma, resetDb } from "./helpers/db.js";
import {
  createLoggedInUser,
  createNodes,
  createTree,
  createUpload,
  createUser,
} from "./helpers/factories.js";

const app = createApp();

/** URL ごとの偽ページ。実際のインターネットには接続しない（登録の無い URL は接続失敗になる） */
let pages: Record<string, string> = {};

const ogPage = (title: string): string => `<!doctype html><html><head>
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="About ${title}">
  <meta property="og:image" content="https://example.com/${title}.png">
</head><body></body></html>`;

beforeEach(async () => {
  await resetDb();
  clearPreviewCache();
  pages = {};
  vi.spyOn(ssrfDeps, "lookup").mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  vi.spyOn(ssrfDeps, "transport").mockImplementation((target) => {
    const body = pages[target.url.href];
    if (body === undefined) return Promise.reject(new Error("ECONNREFUSED"));
    const response: TransportResponse = {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
      body: Readable.from([Buffer.from(body)]),
      close: () => undefined,
    };
    return Promise.resolve(response);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** ログイン済みユーザーと、そのユーザーのツリー */
async function ownTree(options: Parameters<typeof createTree>[1] = {}) {
  const { user, cookie } = await createLoggedInUser();
  const tree = await createTree(user.id, options);
  return { user, cookie, tree };
}

function postNode(treeId: string, cookie: string, body: Record<string, unknown>) {
  return request(app).post(`/api/trees/${treeId}/nodes`).set("Cookie", cookie).send(body);
}

function patchNode(nodeId: string, cookie: string, body: Record<string, unknown>) {
  return request(app).patch(`/api/nodes/${nodeId}`).set("Cookie", cookie).send(body);
}

/** ルートの下に子ノードを1つ直接作る */
function addChild(treeId: string, parentId: string, data: Record<string, unknown> = {}) {
  return prisma.node.create({ data: { treeId, parentId, title: "Child", ...data } });
}

describe("POST /api/trees/:id/nodes", () => {
  it("creates a TEXT node with skeleton and detail fields and bumps the tree's updatedAt", async () => {
    const { cookie, tree } = await ownTree();
    await prisma.tree.update({
      where: { id: tree.id },
      data: { updatedAt: new Date("2026-01-01T00:00:00Z") },
    });

    const res = await postNode(tree.id, cookie, {
      parentId: tree.rootId,
      type: "TEXT",
      title: "  Pricing  ",
      body: "Notes",
      positionX: 120.5,
      positionY: -40,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.node).toEqual({
      id: expect.any(String),
      parentId: tree.rootId,
      type: "TEXT",
      title: "Pricing",
      body: "Notes",
      url: null,
      previewTitle: null,
      previewDescription: null,
      previewImageUrl: null,
      imageUrl: null,
      imageUploadId: null,
      positionX: 120.5,
      positionY: -40,
      sortOrder: 0,
      lineColor: null,
      cardColor: null,
      shape: "ROUNDED",
      width: null,
      height: null,
      fontSize: null,
      textColor: null,
      role: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    const saved = await prisma.tree.findUniqueOrThrow({ where: { id: tree.id } });
    expect(saved.updatedAt.getTime()).toBeGreaterThan(new Date("2026-01-01T00:00:00Z").getTime());
  });

  it("places a new node after the parent's last child by default", async () => {
    const { cookie, tree } = await ownTree();
    await createNodes(tree.id, tree.rootId, 3);

    const res = await postNode(tree.id, cookie, {
      parentId: tree.rootId,
      type: "TEXT",
      title: "Fourth",
    });

    expect(res.body.data.node.sortOrder).toBe(3);
  });

  it("creates a LINK node with the preview fetched by the server", async () => {
    const { cookie, tree } = await ownTree();
    pages["https://example.com/post"] = ogPage("Post");

    const res = await postNode(tree.id, cookie, {
      parentId: tree.rootId,
      type: "LINK",
      title: "Read later",
      url: "https://example.com/post",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.node).toMatchObject({
      type: "LINK",
      url: "https://example.com/post",
      previewTitle: "Post",
      previewDescription: "About Post",
      previewImageUrl: "https://example.com/Post.png",
    });
    const saved = await prisma.node.findUniqueOrThrow({ where: { id: res.body.data.node.id } });
    expect(saved.previewFetchedAt).toBeInstanceOf(Date);
  });

  it("creates a LINK node with empty preview fields when the fetch fails", async () => {
    const { cookie, tree } = await ownTree();

    const res = await postNode(tree.id, cookie, {
      parentId: tree.rootId,
      type: "LINK",
      title: "Broken site",
      url: "https://example.com/down",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.node).toMatchObject({
      url: "https://example.com/down",
      previewTitle: null,
      previewDescription: null,
      previewImageUrl: null,
    });
  });

  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://vimeo.com/76979871",
  ])("creates a VIDEO node for %s without fetching a preview", async (url) => {
    const { cookie, tree } = await ownTree();

    const res = await postNode(tree.id, cookie, {
      parentId: tree.rootId,
      type: "VIDEO",
      title: "Talk",
      url,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.node).toMatchObject({ type: "VIDEO", url, previewTitle: null });
    expect(ssrfDeps.transport).not.toHaveBeenCalled();
  });

  it("creates an IMAGE node with the public image URL", async () => {
    const { user, cookie, tree } = await ownTree();
    const upload = await createUpload(user.id);

    const res = await postNode(tree.id, cookie, {
      parentId: tree.rootId,
      type: "IMAGE",
      title: "Sketch",
      imageUploadId: upload.id,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.node).toMatchObject({
      type: "IMAGE",
      imageUrl: `/uploads/${upload.storageKey}`,
    });
  });

  it.each([
    ["TEXT with a url", { type: "TEXT", url: "https://example.com" }],
    ["TEXT with an imageUploadId", { type: "TEXT", imageUploadId: "x" }],
    ["LINK without a url", { type: "LINK" }],
    ["LINK with a non-http url", { type: "LINK", url: "javascript:alert(1)" }],
    [
      "LINK with a url over 2,048 characters",
      { type: "LINK", url: `https://example.com/${"a".repeat(2048)}` },
    ],
    ["VIDEO from another site", { type: "VIDEO", url: "https://example.com/video" }],
    ["IMAGE without an imageUploadId", { type: "IMAGE" }],
    ["IMAGE with a url", { type: "IMAGE", imageUploadId: "x", url: "https://example.com" }],
    ["preview fields", { type: "LINK", url: "https://example.com", previewTitle: "Fake" }],
    ["an unknown type", { type: "AUDIO" }],
    ["an empty title", { type: "TEXT", title: "   " }],
    ["a title over 200 characters", { type: "TEXT", title: "a".repeat(201) }],
    ["a body over 10,000 characters", { type: "TEXT", body: "a".repeat(10_001) }],
  ])("returns 400 VALIDATION_ERROR for %s", async (_label, fields) => {
    const { cookie, tree } = await ownTree();

    const res = await postNode(tree.id, cookie, {
      parentId: tree.rootId,
      title: "Idea",
      ...fields,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "VALIDATION_ERROR", details: expect.any(Array) });
  });

  it("returns 401 UNAUTHENTICATED for guests", async () => {
    const owner = await createUser();
    const tree = await createTree(owner.id, { visibility: "PUBLIC" });

    const res = await request(app)
      .post(`/api/trees/${tree.id}/nodes`)
      .send({ parentId: tree.rootId, type: "TEXT", title: "Idea" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 404 TREE_NOT_FOUND for another user's tree", async () => {
    const owner = await createUser();
    const tree = await createTree(owner.id, { visibility: "PUBLIC" });
    const { cookie } = await createLoggedInUser();

    const res = await postNode(tree.id, cookie, {
      parentId: tree.rootId,
      type: "TEXT",
      title: "x",
    });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TREE_NOT_FOUND");
  });

  it("returns 404 TREE_NOT_FOUND for a tree in the Trash", async () => {
    const { cookie, tree } = await ownTree({ deletedAt: new Date() });

    const res = await postNode(tree.id, cookie, {
      parentId: tree.rootId,
      type: "TEXT",
      title: "x",
    });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TREE_NOT_FOUND");
  });

  it("lets the owner add nodes to a tree an admin removed", async () => {
    const admin = await createUser({ role: "ADMIN" });
    const { cookie, tree } = await ownTree({ removed: { byId: admin.id } });

    const res = await postNode(tree.id, cookie, {
      parentId: tree.rootId,
      type: "TEXT",
      title: "x",
    });

    expect(res.status).toBe(201);
  });

  it("returns 404 PARENT_NOT_FOUND for a parent in another tree", async () => {
    const { user, cookie, tree } = await ownTree();
    const otherTree = await createTree(user.id);

    const res = await postNode(tree.id, cookie, {
      parentId: otherTree.rootId,
      type: "TEXT",
      title: "x",
    });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("PARENT_NOT_FOUND");
    await expect(prisma.node.count({ where: { treeId: tree.id } })).resolves.toBe(1);
  });

  it("returns 404 UPLOAD_NOT_FOUND for another user's upload", async () => {
    const { cookie, tree } = await ownTree();
    const stranger = await createUser();
    const upload = await createUpload(stranger.id);

    const res = await postNode(tree.id, cookie, {
      parentId: tree.rootId,
      type: "IMAGE",
      title: "Stolen",
      imageUploadId: upload.id,
    });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("UPLOAD_NOT_FOUND");
  });

  it("returns 409 NODE_LIMIT_REACHED when the tree already has 2,000 nodes", async () => {
    const { cookie, tree } = await ownTree();
    await createNodes(tree.id, tree.rootId, MAX_NODES_PER_TREE - 1);

    const res = await postNode(tree.id, cookie, {
      parentId: tree.rootId,
      type: "TEXT",
      title: "x",
    });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: "NODE_LIMIT_REACHED", message: expect.any(String) },
    });
  });

  it("leaves exactly 2,000 nodes after two simultaneous creates on a tree with 1,999 (row lock)", async () => {
    const { cookie, tree } = await ownTree();
    await createNodes(tree.id, tree.rootId, MAX_NODES_PER_TREE - 2);

    const results = await Promise.all(
      ["A", "B"].map((title) =>
        postNode(tree.id, cookie, { parentId: tree.rootId, type: "TEXT", title }),
      ),
    );

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    await expect(prisma.node.count({ where: { treeId: tree.id } })).resolves.toBe(
      MAX_NODES_PER_TREE,
    );
  });
});

describe("PATCH /api/nodes/:id", () => {
  it("updates title and body and bumps the tree's updatedAt", async () => {
    const { cookie, tree } = await ownTree();
    const child = await addChild(tree.id, tree.rootId);
    await prisma.tree.update({
      where: { id: tree.id },
      data: { updatedAt: new Date("2026-01-01T00:00:00Z") },
    });

    const res = await patchNode(child.id, cookie, { title: " New title ", body: "Note" });

    expect(res.status).toBe(200);
    expect(res.body.data.node).toMatchObject({ id: child.id, title: "New title", body: "Note" });
    const saved = await prisma.tree.findUniqueOrThrow({ where: { id: tree.id } });
    expect(saved.updatedAt.getTime()).toBeGreaterThan(new Date("2026-01-01T00:00:00Z").getTime());
  });

  it("clears the body with null", async () => {
    const { cookie, tree } = await ownTree();
    const child = await addChild(tree.id, tree.rootId, { body: "Old" });

    const res = await patchNode(child.id, cookie, { body: null });

    expect(res.body.data.node.body).toBeNull();
  });

  it("changes LINK to TEXT, keeping title/body and clearing the url and preview", async () => {
    const { cookie, tree } = await ownTree();
    const link = await addChild(tree.id, tree.rootId, {
      type: "LINK",
      title: "Article",
      body: "Why it matters",
      url: "https://example.com/a",
      previewTitle: "A",
      previewDescription: "About A",
      previewImageUrl: "https://example.com/a.png",
      previewFetchedAt: new Date(),
    });

    const res = await patchNode(link.id, cookie, { type: "TEXT" });

    expect(res.status).toBe(200);
    expect(res.body.data.node).toMatchObject({
      type: "TEXT",
      title: "Article",
      body: "Why it matters",
      url: null,
      previewTitle: null,
      previewDescription: null,
      previewImageUrl: null,
    });
    const saved = await prisma.node.findUniqueOrThrow({ where: { id: link.id } });
    expect(saved.previewFetchedAt).toBeNull();
  });

  it("changes IMAGE to LINK, clearing the image and fetching a preview", async () => {
    const { user, cookie, tree } = await ownTree();
    const upload = await createUpload(user.id);
    const image = await addChild(tree.id, tree.rootId, {
      type: "IMAGE",
      title: "Pic",
      imageUploadId: upload.id,
    });
    pages["https://example.com/new"] = ogPage("New");

    const res = await patchNode(image.id, cookie, { type: "LINK", url: "https://example.com/new" });

    expect(res.status).toBe(200);
    expect(res.body.data.node).toMatchObject({
      type: "LINK",
      title: "Pic",
      imageUrl: null,
      url: "https://example.com/new",
      previewTitle: "New",
    });
  });

  it("refetches the preview when a LINK url changes", async () => {
    const { cookie, tree } = await ownTree();
    const link = await addChild(tree.id, tree.rootId, {
      type: "LINK",
      url: "https://example.com/old",
      previewTitle: "Old",
    });
    pages["https://example.com/new"] = ogPage("New");

    const res = await patchNode(link.id, cookie, { url: "https://example.com/new" });

    expect(res.body.data.node).toMatchObject({
      url: "https://example.com/new",
      previewTitle: "New",
    });
  });

  it("changes TEXT to IMAGE with an own upload", async () => {
    const { user, cookie, tree } = await ownTree();
    const child = await addChild(tree.id, tree.rootId);
    const upload = await createUpload(user.id);

    const res = await patchNode(child.id, cookie, { type: "IMAGE", imageUploadId: upload.id });

    expect(res.status).toBe(200);
    expect(res.body.data.node.imageUrl).toBe(`/uploads/${upload.storageKey}`);
  });

  it.each([
    ["an empty body", {}],
    ["preview fields", { previewTitle: "Fake" }],
    ["a url on a TEXT node", { url: "https://example.com" }],
    ["an imageUploadId on a TEXT node", { imageUploadId: "x" }],
    ["a type change to LINK without a url", { type: "LINK" }],
    ["a type change to IMAGE without an imageUploadId", { type: "IMAGE" }],
    ["a type change to VIDEO with another site", { type: "VIDEO", url: "https://example.com/v" }],
    ["a type change to TEXT with a url", { type: "TEXT", url: "https://example.com" }],
    ["positionX without parentId", { positionX: 10 }],
    ["sortOrder without parentId", { sortOrder: 1 }],
  ])("returns 400 VALIDATION_ERROR for %s", async (_label, body) => {
    const { cookie, tree } = await ownTree();
    const child = await addChild(tree.id, tree.rootId);

    const res = await patchNode(child.id, cookie, body);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "VALIDATION_ERROR", details: expect.any(Array) });
  });

  it("returns 400 for a non-video url on an existing VIDEO node", async () => {
    const { cookie, tree } = await ownTree();
    const video = await addChild(tree.id, tree.rootId, {
      type: "VIDEO",
      url: "https://vimeo.com/1",
    });

    const res = await patchNode(video.id, cookie, { url: "https://example.com/v" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 401 UNAUTHENTICATED for guests", async () => {
    const { tree } = await ownTree();

    const res = await request(app).patch(`/api/nodes/${tree.rootId}`).send({ title: "x" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 404 NODE_NOT_FOUND for another user's node", async () => {
    const owner = await createUser();
    const tree = await createTree(owner.id, { visibility: "PUBLIC" });
    const { cookie } = await createLoggedInUser();

    const res = await patchNode(tree.rootId, cookie, { title: "Hacked" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NODE_NOT_FOUND");
  });

  it("returns 404 NODE_NOT_FOUND for a node in a Trash tree", async () => {
    const { cookie, tree } = await ownTree({ deletedAt: new Date() });

    const res = await patchNode(tree.rootId, cookie, { title: "x" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NODE_NOT_FOUND");
  });

  it("lets the owner edit nodes in a tree an admin removed", async () => {
    const admin = await createUser({ role: "ADMIN" });
    const { cookie, tree } = await ownTree({ removed: { byId: admin.id } });

    const res = await patchNode(tree.rootId, cookie, { title: "Still mine" });

    expect(res.status).toBe(200);
  });

  it("returns 404 UPLOAD_NOT_FOUND for another user's upload", async () => {
    const { cookie, tree } = await ownTree();
    const child = await addChild(tree.id, tree.rootId);
    const upload = await createUpload((await createUser()).id);

    const res = await patchNode(child.id, cookie, { type: "IMAGE", imageUploadId: upload.id });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("UPLOAD_NOT_FOUND");
  });

  it("re-parents a node with its new position", async () => {
    const { cookie, tree } = await ownTree();
    const a = await addChild(tree.id, tree.rootId, { title: "A" });
    const b = await addChild(tree.id, tree.rootId, { title: "B" });
    await addChild(tree.id, b.id, { title: "B1", sortOrder: 0 });

    const res = await patchNode(a.id, cookie, {
      parentId: b.id,
      positionX: 300,
      positionY: 150,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.node).toMatchObject({
      parentId: b.id,
      positionX: 300,
      positionY: 150,
      sortOrder: 1,
    });
  });

  it("uses the sortOrder sent with parentId", async () => {
    const { cookie, tree } = await ownTree();
    const a = await addChild(tree.id, tree.rootId);
    const b = await addChild(tree.id, tree.rootId);

    const res = await patchNode(a.id, cookie, { parentId: b.id, sortOrder: 7 });

    expect(res.body.data.node.sortOrder).toBe(7);
  });

  it("returns 409 INVALID_MOVE when moving the root", async () => {
    const { cookie, tree } = await ownTree();
    const child = await addChild(tree.id, tree.rootId);

    const res = await patchNode(tree.rootId, cookie, { parentId: child.id });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVALID_MOVE");
  });

  it("returns 409 INVALID_MOVE when moving a node under itself", async () => {
    const { cookie, tree } = await ownTree();
    const child = await addChild(tree.id, tree.rootId);

    const res = await patchNode(child.id, cookie, { parentId: child.id });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVALID_MOVE");
  });

  it("returns 409 INVALID_MOVE when moving a node under its own descendant", async () => {
    const { cookie, tree } = await ownTree();
    const a = await addChild(tree.id, tree.rootId);
    const a1 = await addChild(tree.id, a.id);
    const a11 = await addChild(tree.id, a1.id);

    const res = await patchNode(a.id, cookie, { parentId: a11.id });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVALID_MOVE");
    const saved = await prisma.node.findUniqueOrThrow({ where: { id: a.id } });
    expect(saved.parentId).toBe(tree.rootId);
  });

  it("returns 404 PARENT_NOT_FOUND for a new parent in another tree", async () => {
    const { user, cookie, tree } = await ownTree();
    const child = await addChild(tree.id, tree.rootId);
    const other = await createTree(user.id);

    const res = await patchNode(child.id, cookie, { parentId: other.rootId });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("PARENT_NOT_FOUND");
  });
});

describe("DELETE /api/nodes/:id", () => {
  it("deletes the node with its whole subtree and returns every deleted ID", async () => {
    const { cookie, tree } = await ownTree();
    const a = await addChild(tree.id, tree.rootId);
    const a1 = await addChild(tree.id, a.id);
    const a2 = await addChild(tree.id, a.id);
    const a11 = await addChild(tree.id, a1.id);
    const b = await addChild(tree.id, tree.rootId);

    const res = await request(app).delete(`/api/nodes/${a.id}`).set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect([...(res.body.data.deletedNodeIds as string[])].sort()).toEqual(
      [a.id, a1.id, a2.id, a11.id].sort(),
    );
    const left = await prisma.node.findMany({ where: { treeId: tree.id }, select: { id: true } });
    expect(left.map((n) => n.id).sort()).toEqual([tree.rootId, b.id].sort());
  });

  it("returns 409 CANNOT_DELETE_ROOT for the root", async () => {
    const { cookie, tree } = await ownTree();

    const res = await request(app).delete(`/api/nodes/${tree.rootId}`).set("Cookie", cookie);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CANNOT_DELETE_ROOT");
  });

  it("returns 404 NODE_NOT_FOUND for a node in a Trash tree", async () => {
    const { cookie, tree } = await ownTree({ deletedAt: new Date() });
    const child = await addChild(tree.id, tree.rootId);

    const res = await request(app).delete(`/api/nodes/${child.id}`).set("Cookie", cookie);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NODE_NOT_FOUND");
    await expect(prisma.node.count({ where: { id: child.id } })).resolves.toBe(1);
  });

  it("returns 404 NODE_NOT_FOUND for another user's node", async () => {
    const owner = await createUser();
    const tree = await createTree(owner.id);
    const child = await addChild(tree.id, tree.rootId);
    const { cookie } = await createLoggedInUser();

    const res = await request(app).delete(`/api/nodes/${child.id}`).set("Cookie", cookie);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NODE_NOT_FOUND");
  });

  it("returns 401 UNAUTHENTICATED for guests", async () => {
    const { tree } = await ownTree();
    const child = await addChild(tree.id, tree.rootId);

    const res = await request(app).delete(`/api/nodes/${child.id}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("GET /api/trees/:id/nodes", () => {
  it("returns details for requested nodes of a public tree to guests, skipping unknown and foreign IDs", async () => {
    const owner = await createUser();
    const tree = await createTree(owner.id, { visibility: "PUBLIC" });
    const upload = await createUpload(owner.id);
    const link = await addChild(tree.id, tree.rootId, {
      type: "LINK",
      body: "Note",
      url: "https://example.com",
      previewTitle: "Example",
    });
    const image = await addChild(tree.id, tree.rootId, { type: "IMAGE", imageUploadId: upload.id });
    const otherTree = await createTree(owner.id, { visibility: "PUBLIC" });

    const res = await request(app).get(
      `/api/trees/${tree.id}/nodes?ids=${link.id},${image.id},${link.id},missing,${otherTree.rootId}`,
    );

    expect(res.status).toBe(200);
    const nodes = res.body.data.nodes as { id: string }[];
    expect(nodes).toHaveLength(2);
    expect(nodes.find((n) => n.id === link.id)).toEqual({
      id: link.id,
      body: "Note",
      url: "https://example.com",
      previewTitle: "Example",
      previewDescription: null,
      previewImageUrl: null,
      imageUrl: null,
      imageUploadId: null,
      updatedAt: expect.any(String),
    });
    expect(nodes.find((n) => n.id === image.id)).toMatchObject({
      imageUrl: `/uploads/${upload.storageKey}`,
      imageUploadId: upload.id,
    });
  });

  it("returns details of an own private tree to the owner", async () => {
    const { cookie, tree } = await ownTree();

    const res = await request(app)
      .get(`/api/trees/${tree.id}/nodes?ids=${tree.rootId}`)
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.nodes).toHaveLength(1);
  });

  it("returns 404 TREE_NOT_FOUND for a private tree to guests and other users", async () => {
    const owner = await createUser();
    const tree = await createTree(owner.id);
    const { cookie } = await createLoggedInUser();

    const guest = await request(app).get(`/api/trees/${tree.id}/nodes?ids=${tree.rootId}`);
    const other = await request(app)
      .get(`/api/trees/${tree.id}/nodes?ids=${tree.rootId}`)
      .set("Cookie", cookie);

    expect(guest.status).toBe(404);
    expect(guest.body.error.code).toBe("TREE_NOT_FOUND");
    expect(other.status).toBe(404);
    expect(other.body.error.code).toBe("TREE_NOT_FOUND");
  });

  it("returns 404 TREE_NOT_FOUND for a tree in the Trash, even to the owner", async () => {
    const { cookie, tree } = await ownTree({ deletedAt: new Date() });

    const res = await request(app)
      .get(`/api/trees/${tree.id}/nodes?ids=${tree.rootId}`)
      .set("Cookie", cookie);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TREE_NOT_FOUND");
  });

  it.each([
    ["missing ids", ""],
    ["empty ids", "?ids="],
    ["only commas", "?ids=,,"],
    [
      "more than 100 IDs",
      `?ids=${Array.from({ length: 101 }, (_, i) => `n${String(i)}`).join(",")}`,
    ],
  ])("returns 400 VALIDATION_ERROR for %s", async (_label, query) => {
    const owner = await createUser();
    const tree = await createTree(owner.id, { visibility: "PUBLIC" });

    const res = await request(app).get(`/api/trees/${tree.id}/nodes${query}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("accepts 100 unique IDs after ignoring duplicates", async () => {
    const owner = await createUser();
    const tree = await createTree(owner.id, { visibility: "PUBLIC" });
    const ids = Array.from({ length: 100 }, (_, i) => `n${String(i)}`);

    const res = await request(app).get(
      `/api/trees/${tree.id}/nodes?ids=${[...ids, ...ids].join(",")}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.nodes).toEqual([]);
  });
});

describe("line colors (manifests/nodes.md §3.5 Line colors per branch)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("stores a branch line color on create and update, returns it in the skeleton, and clears it with null", async () => {
    const { user, cookie } = await createLoggedInUser();
    const tree = await createTree(user.id);

    const created = await request(app)
      .post(`/api/trees/${tree.id}/nodes`)
      .set("Cookie", cookie)
      .send({ type: "TEXT", title: "Red branch", parentId: tree.rootId, lineColor: "#EF4444" });
    expect(created.status).toBe(201);
    expect(created.body.data.node.lineColor).toBe("#EF4444");

    const rootColored = await request(app)
      .patch(`/api/nodes/${tree.rootId}`)
      .set("Cookie", cookie)
      .send({ lineColor: "#3B82F6" });
    expect(rootColored.status).toBe(200);
    expect(rootColored.body.data.node.lineColor).toBe("#3B82F6");

    const cleared = await request(app)
      .patch(`/api/nodes/${created.body.data.node.id as string}`)
      .set("Cookie", cookie)
      .send({ lineColor: null });
    expect(cleared.body.data.node.lineColor).toBeNull();

    const detail = await request(app).get(`/api/trees/${tree.id}`).set("Cookie", cookie);
    const colors = (detail.body.data.nodes as { id: string; lineColor: string | null }[])
      .map((n) => n.lineColor)
      .sort();
    expect(colors).toEqual(["#3B82F6", null]);
  });

  it("rejects a color that isn't #RRGGBB", async () => {
    const { user, cookie } = await createLoggedInUser();
    const tree = await createTree(user.id);

    const res = await request(app)
      .patch(`/api/nodes/${tree.rootId}`)
      .set("Cookie", cookie)
      .send({ lineColor: "red" });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: "lineColor", message: expect.any(String) }]);
  });
});

describe("card colors (manifests/nodes.md §3.5 Card colors)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("stores a card color on any node including the root, returns it in the skeleton, and clears it with null", async () => {
    const { user, cookie } = await createLoggedInUser();
    const tree = await createTree(user.id);

    const created = await request(app)
      .post(`/api/trees/${tree.id}/nodes`)
      .set("Cookie", cookie)
      .send({ type: "TEXT", title: "Yellow card", parentId: tree.rootId, cardColor: "#FDE68A" });
    expect(created.body.data.node.cardColor).toBe("#FDE68A");

    const root = await request(app)
      .patch(`/api/nodes/${tree.rootId}`)
      .set("Cookie", cookie)
      .send({ cardColor: "#1E3A8A" });
    expect(root.body.data.node.cardColor).toBe("#1E3A8A");

    const cleared = await request(app)
      .patch(`/api/nodes/${tree.rootId}`)
      .set("Cookie", cookie)
      .send({ cardColor: null });
    expect(cleared.body.data.node.cardColor).toBeNull();

    const detail = await request(app).get(`/api/trees/${tree.id}`).set("Cookie", cookie);
    const colors = (detail.body.data.nodes as { cardColor: string | null }[])
      .map((n) => n.cardColor)
      .sort();
    expect(colors).toEqual(["#FDE68A", null]);
  });

  it("rejects a card color that isn't #RRGGBB", async () => {
    const { user, cookie } = await createLoggedInUser();
    const tree = await createTree(user.id);

    const res = await request(app)
      .patch(`/api/nodes/${tree.rootId}`)
      .set("Cookie", cookie)
      .send({ cardColor: "#FFF" });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: "cardColor", message: expect.any(String) }]);
  });
});

describe("card shape and size (manifests/nodes.md §3.5 Card shape and size)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("stores a shape and size on create and update, returns them in the skeleton, and clears the size with null", async () => {
    const { user, cookie } = await createLoggedInUser();
    const tree = await createTree(user.id);

    const created = await request(app)
      .post(`/api/trees/${tree.id}/nodes`)
      .set("Cookie", cookie)
      .send({
        type: "TEXT",
        title: "Round",
        parentId: tree.rootId,
        shape: "ELLIPSE",
        width: 120,
        height: 120,
      });
    expect(created.status).toBe(201);
    expect(created.body.data.node).toMatchObject({ shape: "ELLIPSE", width: 120, height: 120 });

    const root = await request(app)
      .patch(`/api/nodes/${tree.rootId}`)
      .set("Cookie", cookie)
      .send({ shape: "PILL", width: 300, height: 60 });
    expect(root.status).toBe(200);
    expect(root.body.data.node).toMatchObject({ shape: "PILL", width: 300, height: 60 });

    const cleared = await request(app)
      .patch(`/api/nodes/${tree.rootId}`)
      .set("Cookie", cookie)
      .send({ width: null, height: null });
    expect(cleared.body.data.node).toMatchObject({ shape: "PILL", width: null, height: null });

    const detail = await request(app).get(`/api/trees/${tree.id}`).set("Cookie", cookie);
    const round = (detail.body.data.nodes as { title: string }[]).find((n) => n.title === "Round");
    expect(round).toMatchObject({ shape: "ELLIPSE", width: 120, height: 120 });
  });

  it("rejects an unknown shape and sizes outside 60–800 × 40–600 or not whole numbers", async () => {
    const { user, cookie } = await createLoggedInUser();
    const tree = await createTree(user.id);

    for (const body of [
      { shape: "STAR" },
      { width: 59 },
      { width: 801 },
      { height: 39 },
      { height: 601 },
      { width: 100.5 },
    ]) {
      const res = await request(app)
        .patch(`/api/nodes/${tree.rootId}`)
        .set("Cookie", cookie)
        .send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
    const stored = await prisma.node.findUniqueOrThrow({ where: { id: tree.rootId } });
    expect(stored).toMatchObject({ shape: "ROUNDED", width: null, height: null });
  });
});

describe("text size and color (manifests/nodes.md §3.5 Text size and color)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("stores a text size and color, returns them in the skeleton, and clears them with null", async () => {
    const { user, cookie } = await createLoggedInUser();
    const tree = await createTree(user.id);

    const created = await request(app)
      .post(`/api/trees/${tree.id}/nodes`)
      .set("Cookie", cookie)
      .send({
        type: "TEXT",
        title: "Big",
        parentId: tree.rootId,
        fontSize: 18,
        textColor: "#B91C1C",
      });
    expect(created.body.data.node).toMatchObject({ fontSize: 18, textColor: "#B91C1C" });

    const cleared = await request(app)
      .patch(`/api/nodes/${created.body.data.node.id as string}`)
      .set("Cookie", cookie)
      .send({ fontSize: null, textColor: null });
    expect(cleared.body.data.node).toMatchObject({ fontSize: null, textColor: null });

    const root = await request(app)
      .patch(`/api/nodes/${tree.rootId}`)
      .set("Cookie", cookie)
      .send({ fontSize: 24 });
    expect(root.status).toBe(200);
    const detail = await request(app).get(`/api/trees/${tree.id}`).set("Cookie", cookie);
    expect(
      (detail.body.data.nodes as { id: string; fontSize: number | null }[]).find(
        (n) => n.id === tree.rootId,
      )?.fontSize,
    ).toBe(24);
  });

  it("rejects a text size outside 10–28 or not whole, and a text color that isn't #RRGGBB", async () => {
    const { user, cookie } = await createLoggedInUser();
    const tree = await createTree(user.id);

    for (const body of [
      { fontSize: 9 },
      { fontSize: 29 },
      { fontSize: 12.5 },
      { textColor: "red" },
    ]) {
      const res = await request(app)
        .patch(`/api/nodes/${tree.rootId}`)
        .set("Cookie", cookie)
        .send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });
});

describe("idea kinds (manifests/nodes.md §3.5 Idea kinds)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("stores a kind on create and update, clears it with null, and refuses a kind on the center idea", async () => {
    const { user, cookie } = await createLoggedInUser();
    const tree = await createTree(user.id);

    const created = await request(app)
      .post(`/api/trees/${tree.id}/nodes`)
      .set("Cookie", cookie)
      .send({ type: "TEXT", title: "Controller", parentId: tree.rootId, role: "CORE" });
    expect(created.body.data.node.role).toBe("CORE");
    const id = created.body.data.node.id as string;

    const changed = await request(app)
      .patch(`/api/nodes/${id}`)
      .set("Cookie", cookie)
      .send({ role: "QUESTION" });
    expect(changed.body.data.node.role).toBe("QUESTION");
    const cleared = await request(app)
      .patch(`/api/nodes/${id}`)
      .set("Cookie", cookie)
      .send({ role: null });
    expect(cleared.body.data.node.role).toBeNull();

    const root = await request(app)
      .patch(`/api/nodes/${tree.rootId}`)
      .set("Cookie", cookie)
      .send({ role: "CORE" });
    expect(root.status).toBe(400);
    expect(root.body.error.code).toBe("VALIDATION_ERROR");
    const bad = await request(app)
      .patch(`/api/nodes/${id}`)
      .set("Cookie", cookie)
      .send({ role: "HERO" });
    expect(bad.status).toBe(400);
  });
});
