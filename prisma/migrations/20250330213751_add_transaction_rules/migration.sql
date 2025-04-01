-- CreateTable
CREATE TABLE "TransactionRule" (
    "id" TEXT NOT NULL,
    "sourceAssetId" TEXT NOT NULL,
    "targetAssetId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransactionRule_sourceAssetId_idx" ON "TransactionRule"("sourceAssetId");

-- CreateIndex
CREATE INDEX "TransactionRule_targetAssetId_idx" ON "TransactionRule"("targetAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionRule_sourceAssetId_targetAssetId_key" ON "TransactionRule"("sourceAssetId", "targetAssetId");

-- CreateIndex
CREATE INDEX "ClientBalance_clientId_idx" ON "ClientBalance"("clientId");

-- CreateIndex
CREATE INDEX "ClientBalance_assetId_idx" ON "ClientBalance"("assetId");

-- CreateIndex
CREATE INDEX "ClientBalance_transactionId_idx" ON "ClientBalance"("transactionId");

-- AddForeignKey
ALTER TABLE "TransactionRule" ADD CONSTRAINT "TransactionRule_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionRule" ADD CONSTRAINT "TransactionRule_targetAssetId_fkey" FOREIGN KEY ("targetAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
