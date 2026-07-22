/**
 * CLI script: Sync products from Google Sheets to SQL
 *
 * Usage:
 *   npm run sync:sheets              # sync to first available store
 *   npm run sync:sheets <storeId>    # sync to specific store
 *
 * Required env: GOOGLE_SHEETS_CSV_URL
 * The sheet must be shared with "Anyone with the link = Editor"
 *
 * Behavior:
 *   1. Fetch CSV from public Google Sheet export URL
 *   2. Parse + validate each row
 *   3. Snapshot existing stockQuantity (keyed by barcode)
 *   4. Soft-delete all active products in the store
 *   5. Insert new products from drafts
 *   6. Restore stockQuantity for matching barcodes
 *   7. Print summary
 */

import { env } from "../src/config/env.js";
import { defaultUserRepository } from "../src/modules/users/user.repository.js";
import { fetchSheetsDrafts } from "../src/modules/products/google-sheets.service.js";

function formatLine(char: string, length = 60): string {
  return char.repeat(length);
}

async function main(): Promise<void> {
  console.log("🔄 Starting product sync from Google Sheet...\n");

  if (!env.GOOGLE_SHEETS_CSV_URL) {
    console.error("❌ GOOGLE_SHEETS_CSV_URL is not set in .env");
    console.error("   Please add it to back-end/.env before running this script.");
    process.exit(1);
  }

  console.log(`📊 Sheet URL: ${env.GOOGLE_SHEETS_CSV_URL}\n`);

  // Step 1: Fetch + parse
  console.log("1️⃣  Fetching CSV from Google Sheet...");
  const drafts = await fetchSheetsDrafts();
  console.log(`   ✓ Parsed ${drafts.length} products\n`);

  if (drafts.length === 0) {
    console.log("⚠️  Sheet is empty. Nothing to sync.");
    process.exit(0);
  }

  // Step 2: Determine target store
  const targetStoreId = process.argv[2];
  let resolvedStoreId: string;

  if (targetStoreId) {
    resolvedStoreId = targetStoreId;
    console.log(`2️⃣  Using store from CLI arg: ${resolvedStoreId}\n`);
  } else {
    const stores = await defaultUserRepository.listStores();
    if (stores.length === 0) {
      console.error("❌ No stores found in database");
      process.exit(1);
    }
    if (stores.length > 1) {
      console.log(`⚠️  Multiple stores found. Using first one: ${stores[0]!.id}`);
      console.log("   To target a specific store, run: npm run sync:sheets <storeId>\n");
    }
    resolvedStoreId = stores[0]!.id;
  }

  // Step 3: Sync to DB
  console.log(`3️⃣  Syncing ${drafts.length} products to store ${resolvedStoreId}...`);
  const summary = await defaultUserRepository.googleSheetsSync({
    storeId: resolvedStoreId,
    userId: "system",
    drafts,
  });

  // Step 4: Print summary
  console.log("");
  console.log(formatLine("="));
  console.log("📋 SYNC SUMMARY");
  console.log(formatLine("="));
  console.log(`Total rows in sheet:       ${summary.total}`);
  console.log(`Products soft-deleted:     ${summary.deleted}`);
  console.log(`Products created:          ${summary.created}`);
  console.log(`Failed:                    ${summary.total - summary.created}`);

  const failed = summary.results.filter((r) => r.status === "failed");
  if (failed.length > 0) {
    console.log("\n❌ FAILED ROWS:");
    for (const row of failed) {
      console.log(`   Row ${row.rowNumber}: ${row.barcode} - ${row.error ?? "unknown error"}`);
    }
  }

  console.log("");
  console.log("✅ Sync completed successfully");
}

main().catch((error) => {
  console.error("");
  console.error("❌ Sync failed:");
  console.error(error instanceof Error ? error.message : String(error));
  if (error instanceof Error && error.stack) {
    console.error("");
    console.error("Stack trace:");
    console.error(error.stack);
  }
  process.exit(1);
});
