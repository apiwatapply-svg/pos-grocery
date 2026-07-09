import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[browser:${msg.type()}] ${msg.text()}`)
    }
  })

  // Login
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 15000 })
  await page.waitForTimeout(1500)
  await page.getByLabel('Username').fill('admin')
  await page.getByLabel('Password').fill('admin')
  await page.getByRole('button', { name: 'Login' }).click()
  await page.waitForURL((url) => url.pathname.startsWith('/pos') || url.pathname.startsWith('/inventory'), { timeout: 15000 })
  await page.waitForTimeout(2000)

  // Get a real barcode
  const productsList = await page.evaluate(async () => {
    const session = JSON.parse(localStorage.getItem('pos-grocery:session') ?? '{}')
    const response = await fetch('http://localhost:8787/api/products?view=operation', {
      headers: { Authorization: `Bearer ${session.token ?? ''}` },
    })
    return response.ok ? response.json() : null
  })
  const barcode = productsList?.data?.[0]?.barcode
  console.log('Using barcode:', barcode)
  if (!barcode) {
    await browser.close()
    return
  }

  const scanInput = page.locator('#pos-product-query')

  // === TEST 1: SCAN (fast) ===
  console.log('\n=== TEST 1: SCAN (fast) ===')
  await scanInput.focus()
  // Simulate scanner: type fast then Enter
  await page.keyboard.type(barcode, { delay: 10 })
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)

  const scanActiveId = await page.evaluate(() => document.activeElement?.id)
  const scanActiveLabel = await page.evaluate(() => {
    const el = document.activeElement
    return el?.getAttribute('aria-label') ?? el?.getAttribute('placeholder') ?? null
  })
  console.log('After scan+Enter, active id:', scanActiveId)
  console.log('After scan+Enter, active label:', scanActiveLabel)
  console.log('Expected: pos-product-query (สแกนหรือค้นหาสินค้า)')
  console.log('Result:', scanActiveId === 'pos-product-query' ? 'PASS - focus stays on scan field' : 'FAIL - focus moved')

  // Clear cart
  await page.locator('button[aria-label="ลบสินค้าทั้งหมดในตะกร้า"]').click().catch(() => {})
  await page.waitForTimeout(300)
  const confirmBtn = page.locator('.swal2-confirm')
  if (await confirmBtn.count() > 0) {
    await confirmBtn.click()
    await page.waitForTimeout(500)
  }

  // === TEST 2: MANUAL TYPE (slow) ===
  console.log('\n=== TEST 2: MANUAL TYPE (slow) ===')
  await scanInput.focus()
  // Type slowly (200ms per char) then Enter
  await page.keyboard.type(barcode, { delay: 200 })
  await page.waitForTimeout(500) // pause before Enter
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)

  const manualActiveId = await page.evaluate(() => document.activeElement?.id)
  const manualActiveLabel = await page.evaluate(() => {
    const el = document.activeElement
    return el?.getAttribute('aria-label') ?? el?.getAttribute('placeholder') ?? null
  })
  console.log('After manual+Enter, active id:', manualActiveId)
  console.log('After manual+Enter, active label:', manualActiveLabel)
  console.log('Expected: จำนวนเงินที่รับ (cash input) if cart has items')
  console.log('Result:', manualActiveLabel === 'จำนวนเงินที่รับ' ? 'PASS - focus moved to cash input' : 'FAIL - focus did not move to cash')

  // Clear cart before next test
  await page.locator('button[aria-label="ลบสินค้าทั้งหมดในตะกร้า"]').click().catch(() => {})
  await page.waitForTimeout(300)
  if (await confirmBtn.count() > 0) {
    await confirmBtn.click()
    await page.waitForTimeout(500)
  }

  // === TEST 3: SLOW SCANNER (100ms/char, consistent) ===
  // Some barcode scanners are configured at ~100ms per character. With a
  // pure absolute interval threshold (e.g. 150ms) the old detector would
  // still catch this, but a real-world 110-130ms per char scanner (e.g.
  // wireless handheld units) would be misclassified. The variance-based
  // detector should still recognise this as a scanner because the gap
  // between consecutive intervals is < 50ms.
  console.log('\n=== TEST 3: SLOW SCANNER (100ms/char) ===')
  await scanInput.focus()
  await page.keyboard.type(barcode, { delay: 100 })
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)

  const slowScanActiveId = await page.evaluate(() => document.activeElement?.id)
  const slowScanActiveLabel = await page.evaluate(() => {
    const el = document.activeElement
    return el?.getAttribute('aria-label') ?? el?.getAttribute('placeholder') ?? null
  })
  console.log('After slow scan+Enter, active id:', slowScanActiveId)
  console.log('After slow scan+Enter, active label:', slowScanActiveLabel)
  console.log('Expected: pos-product-query (สแกนหรือค้นหาสินค้า)')
  console.log('Result:', slowScanActiveId === 'pos-product-query' ? 'PASS - focus stays on scan field' : 'FAIL - focus moved')

  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
