import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type { NodeType } from "@prisma/client";

import { env } from "../src/config/env.js";
import { hashPassword } from "../src/lib/password.js";
import { prisma } from "../src/lib/prisma.js";

/**
 * 開発用のサンプルデータを投入する（npm run seed -w backend）。
 * 何度実行しても同じ状態になるよう、シード用ユーザーのデータだけを消してから作り直す。
 * 開発者が自分で作った他のユーザーのデータには触れない。
 */

/** シード用ユーザー共通の開発用パスワード（本番では使わない） */
const SEED_PASSWORD = "password123";

const SEED_USERS = [
  {
    email: "admin@example.com",
    username: "highdea_admin",
    displayName: "Highdea Admin",
    role: "ADMIN",
  },
  { email: "alice@example.com", username: "alice", displayName: "Alice Chen", role: "USER" },
  { email: "bob@example.com", username: "bob", displayName: "Bob Tanaka", role: "USER" },
] as const;

// 1x1 の PNG（画像ノード用のサンプル）
const SAMPLE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

type SeedNode = {
  title: string;
  type?: NodeType;
  body?: string;
  url?: string;
  image?: boolean;
  children?: SeedNode[];
};

/** シード用ユーザーのツリー・カテゴリ・画像（ファイルも）を消す。管理者の非公開化記録も外す */
async function removeSeedData(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { email: { in: SEED_USERS.map((u) => u.email) } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  const uploads = await prisma.upload.findMany({ where: { ownerId: { in: ids } } });
  await prisma.tree.updateMany({
    where: { removedById: { in: ids } },
    data: { removedById: null },
  });
  await prisma.tree.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.category.deleteMany({ where: { userId: { in: ids } } });
  await prisma.upload.deleteMany({ where: { ownerId: { in: ids } } });
  await Promise.all(
    uploads.map((u) => unlink(path.resolve(env.UPLOAD_DIR, u.storageKey)).catch(() => undefined)),
  );
}

/** シード用ユーザーを作成（既にあれば内容を戻す） */
async function upsertUsers(): Promise<Record<string, string>> {
  const passwordHash = await hashPassword(SEED_PASSWORD);
  const ids: Record<string, string> = {};
  for (const u of SEED_USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: { ...u, passwordHash },
      update: { ...u, passwordHash, deletedAt: null, avatarUrl: null },
    });
    ids[u.username] = user.id;
  }
  return ids;
}

/** 画像ノード用にサンプル画像を保存し、uploads 行を作る */
async function createSampleUpload(ownerId: string): Promise<string> {
  const storageKey = `${randomUUID()}.png`;
  await mkdir(path.resolve(env.UPLOAD_DIR), { recursive: true });
  await writeFile(path.resolve(env.UPLOAD_DIR, storageKey), SAMPLE_PNG);
  const upload = await prisma.upload.create({
    data: {
      ownerId,
      storageKey,
      originalName: "sample.png",
      mimeType: "image/png",
      sizeBytes: SAMPLE_PNG.length,
    },
  });
  return upload.id;
}

/**
 * 子ノードを親の周りに放射状に配置しながら再帰的に作る。
 * 位置を保存しておくと、エディタの自動レイアウトより保存位置が優先される（manifests/nodes.md）。
 */
async function createChildren(
  treeId: string,
  ownerId: string,
  parent: { id: string; x: number; y: number; angle: number; spread: number },
  children: SeedNode[],
  radius: number,
): Promise<void> {
  for (const [i, child] of children.entries()) {
    const angle =
      children.length === 1
        ? parent.angle
        : parent.angle - parent.spread / 2 + (parent.spread * i) / (children.length - 1);
    const x = Math.round(parent.x + radius * Math.cos(angle));
    const y = Math.round(parent.y + radius * Math.sin(angle));
    const node = await prisma.node.create({
      data: {
        treeId,
        parentId: parent.id,
        type: child.type ?? (child.image ? "IMAGE" : "TEXT"),
        title: child.title,
        body: child.body ?? null,
        url: child.url ?? null,
        imageUploadId: child.image ? await createSampleUpload(ownerId) : null,
        positionX: x,
        positionY: y,
        sortOrder: i,
      },
    });
    if (child.children) {
      await createChildren(
        treeId,
        ownerId,
        { id: node.id, x, y, angle, spread: Math.PI / 2 },
        child.children,
        radius * 0.8,
      );
    }
  }
}

type SeedTree = {
  ownerId: string;
  title: string;
  description?: string;
  visibility: "PRIVATE" | "PUBLIC";
  categoryIds?: string[];
  deletedAt?: Date;
  removed?: { byId: string; reason: string };
  nodes: SeedNode[];
};

/** ツリーをルートノード付きで作り、子ノードを配置する */
async function createSeedTree(t: SeedTree): Promise<void> {
  const tree = await prisma.tree.create({
    data: {
      ownerId: t.ownerId,
      title: t.title,
      description: t.description ?? null,
      visibility: t.removed ? "PRIVATE" : t.visibility,
      deletedAt: t.deletedAt ?? null,
      removedAt: t.removed ? new Date() : null,
      removedById: t.removed?.byId ?? null,
      removalReason: t.removed?.reason ?? null,
      categories: { create: (t.categoryIds ?? []).map((categoryId) => ({ categoryId })) },
      nodes: { create: { title: t.title } },
    },
    include: { nodes: true },
  });
  const root = tree.nodes[0];
  if (!root) throw new Error("root node missing");
  await createChildren(
    tree.id,
    t.ownerId,
    {
      id: root.id,
      x: 0,
      y: 0,
      angle: -Math.PI / 2,
      spread: 2 * Math.PI - (2 * Math.PI) / Math.max(t.nodes.length, 1),
    },
    t.nodes,
    280,
  );
}

async function main(): Promise<void> {
  await removeSeedData();
  const users = await upsertUsers();
  const alice = users.alice ?? "";
  const bob = users.bob ?? "";
  const admin = users.highdea_admin ?? "";

  const category = (userId: string, name: string, color: string) =>
    prisma.category.create({ data: { userId, name, nameKey: name.toLowerCase(), color } });
  const work = await category(alice, "Work", "#2563EB");
  const side = await category(alice, "Side projects", "#16A34A");
  const learning = await category(alice, "Learning", "#9333EA");
  const bobIdeas = await category(bob, "work", "#EA580C");

  await createSeedTree({
    ownerId: alice,
    title: "Startup ideas",
    description: "Brainstorm for a small SaaS product, with research links and sketches.",
    visibility: "PUBLIC",
    categoryIds: [work.id, side.id],
    nodes: [
      {
        title: "Problem",
        body: "Teams lose ideas in chat threads and scattered docs.",
        children: [
          { title: "Ideas get lost in Slack" },
          { title: "No visual overview" },
          {
            title: "Research: how teams brainstorm",
            type: "LINK",
            url: "https://en.wikipedia.org/wiki/Brainstorming",
          },
        ],
      },
      {
        title: "Solution",
        children: [
          { title: "Idea trees on a canvas" },
          { title: "Mix text, links, videos and images" },
          { title: "Mind map example", image: true },
          {
            title: "Mind mapping explained",
            type: "VIDEO",
            url: "https://www.youtube.com/watch?v=5zMNlFOpSBQ",
          },
        ],
      },
      {
        title: "Market",
        children: [
          { title: "Students" },
          { title: "Product teams" },
          {
            title: "Mind map (Wikipedia)",
            type: "LINK",
            url: "https://en.wikipedia.org/wiki/Mind_map",
          },
        ],
      },
      {
        title: "Pricing",
        body: "Free for personal use; team plan later.",
        children: [{ title: "Free tier" }, { title: "Team plan" }],
      },
      {
        title: "Next steps",
        children: [{ title: "Interview 5 users" }, { title: "Build a prototype" }],
      },
    ],
  });

  await createSeedTree({
    ownerId: alice,
    title: "Learning TypeScript",
    description: "What to study next.",
    visibility: "PUBLIC",
    categoryIds: [learning.id],
    nodes: [
      { title: "Generics" },
      {
        title: "Narrowing",
        children: [{ title: "Type guards" }, { title: "Discriminated unions" }],
      },
      {
        title: "TypeScript handbook",
        type: "LINK",
        url: "https://www.typescriptlang.org/docs/handbook/intro.html",
      },
    ],
  });

  await createSeedTree({
    ownerId: alice,
    title: "Personal goals",
    description: "Private: only Alice can see this.",
    visibility: "PRIVATE",
    nodes: [
      { title: "Run a half marathon" },
      { title: "Read 20 books" },
      { title: "Learn to cook ramen" },
    ],
  });

  await createSeedTree({
    ownerId: alice,
    title: "Old brainstorm",
    description: "In the Trash for 2 days (8 days left).",
    visibility: "PRIVATE",
    deletedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    nodes: [{ title: "Outdated idea" }],
  });

  await createSeedTree({
    ownerId: bob,
    title: "Weekend projects",
    visibility: "PUBLIC",
    categoryIds: [bobIdeas.id],
    nodes: [{ title: "Build a bookshelf" }, { title: "Garden planter" }],
  });

  await createSeedTree({
    ownerId: bob,
    title: "Spam example",
    description: "Removed by an admin, to show the removed-tree state.",
    visibility: "PUBLIC",
    removed: { byId: admin, reason: "Example removal: off-topic content." },
    nodes: [{ title: "Buy followers" }],
  });

  console.warn(
    `Seed data ready. Log in with ${SEED_USERS.map((u) => u.email).join(", ")} / password "${SEED_PASSWORD}".`,
  );
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
