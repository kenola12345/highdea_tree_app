-- CreateTable
CREATE TABLE "node_groups" (
    "id" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "title" VARCHAR(100) NOT NULL DEFAULT 'Group',
    "color" VARCHAR(7),
    "position_x" DOUBLE PRECISION NOT NULL,
    "position_y" DOUBLE PRECISION NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "node_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "node_groups_tree_id_idx" ON "node_groups"("tree_id");

-- AddForeignKey
ALTER TABLE "node_groups" ADD CONSTRAINT "node_groups_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
