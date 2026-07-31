/**
 * Verify image URLs in Cloudinary are accessible
 * (sanity check that the uploaded images actually resolve)
 */

import 'dotenv/config'

const BASE = 'http://localhost:8787'

async function main() {
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
  const token = loginData.data?.token

  const productsRes = await fetch(`${BASE}/api/products?storeId=cmr2tjdd80000lw2psbxx4pq8&pageSize=10`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const productsData = await productsRes.json()
  const items = productsData.data ?? []

  console.log('🖼️  Verifying image URLs (sample of 10)...\n')
  let ok = 0
  let fail = 0
  for (const p of items.slice(0, 10)) {
    const img = p.images?.[0]
    if (!img) {
      console.log(`   ⬜ ${p.name} (no image)`)
      continue
    }
    try {
      const r = await fetch(img.secureUrl, { method: 'HEAD' })
      if (r.ok) {
        console.log(`   ✅ ${p.name}`)
        console.log(`      ${img.secureUrl.slice(0, 80)}...`)
        ok += 1
      } else {
        console.log(`   ❌ ${p.name} (HTTP ${r.status})`)
        fail += 1
      }
    } catch (e) {
      console.log(`   ❌ ${p.name} (${e.message})`)
      fail += 1
    }
  }

  console.log(`\n📊 Result: ${ok} OK / ${fail} fail (out of 10 samples)`)
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
