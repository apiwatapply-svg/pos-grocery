// Verify the held-bills modal does not overflow on desktop or iPad.
// Opens the resume-bills modal and screenshots it at multiple viewports.
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

// Seed a held bill into localStorage so the modal has rows to render.
const HELD_BILLS = [
  {
    id: 'held-1',
    storeId: 'store-1',
    items: [
      {
        productId: 'product-water',
        productName: 'Drinking Water',
        barcode: '8850002000010',
        quantity: 1,
        unitPrice: 7,
      },
    ],
    cashReceived: 0,
    note: '',
    createdAt: '2026-07-16T20:05:00.000Z',
  },
  {
    id: 'held-2',
    storeId: 'store-1',
    items: [
      {
        productId: 'product-noodle',
        productName: 'Instant Noodles Pack',
        barcode: '8850001000011',
        quantity: 5,
        unitPrice: 12,
      },
    ],
    cashReceived: 0,
    note: 'ลูกค้าประจำ',
    createdAt: '2026-07-16T19:30:00.000Z',
  },
]

const viewports = [
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'desktop-1366', width: 1366, height: 768 },
  { name: 'ipad-mini-768', width: 768, height: 1024 },
  { name: 'ipad-820-portrait', width: 820, height: 1180 },
  { name: 'ipad-1180-landscape', width: 1180, height: 820 },
]

const browser = await chromium.launch({ headless: true })
for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dsf ?? 1,
  })
  // Stub the API so we don't depend on a running backend with a real DB.
  // The frontend's API base is http://localhost:8787/api so we need to
  // intercept that host directly.
  await context.route('http://localhost:8787/**', (route) => {
    const url = route.request().url()
    if (url.includes('/api/store/current')) {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'store-1',
            name: 'POS Grocery',
            phone: '0800000000',
            address: 'Bangkok',
            logoUrl: 'https://example.com/pos-logo.png',
            status: 'active',
          },
        }),
      })
    }
    if (url.includes('/api/products')) {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
    }
    if (url.includes('/api/sales')) {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: null }),
    })
  })
  await context.addInitScript(
    ({ sessionJSON, heldBillsJSON, storeId }) => {
      localStorage.setItem('pos-grocery:session', sessionJSON)
      localStorage.setItem(
        `pos-grocery:held-bills:${storeId}`,
        heldBillsJSON,
      )
    },
    {
      sessionJSON: JSON.stringify(SESSION),
      heldBillsJSON: JSON.stringify(HELD_BILLS),
      storeId: 'store-1',
    },
  )
  const page = await context.newPage()
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('input[id="pos-product-query"]', { timeout: 8000 })
  await page.getByRole('button', { name: 'เปิดรายการบิลที่พัก' }).click()
  await page.waitForSelector('.held-bills-modal', { timeout: 5000 })
  const file = resolve(OUT_DIR, `held-bills-${vp.name}.png`)
  await page.screenshot({ path: file, fullPage: false })
  console.log(`[ok] ${vp.name} -> ${file}`)
  await context.close()
}
await browser.close()
console.log('done')
