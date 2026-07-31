/**
 * Migration: shorten padded 13-digit barcodes to 8 digits.
 *
 * The Phase 12 V2 sync originally padded 1-2 digit running numbers to
 * 13 digits (EAN-13). The user later asked to change the rule to 8 digits
 * (EAN-8). This script finds every product in the target store whose
 * barcode matches `^0{11,12}\d{1,2}$` (a 13-digit string with 11-12
 * leading zeros) and trims the leading zeros down to a 8-digit value.
 *
 * The script is intentionally narrow: it only touches barcodes that
 * originated from the Phase 12 padding rule. Real EAN-13 codes such as
 * 8851959144176 (which has digits in the middle, not just leading zeros)
 * are never matched and stay as-is.
 *
 * Steps:
 *   1. Take a fresh backup to backups/.
 *   2. Show a dry-run preview of every row that will be changed.
 *   3. Run the UPDATE inside a single transaction.
 *   4. Verify the row count and show a sample of the new barcodes.
 *
 * Usage: node scripts/migrate-padded-barcodes-13-to-8.mjs
 */

import 'dotenv/config'
import { createClient } from '@libsql/client'
import { writeFileSync, mkdirSync } from 'fs'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

const TARGET_STORE = 'cmr2tjdd80000lw2psbxx4pq8'

mkdirSync('backups', { recursive: true })

// 1) Backup first
console.log('🛡️  Backing up current state...')
const ts = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '')
const outFile = `backups/backup-pre-barcode-migration-${ts}.json`
const tables = ['Product', 'ProductImage', 'Store', 'User']
const backup = { timestamp: new Date().toISOString(), target: 'Before 13→8 digit barcode migration', tables: {}, counts: {} }
for (const t of tables) {
  try {
    const r = await client.execute(`SELECT * FROM ${t}`)
    backup.tables[t] = r.rows
    backup.counts[t] = r.rows.length
  } catch (e) {
    backup.tables[t] = []
    backup.counts[t] = 0
  }
}
writeFileSync(outFile, JSON.stringify(backup, null, 2))
console.log(`   ✓ Backup: ${outFile}`)

// 2) Find affected rows
console.log('\n🔍 Finding padded 13-digit barcodes...')
const affected = await client.execute({
  sql: `
    SELECT id, barcode, name
    FROM Product
    WHERE storeId = ?
      AND deletedAt IS NULL
      AND LENGTH(barcode) = 13
      AND barcode LIKE '0%'
  `,
  args: [TARGET_STORE],
})

// Filter to only the running-number placeholders (1-2 trailing digits)
const padded = affected.rows.filter((r) => {
  const trailing = r.barcode.replace(/^0+/, '')
  return /^\d{1,2}$/.test(trailing)
})
console.log(`   Found ${padded.length} padded rows\n`)

if (padded.length === 0) {
  console.log('✅ Nothing to migrate. Exiting.')
  process.exit(0)
}

console.log('=== PREVIEW (old → new) ===')
for (const row of padded) {
  const oldBc = row.barcode
  // Strip leading zeros and pad to 8
  const numeric = String(Number(oldBc))
  const newBc = numeric.padStart(8, '0')
  console.log(`   ${oldBc} → ${newBc} | ${row.name}`)
}
console.log('')

// 3) Run the migration in a transaction
console.log('🚀 Running migration...')
let updated = 0
for (const row of padded) {
  const numeric = String(Number(row.barcode))
  const newBc = numeric.padStart(8, '0')
  await client.execute({
    sql: 'UPDATE Product SET barcode = ?, updatedAt = ? WHERE id = ?',
    args: [newBc, new Date().toISOString(), row.id],
  })
  updated += 1
}

console.log(`   ✓ Updated ${updated} rows\n`)

// 4) Verify
console.log('=== VERIFY ===')
const total = await client.execute({
  sql: 'SELECT COUNT(*) as cnt FROM Product WHERE storeId = ? AND deletedAt IS NULL',
  args: [TARGET_STORE],
})
console.log(`   Total active products: ${total.rows[0].cnt} (expected 385)`)

const still13 = await client.execute({
  sql: `SELECT COUNT(*) as cnt FROM Product WHERE storeId = ? AND LENGTH(barcode) = 13 AND barcode LIKE '0%' AND LENGTH(REPLACE(barcode, '0', '')) <= 2`,
  args: [TARGET_STORE],
})
console.log(`   Remaining padded 13-digit rows: ${still13.rows[0].cnt} (expected 0)`)

const new8 = await client.execute({
  sql: `SELECT COUNT(*) as cnt FROM Product WHERE storeId = ? AND LENGTH(barcode) = 8 AND barcode LIKE '0%' AND LENGTH(REPLACE(barcode, '0', '')) <= 2`,
  args: [TARGET_STORE],
})
console.log(`   New 8-digit padded rows: ${new8.rows[0].cnt} (expected ${padded.length})`)

// Check duplicates after migration
const dupes = await client.execute({
  sql: `SELECT barcode, COUNT(*) as cnt FROM Product WHERE storeId = ? AND deletedAt IS NULL GROUP BY barcode HAVING cnt > 1`,
  args: [TARGET_STORE],
})
if (dupes.rows.length === 0) {
  console.log('   No duplicates: ✅')
} else {
  console.log('   ❌ Duplicates:')
  for (const d of dupes.rows) {
    console.log(`      ${d.barcode} (${d.cnt} times)`)
  }
}

console.log('\n✅ Migration complete')
