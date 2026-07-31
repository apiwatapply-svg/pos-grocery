/**
 * Dry-run: parse V2 sheet using the actual production mapper code
 * and report exactly which products will be inserted, which will be
 * skipped, and which barcode will be padded.
 *
 * Does NOT touch the database. Read-only verification.
 */

import 'dotenv/config'
import { env } from '../src/config/env.js'
import { fetchSheetsDrafts } from '../src/modules/products/google-sheets.service.js'
import { createClient } from '@libsql/client'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

const TARGET_STORE = 'cmr2tjdd80000lw2psbxx4pq8'

console.log('🧪 DRY-RUN: parse V2 sheet using production mapper code\n')
console.log(`Sheet URL: ${env.GOOGLE_SHEETS_CSV_URL}\n`)

const drafts = await fetchSheetsDrafts()
console.log(`📦 Parsed drafts: ${drafts.length}\n`)

const dbRows = await client.execute(
  `SELECT barcode FROM Product WHERE storeId = '${TARGET_STORE}'`,
)
const dbBarcodes = new Set(dbRows.rows.map((r) => r.barcode))
console.log(`📊 Existing barcodes in DB: ${dbBarcodes.size}\n`)

let willCreate = 0
let willSkip = 0
let willPad = 0
const padded = []
const toCreate = []

for (const draft of drafts) {
  if (dbBarcodes.has(draft.barcode)) {
    willSkip += 1
  } else {
    willCreate += 1
    toCreate.push(draft)
  }
}

// Detect padded barcodes (originally 1-2 digits, now 13 digits)
const paddedRegex = /^0{11,12}\d{1,2}$/
for (const draft of toCreate) {
  if (paddedRegex.test(draft.barcode) && draft.barcode.length === 13) {
    willPad += 1
    padded.push(draft)
  }
}

console.log('=== DRY-RUN RESULTS ===')
console.log(`Will CREATE: ${willCreate}`)
console.log(`Will SKIP:   ${willSkip}`)
console.log(`Of CREATE, will pad barcode 1-2 → 13: ${willPad}`)
console.log('')

if (willCreate > 0) {
  console.log(`=== SAMPLE OF NEW PRODUCTS (first 10) ===`)
  for (const draft of toCreate.slice(0, 10)) {
    console.log(`  row ${draft.rowNumber} | ${draft.barcode} | ${draft.name}`)
  }
  console.log('')
}

if (padded.length > 0) {
  console.log(`=== PADDED BARCODES (1-2 → 13 digits) ===`)
  for (const draft of padded) {
    const num = Number(draft.barcode).toString()
    console.log(`  ${num.padStart(2)} → ${draft.barcode} | row ${draft.rowNumber} | ${draft.name}`)
  }
  console.log('')
}

// Internal duplicate check
const seenBarcodes = new Map()
let internalDuplicates = 0
for (const draft of drafts) {
  if (seenBarcodes.has(draft.barcode)) {
    internalDuplicates += 1
    console.log(`   ⚠ internal duplicate: ${draft.barcode} (rows ${seenBarcodes.get(draft.barcode)} & ${draft.rowNumber})`)
  } else {
    seenBarcodes.set(draft.barcode, draft.rowNumber)
  }
}
if (internalDuplicates === 0) {
  console.log('✅ No internal duplicates in V2')
} else {
  console.log(`❌ ${internalDuplicates} internal duplicates found`)
}

console.log('\n✅ Dry-run complete. No changes made to database.')
process.exit(0)
