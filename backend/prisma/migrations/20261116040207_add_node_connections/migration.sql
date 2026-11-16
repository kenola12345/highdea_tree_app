-- CreateTable
CREATE TABLE "node_connections" (
    "id" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "node_a_id" TEXT NOT NULL,
    "node_b_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "node_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "node_connections_tree_id_idx" ON "node_connections"("tree_id");

-- CreateIndex
CREATE INDEX "node_connections_node_b_id_idx" ON "node_connections"("node_b_id");

-- CreateIndex
CREATE UNIQUE INDEX "node_connections_node_a_id_node_b_id_key" ON "node_connections"("node_a_id", "node_b_id");

-- AddForeignKey
ALTER TABLE "node_connections" ADD CONSTRAINT "node_connections_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_connections" ADD CONSTRAINT "node_connections_node_a_id_fkey" FOREIGN KEY ("node_a_id") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_connections" ADD CONSTRAINT "node_connections_node_b_id_fkey" FOREIGN KEY ("node_b_id") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 向きのないつながりを1組1行にするため、ID の小さい方（バイト順。アプリの文字列比較と合わせるため COLLATE "C"）を node_a_id に入れる（manifests/nodes.md node_connections）
ALTER TABLE "node_connections" ADD CONSTRAINT "node_connections_a_lt_b" CHECK ("node_a_id" COLLATE "C" < "node_b_id" COLLATE "C");
