/**
 * Backup script: dump all Product + related tables to JSON for restore
 * if anything goes wrong during Phase 12.
 *
 * Usage:
 *   node scripts/backup-products.mjs
 *
 * Output:
 *   backups/backup-products-YYYYMMDD-HHMMSS.json
 */

import 'dotenv/config'
import { createClient } from '@libsql/client'
import { writeFileSync, mkdirSync } from 'fs'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

mkdirSync('backups', { recursive: true })

const ts = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '')
const outFile = `backups/backup-products-${ts}.json`

console.log('🛡️  Starting backup of POS Grocery products...\n')

const tables = [
  'SELECT * FROM Product ORDER BY createdAt',
  'SELECT * FROM ProductImage ORDER BY createdAt',
  'SELECT * FROM Category ORDER BY createdAt',
  'SELECT * FROM InventoryTransaction ORDER BY createdAt',
  'SELECT * FROM Sale ORDER BY createdAt',
  'SELECT * FROM SaleItem ORDER BY createdAt',
  'SELECT * FROM Payment ORDER BY createdAt',
  'SELECT * FROM Receipt ORDER BY createdAt',
  'SELECT * FROM Store ORDER BY createdAt',
  'SELECT * FROM User ORDER BY createdAt',
]

const backup = {
  timestamp: new Date().toISOString(),
  target: 'Backup of all relevant POS Grocery tables before Phase 12 (V2 Products Sync)',
  tables: {},
  counts: {},
}

for (const sql of tables) {
  const tableName = sql.match(/FROM\s+(\w+)/i)[1]
  try {
    const result = await client.execute(sql)
    backup.tables[tableName] = result.rows
    backup.counts[tableName] = result.rows.length
    console.log(`   ✓ ${tableName}: ${result.rows.length} rows`)
  } catch (e) {
    console.log(`   ⚠ ${tableName}: ${e.message}`)
    backup.tables[tableName] = []
    backup.counts[tableName] = 0
  }
}

writeFileSync(outFile, JSON.stringify(backup, null, 2))

console.log(`\n✅ Backup written to: ${outFile}`)
console.log(`   File size: ${(JSON.stringify(backup).length / 1024).toFixed(1)} KB`)
