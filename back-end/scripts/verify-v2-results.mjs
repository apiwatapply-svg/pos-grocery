/**
 * Verify V2-padded barcodes and new V2 products exist in DB
 */

import 'dotenv/config'
import { createClient } from '@libsql/client'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

const TARGET = 'cmr2tjdd80000lw2psbxx4pq8'

console.log('=== Verify Padded Barcodes (1-2 → 13 digits) ===\n')
const padded = [
  { orig: '2', padded: '0000000000002', name: 'น้ำสิงห์(แพ็คเล็ก)' },
  { orig: '7', padded: '0000000000007', name: 'น้ำทิวลิป(แพ็คใหญ่)' },
  { orig: '12', padded: '0000000000012', name: 'น้ำแข็ง 10' },
  { orig: '42', padded: '0000000000042', name: 'ซองจดหมายแพ็ค' },
]
for (const p of padded) {
  const r = await client.execute({
    sql: 'SELECT id, name, barcode FROM Product WHERE storeId = ? AND barcode = ?',
    args: [TARGET, p.padded],
  })
  if (r.rows.length === 0) {
    console.log(`   ❌ ${p.orig} → ${p.padded} NOT FOUND`)
  } else {
    const row = r.rows[0]
    const match = row.name === p.name ? '✅' : '⚠️'
    console.log(`   ${match} ${p.orig} → ${p.padded} | ${row.name} (id: ${row.id})`)
  }
}

console.log('\n=== Verify Real EAN barcodes (≥3 digits) ===\n')
const real = [
  { barcode: '8851959144176', name: 'น้ำแดงใหญ่ 1.25(ขวด)' },
  { barcode: '8851959144183', name: 'น้ำเขียว ใหญ่ 1.25(ขวด)' },
]
for (const p of real) {
  const r = await client.execute({
    sql: 'SELECT id, name, barcode FROM Product WHERE storeId = ? AND barcode = ?',
    args: [TARGET, p.barcode],
  })
  if (r.rows.length === 0) {
    console.log(`   ❌ ${p.barcode} NOT FOUND`)
  } else {
    const row = r.rows[0]
    const match = row.name === p.name ? '✅' : '⚠️'
    console.log(`   ${match} ${p.barcode} | ${row.name}`)
  }
}

console.log('\n=== Verify Image coverage on new V2 products ===\n')
const imgCheck = await client.execute({
  sql: `
    SELECT
      COUNT(p.id) AS total,
      COUNT(pi.id) AS withImage
    FROM Product p
    LEFT JOIN ProductImage pi ON pi.productId = p.id
    WHERE p.storeId = ? AND p.deletedAt IS NULL
  `,
  args: [TARGET],
})
const row = imgCheck.rows[0]
const total = Number(row.total)
const withImage = Number(row.withImage)
console.log(`   Total products: ${total}`)
console.log(`   With image:     ${withImage}`)
console.log(`   Without image:  ${total - withImage}`)
console.log(`   Coverage:       ${((withImage / total) * 100).toFixed(1)}%`)

console.log('\n=== Verify no duplicate barcodes in DB ===\n')
const dupes = await client.execute({
  sql: `
    SELECT barcode, COUNT(*) as cnt
    FROM Product
    WHERE storeId = ? AND deletedAt IS NULL
    GROUP BY barcode
    HAVING cnt > 1
  `,
  args: [TARGET],
})
if (dupes.rows.length === 0) {
  console.log('   ✅ No duplicate barcodes')
} else {
  for (const d of dupes.rows) {
    console.log(`   ❌ ${d.barcode} (${d.cnt} times)`)
  }
}

console.log('\n=== Verify POS2 untouched ===\n')
const pos2 = await client.execute({
  sql: `SELECT COUNT(*) as cnt FROM Product WHERE storeId = 'cmrzlntfd0000oq2pp90vs94r' AND deletedAt IS NULL`,
  args: [],
})
console.log(`   POS2 products: ${pos2.rows[0].cnt}`)

process.exit(0)
