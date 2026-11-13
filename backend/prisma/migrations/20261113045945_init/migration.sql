-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "TreeVisibility" AS ENUM ('PRIVATE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "NodeType" AS ENUM ('TEXT', 'LINK', 'VIDEO', 'IMAGE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "username" VARCHAR(30) NOT NULL,
    "display_name" VARCHAR(50) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "avatar_url" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trees" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "visibility" "TreeVisibility" NOT NULL DEFAULT 'PRIVATE',
    "removed_at" TIMESTAMPTZ(3),
    "removed_by_id" TEXT,
    "removal_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "trees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nodes" (
    "id" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "type" "NodeType" NOT NULL DEFAULT 'TEXT',
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT,
    "url" TEXT,
    "preview_title" VARCHAR(300),
    "preview_description" VARCHAR(1000),
    "preview_image_url" TEXT,
    "preview_fetched_at" TIMESTAMPTZ(3),
    "image_upload_id" TEXT,
    "position_x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position_y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "name_key" VARCHAR(50) NOT NULL,
    "color" VARCHAR(7) NOT NULL DEFAULT '#6B7280',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tree_categories" (
    "tree_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tree_categories_pkey" PRIMARY KEY ("tree_id","category_id")
);

-- CreateTable
CREATE TABLE "uploads" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "storage_key" VARCHAR(255) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "trees_owner_id_deleted_at_updated_at_idx" ON "trees"("owner_id", "deleted_at", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "trees_deleted_at_idx" ON "trees"("deleted_at");

-- CreateIndex
CREATE INDEX "trees_visibility_removed_at_deleted_at_updated_at_idx" ON "trees"("visibility", "removed_at", "deleted_at", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "nodes_tree_id_idx" ON "nodes"("tree_id");

-- CreateIndex
CREATE INDEX "nodes_parent_id_sort_order_idx" ON "nodes"("parent_id", "sort_order");

-- CreateIndex
CREATE INDEX "nodes_image_upload_id_idx" ON "nodes"("image_upload_id");

-- CreateIndex
CREATE INDEX "categories_name_key_idx" ON "categories"("name_key");

-- CreateIndex
CREATE UNIQUE INDEX "categories_user_id_name_key_key" ON "categories"("user_id", "name_key");

-- CreateIndex
CREATE INDEX "tree_categories_category_id_idx" ON "tree_categories"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "uploads_storage_key_key" ON "uploads"("storage_key");

-- CreateIndex
CREATE INDEX "uploads_owner_id_idx" ON "uploads"("owner_id");

-- AddForeignKey
ALTER TABLE "trees" ADD CONSTRAINT "trees_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trees" ADD CONSTRAINT "trees_removed_by_id_fkey" FOREIGN KEY ("removed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_image_upload_id_fkey" FOREIGN KEY ("image_upload_id") REFERENCES "uploads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tree_categories" ADD CONSTRAINT "tree_categories_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tree_categories" ADD CONSTRAINT "tree_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 各ツリーのルートノード（parent_id IS NULL）は1つだけ。
-- Prisma のスキーマでは部分インデックスを表現できないため手書きで追加する（manifests/nodes.md nodes テーブルのルール）
CREATE UNIQUE INDEX "nodes_one_root_per_tree" ON "nodes"("tree_id") WHERE "parent_id" IS NULL;
