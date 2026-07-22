/**
 * CLI script: Wipe all product/sales/inventory data from the database.
 *
 * Keeps: Store, User
 * Wipes: Category, Product, ProductImage, InventoryTransaction,
 *        Sale, SaleItem, Payment, Receipt
 *
 * Usage:
 *   npm run db:clear
 *
 * Use this to start fresh before re-syncing products from Google Sheets.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@libsql/client";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, "..", ".env");
const envContent = readFileSync(envPath, "utf8");
for (const line of envContent.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=(.*)$/);
  if (m) {
    process.env[m[1]] = m[2].trim();
  }
}

function formatLine(char: string, length = 60): string {
  return char.repeat(length);
}

const client = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function tableCount(table: string): Promise<number> {
  try {
    const r = await client.execute(`SELECT COUNT(*) AS c FROM "${table}"`);
    const row = r.rows[0] as { c?: number | bigint } | undefined;
    if (!row) return 0;
    const value = row.c;
    if (typeof value === "bigint") return Number(value);
    return Number(value ?? 0);
  } catch {
    return 0;
  }
}

async function main() {
  console.log("⚠️  WARNING: This will wipe ALL product, sales, and inventory data.");
  console.log("   Only Store and User records will be kept.\n");

  const tablesToWipe = [
    "ProductImage",
    "InventoryTransaction",
    "Payment",
    "Receipt",
    "SaleItem",
    "Sale",
    "Product",
    "Category",
  ];

  const before: Record<string, number> = {};
  for (const t of tablesToWipe) {
    before[t] = await tableCount(t);
  }
  const storeBefore = await tableCount("Store");
  const userBefore = await tableCount("User");

  console.log("Current row counts (will be wiped):");
  for (const t of tablesToWipe) {
    console.log(`   ${t.padEnd(25)} ${before[t]}`);
  }
  console.log("");
  console.log("Will KEEP (preserved):");
  console.log(`   Store                ${storeBefore}`);
  console.log(`   User                 ${userBefore}`);
  console.log("");

  // Order matters because of FK constraints: child tables first.
  // We use individual execute() calls instead of batch() because batch
  // doesn't share a transaction in libsql for DDL/DML across tables.
  for (const t of tablesToWipe) {
    try {
      await client.execute(`DELETE FROM "${t}"`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to wipe ${t}: ${message}`);
      process.exit(1);
    }
  }

  console.log(formatLine("="));
  console.log("🗑️  WIPE SUMMARY");
  console.log(formatLine("="));
  for (const t of tablesToWipe) {
    const after = await tableCount(t);
    console.log(`   ${t.padEnd(25)} ${before[t]} → ${after}`);
  }
  const storeAfter = await tableCount("Store");
  const userAfter = await tableCount("User");
  console.log("");
  console.log(`   ${"Store".padEnd(25)} ${storeBefore} → ${storeAfter} (preserved)`);
  console.log(`   ${"User".padEnd(25)} ${userBefore} → ${userAfter} (preserved)`);
  console.log("");
  console.log("✅ Wipe complete. Store and User records preserved.");
  console.log("   Next: npm run sync:sheets  (load products from Google Sheet)");
  console.log("   Then: npm run sync:images (attach product images)");
}

main().catch((error) => {
  console.error("");
  console.error("❌ Wipe failed:");
  console.error(error instanceof Error ? error.message : String(error));
  if (error instanceof Error && error.stack) {
    console.error("");
    console.error(error.stack);
  }
  process.exit(1);
});
