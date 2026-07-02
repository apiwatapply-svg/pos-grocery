-- Backfill SaleItem cost snapshot for records that were inserted before
-- the snapshot columns were added (or after but with the default 0).
-- The original migration 20260702165850_sale_item_cost_snapshot was
-- skipped on environments where the columns already existed, so any
-- SaleItem with unitCostSatang = 0 needs to be re-populated from the
-- current Product.costPriceSatang so profit reports can include these
-- historical sales correctly.

UPDATE "SaleItem"
SET
  "unitCostSatang" = (
    SELECT p."costPriceSatang"
    FROM "Product" p
    WHERE p.id = "SaleItem"."productId"
  ),
  "totalCostSatang" = (
    SELECT p."costPriceSatang" * "SaleItem"."quantity"
    FROM "Product" p
    WHERE p.id = "SaleItem"."productId"
  )
WHERE "SaleItem"."unitCostSatang" = 0;
