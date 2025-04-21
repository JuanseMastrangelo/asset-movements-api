-- AlterEnum
ALTER TYPE "TransactionState" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "isImmutable" BOOLEAN NOT NULL DEFAULT false;
