/**
 * API sanity check: login + GET /api/products
 */

import 'dotenv/config'

const BASE = 'http://localhost:8787'

async function main() {
  console.log('🔐 Login as store_admin...')
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storeId: 'cmr2tjdd80000lw2psbxx4pq8',
      username: 'storeadmin',
      password: 'Test1234',
    }),
  })
  const loginData = await loginRes.json()
  if (!loginRes.ok) {
    console.error('❌ Login failed:', loginData)
    process.exit(1)
  }
  const token = loginData.data?.token
  console.log('   ✓ Login OK (role:', loginData.data?.user?.role, ')')

  console.log('\n📦 GET /api/products...')
  const productsRes = await fetch(`${BASE}/api/products?storeId=cmr2tjdd80000lw2psbxx4pq8&pageSize=5`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const productsData = await productsRes.json()
  if (!productsRes.ok) {
    console.error('❌ Get products failed:', productsData)
    process.exit(1)
  }
  console.log('   ✓ Status:', productsRes.status)
  const items = productsData.data ?? []
  console.log('   ✓ Total products:', items.length)
  console.log('   ✓ Sample (first 5):')
  for (const p of items.slice(0, 5)) {
    const hasImage = p.images?.length > 0 ? '🖼️' : '⬜'
    console.log(`     ${hasImage} ${p.name} (${p.barcode})`)
  }

  console.log('\n🔍 Count products with images vs without...')
  const withImage = items.filter((p) => p.images?.length > 0).length
  const withoutImage = items.length - withImage
  console.log(`   With image: ${withImage} | Without: ${withoutImage}`)

  console.log('\n🔍 GET /api/products?barcode=0000000000007 (padded barcode)...')
  const lookup = await fetch(`${BASE}/api/products?storeId=cmr2tjdd80000lw2psbxx4pq8&barcode=0000000000007`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const lookupData = await lookup.json()
  if (!lookup.ok) {
    console.error('❌ Lookup failed:', lookupData)
  } else {
    const found = lookupData.data?.[0] ?? lookupData.data
    console.log('   ✓ Found:', found?.name, '(barcode:', found?.barcode, ')')
  }
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
