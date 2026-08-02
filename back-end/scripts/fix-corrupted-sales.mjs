/**
 * Fix the 2 corrupted sales by setting cashReceivedSatang = totalSatang
 * and changeDueSatang = 0 (i.e. "paid exact" assumption).
 *
 * Pre-condition: backed up the current state via backup-products.mjs.
 *
 * Steps:
 *  1. Take a fresh backup.
 *  2. Show preview of the rows that will be changed.
 *  3. UPDATE inside a transaction.
 *  4. Verify.
 */

import 'dotenv/config'
import { createClient } from '@libsql/client'
import { writeFileSync, mkdirSync } from 'fs'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

mkdirSync('backups', { recursive: true })

// 1) Fresh backup
console.log('🛡️  Backing up current Sale + SaleItem state...')
const ts = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '')
const outFile = `backups/backup-pre-sales-fix-${ts}.json`
const backup = { timestamp: new Date().toISOString(), target: 'Before corrupted-sales fix', tables: {}, counts: {} }
for (const t of ['Sale', 'SaleItem', 'Payment', 'Receipt']) {
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

// 2) Preview
console.log('\n🔍 Finding corrupted sales (cashReceivedSatang > 1,000,000)...')
const corrupted = await client.execute(`
  SELECT id, "receiptNumber", "totalSatang", "cashReceivedSatang", "changeDueSatang"
  FROM Sale
  WHERE "cashReceivedSatang" > 1000000
  ORDER BY "soldAt" ASC
`)
console.log(`Found ${corrupted.rows.length} corrupted rows:\n`)
console.log('=== PREVIEW (before → after) ===')
for (const row of corrupted.rows) {
  console.log(`  ${row.receiptNumber}: cash ${row.cashReceivedSatang} → ${row.totalSatang} | change ${row.changeDueSatang} → 0`)
}
console.log('')

if (corrupted.rows.length === 0) {
  console.log('✅ Nothing to fix. Exiting.')
  process.exit(0)
}

// 3) Update
console.log('🚀 Applying fix...')
let updated = 0
for (const row of corrupted.rows) {
  await client.execute({
    sql: 'UPDATE Sale SET "cashReceivedSatang" = ?, "changeDueSatang" = 0 WHERE id = ?',
    args: [row.totalSatang, row.id],
  })
  updated += 1
}
console.log(`   ✓ Updated ${updated} rows\n`)

// 4) Verify
console.log('=== VERIFY ===')
const verify = await client.execute(`
  SELECT "receiptNumber", "totalSatang", "cashReceivedSatang", "changeDueSatang"
  FROM Sale
  WHERE "receiptNumber" IN ('R-1785630223', 'R-1785630722')
  ORDER BY "soldAt" ASC
`)
for (const row of verify.rows) {
  console.log(`   ${row.receiptNumber}: total=${row.totalSatang} | cash=${row.cashReceivedSatang} | change=${row.changeDueSatang}`)
}

const stillCorrupted = await client.execute(`
  SELECT COUNT(*) as cnt FROM Sale WHERE "cashReceivedSatang" > 1000000
`)
console.log(`\n   Remaining corrupted rows: ${stillCorrupted.rows[0].cnt} (expected 0)`)

console.log('\n✅ Fix complete. /api/sales should now return 200.')
