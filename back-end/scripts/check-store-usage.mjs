/**
 * Store usage report — which store has data, which users belong to which store
 */

import 'dotenv/config'
import { createClient } from '@libsql/client'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

console.log('=== Store Usage Report ===\n')

// 1) All stores
const stores = await client.execute(`
  SELECT
    s.id, s.name, s.createdAt,
    (SELECT COUNT(*) FROM Product p WHERE p.storeId = s.id AND p.deletedAt IS NULL) AS activeProducts,
    (SELECT COUNT(*) FROM Product p WHERE p.storeId = s.id AND p.deletedAt IS NOT NULL) AS softDeletedProducts,
    (SELECT COUNT(*) FROM ProductImage pi JOIN Product p ON p.id = pi.productId WHERE p.storeId = s.id) AS productImages,
    (SELECT COUNT(*) FROM Category c WHERE c.storeId = s.id) AS categories,
    (SELECT COUNT(*) FROM User u WHERE u.storeId = s.id) AS userCount
  FROM Store s
  ORDER BY s.createdAt
`)

console.log('📍 Stores:')
console.log('─'.repeat(110))
for (const r of stores.rows) {
  console.log(`ID:   ${r.id}`)
  console.log(`Name: ${r.name}`)
  console.log(`Created: ${r.createdAt}`)
  console.log(`Active products:  ${r.activeProducts}`)
  console.log(`Soft-deleted:     ${r.softDeletedProducts}`)
  console.log(`Product images:   ${r.productImages}`)
  console.log(`Categories:       ${r.categories}`)
  console.log(`Users:            ${r.userCount}`)
  console.log('─'.repeat(110))
}

// 2) Users per store
console.log('\n👥 Users per store:')
const users = await client.execute(`
  SELECT
    u.id, u.username, u.displayName, u.role, u.storeId, s.name AS storeName
  FROM User u
  JOIN Store s ON s.id = u.storeId
  ORDER BY s.name, u.role, u.username
`)
let currentStore = ''
for (const r of users.rows) {
  if (r.storeName !== currentStore) {
    currentStore = r.storeName
    console.log(`\n   ${currentStore} (${r.storeId}):`)
  }
  console.log(`     - ${r.username.padEnd(15)} | ${r.displayName?.padEnd(20) || ''} | role: ${r.role}`)
}

// 3) Sales per store
console.log('\n💰 Sales per store:')
const sales = await client.execute(`
  SELECT
    s.id, s.name,
    (SELECT COUNT(*) FROM Sale sa WHERE sa.storeId = s.id) AS salesCount
  FROM Store s
`)
for (const r of sales.rows) {
  console.log(`   ${r.name}: ${r.salesCount} sales`)
}

console.log('\n=== Summary ===')
const hasProducts = stores.rows.filter((r) => r.activeProducts > 0).length
const hasUsers = stores.rows.filter((r) => r.userCount > 0).length
console.log(`Stores with products: ${hasProducts}/${stores.rows.length}`)
console.log(`Stores with users:    ${hasUsers}/${stores.rows.length}`)
