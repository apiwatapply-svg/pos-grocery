import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";

const env = {};
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(scriptDir, "..");

for (const file of [".env", ".dev.vars"]) {
  const envPath = path.join(backendDir, file);
  if (!fs.existsSync(envPath)) {
    continue;
  }
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
    }
  }
}

const client = createClient({
  url: env.DATABASE_URL || env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});

const store = await client.execute('SELECT id FROM "Store" ORDER BY "createdAt" ASC LIMIT 1');
const storeId = String(store.rows[0].id);
const user = await client.execute({
  sql: 'SELECT id FROM "User" WHERE "storeId" = ? AND username = ? LIMIT 1',
  args: [storeId, "admin"],
});
const userId = String(user.rows[0].id);
const products = await client.execute({
  sql: 'SELECT id, name, barcode, "costPriceSatang", "salePriceSatang" FROM "Product" WHERE "storeId" = ? AND status = ? AND "stockQuantity" > 0 ORDER BY name ASC LIMIT 3',
  args: [storeId, "active"],
});
const items = products.rows.map((product) => ({
  id: String(product.id),
  name: String(product.name),
  barcode: String(product.barcode),
  cost: Number(product.costPriceSatang),
  price: Number(product.salePriceSatang),
  quantity: 1,
}));

const saleId = randomUUID();
const paymentId = randomUUID();
const receiptId = randomUUID();
const receiptNumber = `RC${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`;
const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
const cash = total + 100000;
const soldAt = new Date().toISOString();
const productIds = items.map((item) => item.id);
const stockCase = items.map(() => "WHEN ? THEN ?").join(" ");
const stockCaseArgs = items.flatMap((item) => [item.id, item.quantity]);
const inMarks = productIds.map(() => "?").join(", ");

const startedAt = Date.now();
const tx = await client.transaction("write");
try {
  const updated = await tx.execute({
    sql: `
      UPDATE "Product"
      SET "stockQuantity" = "stockQuantity" - CASE "id" ${stockCase} ELSE 0 END
      WHERE "id" IN (${inMarks})
        AND "stockQuantity" >= CASE "id" ${stockCase} ELSE 0 END
      RETURNING "id", "stockQuantity"
    `,
    args: [...stockCaseArgs, ...productIds, ...stockCaseArgs],
  });

  if (updated.rows.length !== items.length) {
    throw new Error("stock update mismatch");
  }

  const stockById = new Map(updated.rows.map((row) => [String(row.id), Number(row.stockQuantity)]));
  const statements = [
    {
      sql: 'INSERT INTO "Sale" (id, "storeId", "cashierUserId", "receiptNumber", "subtotalSatang", "totalSatang", "cashReceivedSatang", "changeDueSatang", status, "soldAt", "createdAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [saleId, storeId, userId, receiptNumber, total, total, cash, cash - total, "completed", soldAt, soldAt],
    },
    ...items.map((item) => ({
      sql: 'INSERT INTO "SaleItem" (id, "saleId", "productId", "productName", quantity, "unitPriceSatang", "totalSatang") VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [randomUUID(), saleId, item.id, item.name, item.quantity, item.price, item.price * item.quantity],
    })),
    ...items.map((item) => ({
      sql: 'INSERT INTO "InventoryTransaction" (id, "productId", type, "quantityChange", "unitCostSatang", "balanceAfterChange", note, "createdByUserId", "createdAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [randomUUID(), item.id, "sale", -item.quantity, item.cost, stockById.get(item.id) ?? 0, null, userId, soldAt],
    })),
    {
      sql: 'INSERT INTO "Payment" (id, "saleId", method, "amountSatang", "createdAt") VALUES (?, ?, ?, ?, ?)',
      args: [paymentId, saleId, "cash", total, soldAt],
    },
    {
      sql: 'INSERT INTO "Receipt" (id, "saleId", content, "createdAt") VALUES (?, ?, ?, ?)',
      args: [receiptId, saleId, receiptNumber, soldAt],
    },
  ];
  await tx.batch(statements);
  await tx.rollback();
  console.log(`raw_checkout_rollback_ms=${Date.now() - startedAt}`);
} catch (error) {
  await tx.rollback();
  throw error;
} finally {
  tx.close();
  client.close();
}
