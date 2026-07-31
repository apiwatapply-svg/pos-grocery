import 'dotenv/config'
import { createClient } from '@libsql/client'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

console.log('=== CURRENT DB STATE (BEFORE PHASE 12) ===\n')

const stores = await client.execute(`SELECT id, name, createdAt FROM Store ORDER BY createdAt`)
console.log(`📍 Stores (${stores.rows.length}):`)
for (const s of stores.rows) {
  console.log(`   ${s.id} | ${s.name}`)
}
console.log('')

const counts = await client.execute(`
  SELECT
    s.id AS storeId,
    s.name AS storeName,
    COUNT(p.id) AS totalProducts,
    COUNT(CASE WHEN p.deletedAt IS NULL THEN 1 END) AS activeProducts,
    COUNT(CASE WHEN p.deletedAt IS NOT NULL THEN 1 END) AS softDeletedProducts,
    COUNT(CASE WHEN p.id IN (SELECT productId FROM ProductImage) THEN 1 END) AS withImages
  FROM Store s
  LEFT JOIN Product p ON p.storeId = s.id
  GROUP BY s.id, s.name
  ORDER BY s.createdAt
`)
console.log('📊 Products by Store:')
for (const r of counts.rows) {
  console.log(`   ${r.storeName} (${r.storeId})`)
  console.log(`     Total: ${r.totalProducts} | Active: ${r.activeProducts} | SoftDeleted: ${r.softDeletedProducts} | WithImages: ${r.withImages}`)
}
console.log('')

const targetStore = 'cmr2tjdd80000lw2psbxx4pq8'
const target = await client.execute(`SELECT id, name FROM Store WHERE id = '${targetStore}'`)
if (target.rows.length === 0) {
  console.log(`❌ Target store ${targetStore} not found`)
} else {
  console.log(`✅ Target store: ${target.rows[0].name} (${target.rows[0].id})`)
}
console.log('')

const images = await client.execute(`SELECT COUNT(*) AS total FROM ProductImage`)
console.log(`🖼️  Total ProductImage rows: ${images.rows[0].total}`)
