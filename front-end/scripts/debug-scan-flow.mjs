import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  page.on('console', (msg) => {
    console.log(`[browser:${msg.type()}] ${msg.text()}`)
  })
  page.on('pageerror', (err) => {
    console.log(`[browser:error] ${err.message}`)
  })

  // Login first
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 15000 })
  await page.waitForTimeout(1500)
  await page.getByLabel('Username').fill('admin')
  await page.getByLabel('Password').fill('admin')
  await page.getByRole('button', { name: 'Login' }).click()
  await page.waitForURL((url) => url.pathname.startsWith('/pos') || url.pathname.startsWith('/inventory'), { timeout: 15000 })
  await page.waitForTimeout(2000)

  console.log('--- After login ---')
  console.log('URL:', page.url())

  const scanInput = page.locator('#pos-product-query')
  const scanInputCount = await scanInput.count()
  console.log('Scan input count:', scanInputCount)
  if (scanInputCount === 0) {
    console.log('Body text (first 500 chars):', (await page.textContent('body'))?.slice(0, 500))
    await browser.close()
    return
  }

  await scanInput.focus()
  console.log('Initial focus on scan input:', await page.evaluate(() => document.activeElement?.id))

  // Simulate a barcode scanner: type all characters fast then a single Enter.
  // First, query the API to find a real product to scan.
  const productsList = await page.evaluate(async () => {
    const response = await fetch('http://localhost:8787/api/products?view=operation', {
      headers: { Authorization: `Bearer ${localStorage.getItem('pos-grocery:session') ? JSON.parse(localStorage.getItem('pos-grocery:session')).token : ''}` },
    })
    return response.ok ? response.json() : null
  })
  console.log('Products API result:', JSON.stringify(productsList)?.slice(0, 500))
  const firstBarcode = productsList?.data?.[0]?.barcode
  console.log('Using barcode:', firstBarcode)
  if (!firstBarcode) {
    await browser.close()
    return
  }
  await scanInput.fill(firstBarcode)
  await scanInput.press('Enter')
  await page.waitForTimeout(500)

  // Snapshot: any swal open? any cart row? any product in DOM?
  const swalOpen = await page.locator('.swal2-container').count()
  const pageText = (await page.textContent('body'))?.slice(0, 1500) ?? ''
  console.log('--- Page snapshot ---')
  console.log('Swal open:', swalOpen)
  console.log('Page text:', pageText)
  console.log('---')

  const activeId = await page.evaluate(() => document.activeElement?.id)
  const activeTag = await page.evaluate(() => document.activeElement?.tagName)
  const activeLabel = await page.evaluate(() => {
    const el = document.activeElement
    return el?.getAttribute('aria-label') ?? el?.getAttribute('placeholder') ?? null
  })
  const cartRowCount = await page
    .locator('[role="table"][aria-label="รายการสินค้าในตะกร้า"] tbody tr')
    .count()
    .catch(() => 0)
  const cartQuantity = await page
    .getByLabel('จำนวน Drinking Water')
    .textContent()
    .catch(() => null)

  console.log('--- After scan + Enter ---')
  console.log('Active element id:', activeId)
  console.log('Active element tag:', activeTag)
  console.log('Active element label:', activeLabel)
  console.log('Cart row count:', cartRowCount)
  console.log('Cart quantity:', cartQuantity)
  console.log('Scan input value:', await scanInput.inputValue())

  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
