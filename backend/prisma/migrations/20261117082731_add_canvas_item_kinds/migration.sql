-- CreateEnum
CREATE TYPE "GroupKind" AS ENUM ('BOX', 'NOTE', 'LABEL');

-- AlterTable
ALTER TABLE "node_groups" ADD COLUMN     "body" VARCHAR(2000),
ADD COLUMN     "kind" "GroupKind" NOT NULL DEFAULT 'BOX';
