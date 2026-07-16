// Capture stock counting page screenshots across viewports after the auth
// bypass so the table-layout fix can be verified visually.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const URL = 'http://localhost:5173/inventory/counting'
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

const viewports = [
  { name: 'desktop-1280', width: 1280, height: 800, fullPage: false, scrollToTable: false },
  { name: 'desktop-1440', width: 1440, height: 900, fullPage: false, scrollToTable: false },
  { name: 'ipad-820-portrait', width: 820, height: 1180, fullPage: false, scrollToTable: false },
  { name: 'ipad-1180-landscape', width: 1180, height: 820, fullPage: false, scrollToTable: false },
  { name: 'mobile-375', width: 375, height: 740, fullPage: true, scrollToTable: true },
]

const browser = await chromium.launch({ headless: true })
for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
  })
  // Pre-populate the session that AuthGate reads from localStorage.
  await context.addInitScript((sessionJSON) => {
    localStorage.setItem('pos-grocery:session', sessionJSON)
  }, JSON.stringify(SESSION))
  const page = await context.newPage()
  await page.goto(URL, { waitUntil: 'networkidle' })
  // Give React a tick to mount the table after auth bypass.
  await page.waitForSelector('.stock-counting-workspace', { timeout: 5000 })
  const file = resolve(OUT_DIR, `counting-${vp.name}.png`)
  await page.screenshot({ path: file, fullPage: false })
  console.log(`[ok] ${vp.name} -> ${file}`)
  if (vp.fullPage) {
    const full = resolve(OUT_DIR, `counting-${vp.name}-full.png`)
    await page.screenshot({ path: full, fullPage: true })
    console.log(`[ok] ${vp.name} (full) -> ${full}`)
  }
  if (vp.scrollToTable) {
    await page.evaluate(() => {
      const el = document.querySelector('.receiving-table-wrap-full')
      el?.scrollIntoView({ block: 'center' })
    })
    await page.waitForTimeout(300)
    const table = resolve(OUT_DIR, `counting-${vp.name}-table.png`)
    await page.screenshot({ path: table, fullPage: false })
    console.log(`[ok] ${vp.name} (table) -> ${table}`)
  }
  await context.close()
}
await browser.close()
console.log('done')
