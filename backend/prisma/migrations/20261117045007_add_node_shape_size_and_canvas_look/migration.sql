-- CreateEnum
CREATE TYPE "NodeShape" AS ENUM ('ROUNDED', 'RECTANGLE', 'PILL', 'ELLIPSE');

-- CreateEnum
CREATE TYPE "GridStyle" AS ENUM ('LINES', 'DOTS', 'NONE');

-- AlterTable
ALTER TABLE "nodes" ADD COLUMN     "height" INTEGER,
ADD COLUMN     "shape" "NodeShape" NOT NULL DEFAULT 'ROUNDED',
ADD COLUMN     "width" INTEGER;

-- AlterTable
ALTER TABLE "trees" ADD COLUMN     "background_color" VARCHAR(7),
ADD COLUMN     "grid_color" VARCHAR(7),
ADD COLUMN     "grid_opacity" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "grid_style" "GridStyle" NOT NULL DEFAULT 'LINES';
