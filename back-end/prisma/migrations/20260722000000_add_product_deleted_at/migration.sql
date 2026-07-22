-- Add deletedAt to Product for soft delete (Google Sheets sync)
-- This enables soft delete so that Sales/Inventory FK references are preserved
-- when products are refreshed from Google Sheets.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "deletedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Product_storeId_deletedAt_idx" ON "Product"("storeId", "deletedAt");
