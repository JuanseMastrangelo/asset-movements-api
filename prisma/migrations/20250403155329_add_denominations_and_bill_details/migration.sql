-- CreateTable
CREATE TABLE "Denomination" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Denomination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillDetail" (
    "id" TEXT NOT NULL,
    "transactionDetailId" TEXT NOT NULL,
    "denominationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Denomination_assetId_idx" ON "Denomination"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "Denomination_assetId_value_key" ON "Denomination"("assetId", "value");

-- CreateIndex
CREATE INDEX "BillDetail_transactionDetailId_idx" ON "BillDetail"("transactionDetailId");

-- CreateIndex
CREATE INDEX "BillDetail_denominationId_idx" ON "BillDetail"("denominationId");

-- CreateIndex
CREATE UNIQUE INDEX "BillDetail_transactionDetailId_denominationId_key" ON "BillDetail"("transactionDetailId", "denominationId");

-- AddForeignKey
ALTER TABLE "Denomination" ADD CONSTRAINT "Denomination_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillDetail" ADD CONSTRAINT "BillDetail_transactionDetailId_fkey" FOREIGN KEY ("transactionDetailId") REFERENCES "TransactionDetail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillDetail" ADD CONSTRAINT "BillDetail_denominationId_fkey" FOREIGN KEY ("denominationId") REFERENCES "Denomination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
