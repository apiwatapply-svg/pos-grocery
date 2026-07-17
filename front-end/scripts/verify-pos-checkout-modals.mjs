// Verify all POS Swal-driven modals do not overflow on desktop or iPad.
// Captures the checkout confirmation modal and the sale success modal at
// multiple viewports.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const URL = 'http://localhost:5173/pos'
const OUT_DIR = resolve(process.cwd(), 'screenshots')
mkdirSync(OUT_DIR, { recursive: true })

const SESSION = {
  token: 'ui-audit-token',
  user: {
    id: 'user-1',
    username: 'admin',
    displayName: 'Admin',
    role: 'admin',
  },
}

const PRODUCTS = [
  {
    id: 'product-water',
    name: 'Drinking Water 600ml.',
    barcode: '8850002000010',
    images: [],
    salePriceSatang: 700,
    stockQuantity: 25,
    status: 'active',
  },
  {
    id: 'product-noodle',
    name: 'Instant Noodles Pack (Family Size) - Tom Yum Flavor',
    barcode: '8850001000011',
    images: [],
    salePriceSatang: 1200,
    stockQuantity: 40,
    status: 'active',
  },
  {
    id: 'product-rice',
    name: 'Premium Jasmine Rice 5 kg.',
    barcode: '8850003000012',
    images: [],
    salePriceSatang: 22500,
    stockQuantity: 15,
    status: 'active',
  },
  {
    id: 'product-coffee',
    name: 'Premium Roasted Coffee Beans 250g - Single Origin Chiang Mai',
    barcode: '8850004000013',
    images: [],
    salePriceSatang: 18900,
    stockQuantity: 12,
    status: 'active',
  },
]

const viewports = [
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'desktop-1366', width: 1366, height: 768 },
  { name: 'ipad-mini-768', width: 768, height: 1024 },
  { name: 'ipad-820-portrait', width: 820, height: 1180 },
  { name: 'ipad-1180-landscape', width: 1180, height: 820 },
  { name: 'mobile-375', width: 375, height: 740 },
]

function buildProductsResponse() {
  return { success: true, data: PRODUCTS }
}

function buildStoreResponse() {
  return {
    success: true,
    data: {
      id: 'store-1',
      name: 'POS Grocery',
      phone: '0800000000',
      address: 'Bangkok',
      logoUrl: 'https://example.com/pos-logo.png',
      status: 'active',
    },
  }
}

function buildSalesResponse() {
  return { success: true, data: [] }
}

function buildCheckoutResponse() {
  return {
    success: true,
    data: {
      id: 'sale-1',
      receiptNumber: 'RC20260716-1000000000001',
      soldAt: '2026-07-16T10:00:00.000Z',
      totalSatang: 22600,
      cashReceivedSatang: 50000,
      changeDueSatang: 27400,
      status: 'completed',
    },
  }
}

async function waitForCheckoutSwal(page) {
  await page.waitForSelector('.swal2-popup', { timeout: 5000 })
  // Wait until the table inside the Swal is rendered.
  await page.waitForSelector('.swal2-popup table', { timeout: 5000 })
  // Wait for the swal2-popup to be fully visible (opacity 1, no transitions).
  await page.waitForFunction(
    () => {
      const popup = document.querySelector('.swal2-popup')
      if (!popup) return false
      const style = window.getComputedStyle(popup)
      return parseFloat(style.opacity) > 0.99
    },
    { timeout: 5000 },
  )
  // Add a small extra wait to ensure transitions are done.
  await page.waitForTimeout(300)
}

async function waitForSaleSuccessSwal(page) {
  // The sale success Swal uses icon='success' and a green confirm button.
  await page.waitForFunction(
    () => {
      const popup = document.querySelector('.swal2-popup')
      if (!popup) return false
      const icon = popup.querySelector('.swal2-icon.swal2-success')
      const table = popup.querySelector('table')
      return Boolean(icon && table)
    },
    { timeout: 10000 },
  )
  // Wait for full opacity.
  await page.waitForFunction(
    () => {
      const popup = document.querySelector('.swal2-popup')
      if (!popup) return false
      const style = window.getComputedStyle(popup)
      return parseFloat(style.opacity) > 0.99
    },
    { timeout: 5000 },
  )
  await page.waitForTimeout(300)
}

async function measureOverflow(page, selector) {
  return await page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const swalPopup = document.querySelector('.swal2-popup')
    const popupRect = swalPopup ? swalPopup.getBoundingClientRect() : null
    const popupStyle = swalPopup ? window.getComputedStyle(swalPopup) : null
    const backdrop = document.querySelector('.swal2-backdrop-show, .swal2-container')
    const backdropStyle = backdrop ? window.getComputedStyle(backdrop) : null
    return {
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      offsetWidth: el.offsetWidth,
      right: rect.right,
      width: rect.width,
      popupWidth: popupRect ? popupRect.width : null,
      popupRight: popupRect ? popupRect.right : null,
      popupBg: popupStyle ? popupStyle.backgroundColor : null,
      popupOpacity: popupStyle ? popupStyle.opacity : null,
      popupDisplay: popupStyle ? popupStyle.display : null,
      backdropBg: backdropStyle ? backdropStyle.backgroundColor : null,
      backdropOpacity: backdropStyle ? backdropStyle.opacity : null,
      windowWidth: window.innerWidth,
    }
  }, selector)
}

async function snapshotModal(page, file) {
  const overflow = await measureOverflow(page, '.swal2-popup')
  console.log(`  overflow:`, JSON.stringify(overflow))
  await page.screenshot({ path: file, fullPage: false })
}

const browser = await chromium.launch({ headless: true })
for (const vp of viewports) {
  console.log(`\n=== ${vp.name} (${vp.width}x${vp.height}) ===`)
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dsf ?? 1,
  })

  let postCount = 0
  await context.route('**', (route) => {
    const req = route.request()
    const method = req.method()
    const url = req.url()
    if (!url.includes('localhost:8787')) {
      return route.continue()
    }
    console.log(`  [stub] ${method} ${url}`)
    if (url.includes('/api/store/current')) {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(buildStoreResponse()),
      })
    }
    if (url.includes('/api/products') && method === 'GET') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(buildProductsResponse()),
      })
    }
    if (url.includes('/api/sales') && method === 'GET') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(buildSalesResponse()),
      })
    }
    if (url.includes('/api/sales/checkout') && method === 'POST') {
      postCount += 1
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(buildCheckoutResponse()),
      })
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: null }),
    })
  })

  await context.addInitScript(
    ({ sessionJSON, storeId }) => {
      localStorage.setItem('pos-grocery:session', sessionJSON)
      localStorage.removeItem(`pos-grocery:held-bills:${storeId}`)
      localStorage.removeItem('pos-grocery:pos-cart:store-1')
    },
    { sessionJSON: JSON.stringify(SESSION), storeId: 'store-1' },
  )

  const page = await context.newPage()
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('  [console.error]', msg.text())
    }
  })
  page.on('requestfailed', (req) => {
    console.log('  [requestfailed]', req.url(), req.failure()?.errorText)
  })
  page.on('request', (req) => {
    if (req.url().includes('localhost:8787')) {
      console.log(`  [request] ${req.method()} ${req.url()}`)
    }
  })
  page.on('response', async (res) => {
    const url = res.url()
    if (url.includes('localhost:8787') || url.includes('/api/')) {
      try {
        const body = await res.text()
        const truncated = body.length > 200 ? `${body.slice(0, 200)}...` : body
        console.log(`  [response] ${res.status()} ${res.request().method()} ${url}`)
        console.log(`  [response body] ${truncated}`)
      } catch (e) {
        console.log(`  [response] ${res.status()} ${res.request().method()} ${url} (no body)`)
      }
    }
  })

  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('input[id="pos-product-query"]', { timeout: 8000 })

  // Wait for the product list to load (POS is ready when scan input is enabled).
  await page.waitForFunction(
    () => {
      const input = document.querySelector('input#pos-product-query')
      return input && !input.disabled
    },
    { timeout: 8000 },
  )

  // Helper: set the value of a controlled input the React-friendly way.
  // We dispatch the native input event so React picks up the change and the
  // SearchableDropdown's onChange handler runs.
  async function setScanInputValue(text) {
    await page.evaluate((next) => {
      const input = document.querySelector('input#pos-product-query')
      if (!input) {
        throw new Error('scan input not found')
      }
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      ).set
      setter.call(input, next)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }, text)
  }

  // Add all four products to the cart. The POS page's handleProductQueryChange
  // auto-adds the product when the typed value exactly matches a product name
  // or barcode, so we just need to set the input value and wait for the cart
  // row to appear.
  for (const product of PRODUCTS) {
    await setScanInputValue(product.barcode)
    // Wait until the cart row shows up before adding the next product.
    await page.waitForFunction(
      (name) => {
        const rows = document.querySelectorAll('.cart-table tbody tr')
        return Array.from(rows).some((row) => row.textContent && row.textContent.includes(name))
      },
      product.name,
      { timeout: 5000 },
    )
  }

  // Trigger "จ่ายพอดี" so cash covers the cart total.
  await page.getByRole('button', { name: 'จ่ายพอดี' }).click()

  // Trigger the checkout confirmation Swal.
  await page.getByRole('button', { name: 'ชำระเงิน' }).click()
  await waitForCheckoutSwal(page)
  const checkoutFile = resolve(OUT_DIR, `pos-checkout-confirm-${vp.name}.png`)
  console.log(`  [ok] checkout confirm -> ${checkoutFile}`)
  await snapshotModal(page, checkoutFile)

  // Confirm checkout to trigger the success Swal.
  await page.getByRole('button', { name: 'ยืนยันขาย' }).click()
  await waitForSaleSuccessSwal(page)
  const successFile = resolve(OUT_DIR, `pos-sale-success-${vp.name}.png`)
  console.log(`  [ok] sale success -> ${successFile}`)
  await snapshotModal(page, successFile)

  await context.close()
}
await browser.close()
console.log('\ndone')
