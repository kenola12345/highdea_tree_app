-- CreateEnum
CREATE TYPE "NodeRole" AS ENUM ('CORE', 'SUPPORTING', 'IMPORTANT', 'EXAMPLE', 'QUESTION');

-- CreateEnum
CREATE TYPE "NodeStylePreset" AS ENUM ('MINIMAL', 'MIDNIGHT', 'ORGANIC', 'EDITORIAL');

-- CreateEnum
CREATE TYPE "ConnectionKind" AS ENUM ('RELATED', 'SEQUENCE', 'DEPENDENCY', 'CONTRAST');

-- CreateEnum
CREATE TYPE "ConnectionArrow" AS ENUM ('A_TO_B', 'B_TO_A');

-- AlterTable
ALTER TABLE "node_connections" ADD COLUMN     "arrow" "ConnectionArrow",
ADD COLUMN     "kind" "ConnectionKind" NOT NULL DEFAULT 'RELATED';

-- AlterTable
ALTER TABLE "nodes" ADD COLUMN     "role" "NodeRole";

-- AlterTable
ALTER TABLE "trees" ADD COLUMN     "grid_spacing" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "node_style" "NodeStylePreset" NOT NULL DEFAULT 'MINIMAL';
