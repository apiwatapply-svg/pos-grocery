-- Snapshot product cost on each sale item so historical profit
-- calculations do not change when the product's cost price is later
-- updated.

ALTER TABLE "SaleItem" ADD COLUMN "unitCostSatang" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SaleItem" ADD COLUMN "totalCostSatang" INTEGER NOT NULL DEFAULT 0;

UPDATE "SaleItem"
SET
  "unitCostSatang" = "Product"."costPriceSatang",
  "totalCostSatang" = "Product"."costPriceSatang" * "SaleItem"."quantity"
FROM "Product"
WHERE "SaleItem"."productId" = "Product"."id";
