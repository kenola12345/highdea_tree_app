import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { cleanupUploads } from "../../src/jobs/cleanupUploads.js";
import { uploadDir } from "../../src/services/upload.service.js";
import { prisma, resetDb } from "../helpers/db.js";
import { createTree, createUpload, createUser } from "../helpers/factories.js";

const dir = uploadDir();
const createdFiles: string[] = [];

/** アップロードの行と、その実ファイルを作る */
async function createUploadWithFile(ownerId: string) {
  const upload = await createUpload(ownerId);
  const filePath = path.join(dir, upload.storageKey);
  await writeFile(filePath, "image");
  createdFiles.push(filePath);
  return { upload, filePath };
}

beforeEach(async () => {
  await resetDb();
  await mkdir(dir, { recursive: true });
});

afterEach(async () => {
  await Promise.all(createdFiles.splice(0).map((file) => rm(file, { force: true })));
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("cleanupUploads", () => {
  it("deletes only uploads no node uses, with their files", async () => {
    const user = await createUser();
    const tree = await createTree(user.id);
    const used = await createUploadWithFile(user.id);
    const unused = await createUploadWithFile(user.id);
    await prisma.node.create({
      data: {
        treeId: tree.id,
        parentId: tree.rootId,
        type: "IMAGE",
        title: "Photo",
        imageUploadId: used.upload.id,
      },
    });

    const result = await cleanupUploads();

    expect(result).toEqual({ deleted: 1 });
    expect(await prisma.upload.findUnique({ where: { id: used.upload.id } })).not.toBeNull();
    expect(await prisma.upload.findUnique({ where: { id: unused.upload.id } })).toBeNull();
    expect(existsSync(used.filePath)).toBe(true);
    expect(existsSync(unused.filePath)).toBe(false);
  });

  it("deletes a brand-new unused upload (no grace period)", async () => {
    const user = await createUser();
    const fresh = await createUploadWithFile(user.id);

    await cleanupUploads();

    expect(await prisma.upload.count()).toBe(0);
    expect(existsSync(fresh.filePath)).toBe(false);
  });

  it("still deletes the row when its file is already missing", async () => {
    const user = await createUser();
    await createUpload(user.id);

    const result = await cleanupUploads();

    expect(result).toEqual({ deleted: 1 });
    expect(await prisma.upload.count()).toBe(0);
  });
});
