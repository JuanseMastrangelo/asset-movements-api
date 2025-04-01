-- AlterTable
ALTER TABLE "Logistics" ADD COLUMN     "distance" DOUBLE PRECISION,
ADD COLUMN     "originAddress" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "price" DOUBLE PRECISION,
ADD COLUMN     "pricePerKm" DOUBLE PRECISION,
ADD COLUMN     "status" TEXT DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "LogisticsSettings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pricePerKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minDistance" DOUBLE PRECISION,
    "maxDistance" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogisticsSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LogisticsSettings_name_key" ON "LogisticsSettings"("name");
