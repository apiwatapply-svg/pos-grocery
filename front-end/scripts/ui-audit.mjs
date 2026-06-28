import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const appUrl = process.env.UI_AUDIT_BASE_URL ?? 'http://127.0.0.1:5173'
const debugPort = Number(process.env.UI_AUDIT_DEBUG_PORT ?? 9224)
const screenshotDir = process.env.UI_AUDIT_SCREENSHOT_DIR
  ?? path.join(tmpdir(), `pos-grocery-ui-audit-${Date.now()}`)

const roles = ['owner', 'admin', 'cashier', 'stock']
const routeCases = [
  { path: '/dashboard', heading: 'Dashboard', allowedRoles: ['owner', 'admin', 'stock'] },
  { path: '/pos', heading: 'ขายสินค้า / Scan barcode', allowedRoles: ['owner', 'admin', 'cashier'] },
  { path: '/customer-display', heading: 'จอลูกค้า', allowedRoles: ['owner', 'admin', 'cashier'] },
  { path: '/receipts', heading: 'ประวัติใบเสร็จ', allowedRoles: ['owner', 'admin', 'cashier'] },
  { path: '/receipts/receipt-1', heading: 'รายละเอียดใบเสร็จ', allowedRoles: ['owner', 'admin', 'cashier'] },
  { path: '/products', heading: 'สินค้า', allowedRoles: ['owner', 'admin', 'cashier', 'stock'] },
  { path: '/products/new', heading: 'เพิ่มสินค้า', allowedRoles: ['owner', 'admin'] },
  { path: '/products/product-water/edit', heading: 'แก้ไขสินค้า', allowedRoles: ['owner', 'admin'] },
  { path: '/inventory', heading: 'สินค้าคงคลัง', allowedRoles: ['owner', 'admin', 'stock'] },
  { path: '/inventory/receiving', heading: 'รับของเข้า', allowedRoles: ['owner', 'admin', 'stock'] },
  { path: '/inventory/counting', heading: 'ตรวจนับ stock', allowedRoles: ['owner', 'admin', 'stock'] },
  { path: '/reports/sales', heading: 'รายงานยอดขาย', allowedRoles: ['owner', 'admin'] },
  { path: '/reports/best-sellers', heading: 'สินค้าขายดี', allowedRoles: ['owner', 'admin'] },
  { path: '/settings/store', heading: 'ตั้งค่าร้าน', allowedRoles: ['owner', 'admin'] },
  { path: '/settings/users', heading: 'ผู้ใช้ระบบ', allowedRoles: ['owner', 'admin'] },
]

const screenshotRoutes = [
  { path: '/dashboard', role: 'owner', name: 'dashboard-desktop' },
  { path: '/pos', role: 'cashier', name: 'pos-desktop' },
  { path: '/settings/users', role: 'owner', name: 'users-desktop' },
  { path: '/products', role: 'stock', name: 'products-mobile', width: 390, height: 900 },
]

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean)

  const found = candidates.find((candidate) => existsSync(candidate))
  if (!found) {
    throw new Error('Chrome or Edge executable was not found. Set CHROME_PATH and retry.')
  }

  return found
}

function sessionForRole(role) {
  return {
    token: `audit-token-${role}`,
    user: {
      id: `audit-${role}`,
      username: role === 'owner' ? 'admin' : role,
      displayName: role === 'owner' ? 'Admin' : `Audit ${role}`,
      role,
    },
  }
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function waitForJson(url, timeoutMs = 10000) {
  const startedAt = Date.now()
  let lastError

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return response.json()
      }
    } catch (error) {
      lastError = error
    }
    await delay(100)
  }

  throw lastError ?? new Error(`Timed out waiting for ${url}`)
}

class CdpClient {
  constructor(webSocketUrl) {
    this.nextId = 1
    this.pending = new Map()
    this.events = new Map()
    this.socket = new WebSocket(webSocketUrl)
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true })
      this.socket.addEventListener('error', reject, { once: true })
    })

    this.socket.addEventListener('message', (event) => {
      const payload = JSON.parse(event.data)
      if (payload.id && this.pending.has(payload.id)) {
        const { resolve, reject } = this.pending.get(payload.id)
        this.pending.delete(payload.id)
        if (payload.error) {
          reject(new Error(payload.error.message))
        } else {
          resolve(payload.result)
        }
        return
      }

      if (payload.method && this.events.has(payload.method)) {
        for (const handler of this.events.get(payload.method)) {
          handler(payload.params)
        }
      }
    })
  }

  close() {
    this.socket.close()
  }

  send(method, params = {}) {
    const id = this.nextId
    this.nextId += 1
    this.socket.send(JSON.stringify({ id, method, params }))

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
    })
  }

  once(method) {
    return new Promise((resolve) => {
      const handler = (params) => {
        this.events.set(
          method,
          this.events.get(method).filter((current) => current !== handler),
        )
        resolve(params)
      }

      this.events.set(method, [...(this.events.get(method) ?? []), handler])
    })
  }
}

async function connectToPage() {
  const targets = await waitForJson(`http://127.0.0.1:${debugPort}/json/list`)
  const pageTarget = targets.find((target) => target.type === 'page')
  if (!pageTarget) {
    throw new Error('Chrome DevTools page target was not found.')
  }

  const cdp = new CdpClient(pageTarget.webSocketDebuggerUrl)
  await cdp.open()
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    deviceScaleFactor: 1,
    height: 1100,
    mobile: false,
    width: 1440,
  })

  return cdp
}

async function navigate(cdp, url) {
  const loaded = cdp.once('Page.loadEventFired')
  await cdp.send('Page.navigate', { url })
  await loaded
  await delay(150)
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    awaitPromise: true,
    expression,
    returnByValue: true,
  })

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text)
  }

  return result.result.value
}

async function setSession(cdp, role) {
  const session = JSON.stringify(sessionForRole(role)).replaceAll('\\', '\\\\').replaceAll("'", "\\'")
  await navigate(cdp, `${appUrl}/login`)
  await evaluate(
    cdp,
    `localStorage.setItem('pos-grocery:session', '${session}'); undefined`,
  )
}

async function auditCurrentPage(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const text = document.body.innerText;
      const headingScope = document.querySelector('main') ?? document;
      const headings = [...headingScope.querySelectorAll('h1, h2')]
        .map((node) => node.textContent.trim())
        .filter(Boolean);
      const buttons = [...document.querySelectorAll('main button, main a.primary-button, main a.export-link')]
        .map((node) => ({
          text: node.textContent.trim() || node.getAttribute('aria-label') || node.getAttribute('href') || '',
          backgroundColor: getComputedStyle(node).backgroundColor,
          disabled: Boolean(node.disabled || node.getAttribute('aria-disabled') === 'true'),
        }));
      const layout = document.querySelector('.app-layout');
      const main = document.querySelector('main');
      const bodyRect = document.body.getBoundingClientRect();
      const mainRect = main?.getBoundingClientRect();
      return {
        bodyTextLength: text.length,
        buttons,
        denied: text.includes('ไม่มีสิทธิ์เข้าหน้านี้'),
        hasCreateProductAction: [...document.querySelectorAll('main a, main button')]
          .some((node) => node.textContent.trim() === 'เพิ่มสินค้า'),
        headings,
        hasNav: Boolean(document.querySelector('[aria-label="เมนูหลัก"]')),
        hasPosShortcut: [...document.querySelectorAll('header a, main a, main button')]
          .some((node) => node.textContent.trim() === 'ไปหน้า POS'),
        layoutColumns: layout ? getComputedStyle(layout).gridTemplateColumns : '',
        mainVisible: Boolean(mainRect && mainRect.width > 0 && mainRect.height > 0),
        overflowX: Math.ceil(bodyRect.width) > window.innerWidth + 4,
        title: document.title,
      };
    })()`,
  )
}

function assertDistinctButtonColors(routePath, role, buttons) {
  const actionableButtons = buttons.filter((button) => !button.disabled)
  const labels = actionableButtons.map((button) => button.text)
  const colors = new Set(actionableButtons.map((button) => button.backgroundColor))

  if (actionableButtons.length > 1 && colors.size < 2) {
    throw new Error(
      `${routePath} as ${role} has weak button color differentiation: ${labels.join(', ')}`,
    )
  }
}

async function captureScreenshot(cdp, item) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    deviceScaleFactor: 1,
    height: item.height ?? 1100,
    mobile: Boolean(item.width && item.width < 600),
    width: item.width ?? 1440,
  })
  await setSession(cdp, item.role)
  await navigate(cdp, `${appUrl}${item.path}`)
  const layout = await evaluate(
    cdp,
    `(() => {
      const mainRect = document.querySelector('main')?.getBoundingClientRect();
      return {
        mainTop: mainRect?.top ?? 0,
        overflowX: document.body.scrollWidth > window.innerWidth + 4,
      };
    })()`,
  )
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
  const screenshotPath = path.join(screenshotDir, `${item.name}.png`)
  await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'))
  return { ...layout, path: screenshotPath }
}

async function main() {
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'pos-grocery-chrome-'))
  await mkdir(screenshotDir, { recursive: true })

  const chrome = spawn(chromePath(), [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-gpu',
    '--disable-extensions',
    '--headless=new',
    '--hide-scrollbars',
    '--no-first-run',
    '--window-size=1440,1100',
    'about:blank',
  ], {
    stdio: 'ignore',
  })

  try {
    await waitForJson(`http://127.0.0.1:${debugPort}/json/version`)
    const cdp = await connectToPage()
    const failures = []

    await navigate(cdp, `${appUrl}/login`)
    await evaluate(cdp, `localStorage.clear(); undefined`)
    await navigate(cdp, `${appUrl}/login`)
    const loginAudit = await auditCurrentPage(cdp)
    if (!loginAudit.headings.includes('เข้าสู่ระบบร้านค้า')) {
      failures.push('/login did not render the login heading')
    }

    for (const routeCase of routeCases) {
      for (const role of roles) {
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          deviceScaleFactor: 1,
          height: 1100,
          mobile: false,
          width: 1440,
        })
        await setSession(cdp, role)
        await navigate(cdp, `${appUrl}${routeCase.path}`)
        const audit = await auditCurrentPage(cdp)
        const allowed = routeCase.allowedRoles.includes(role)

        if (allowed) {
          if (!audit.headings.includes(routeCase.heading)) {
            failures.push(`${routeCase.path} as ${role} missing heading ${routeCase.heading}`)
          }
          if (audit.denied) {
            failures.push(`${routeCase.path} as ${role} was denied unexpectedly`)
          }
          if (!audit.hasNav || !audit.mainVisible || audit.bodyTextLength < 10) {
            failures.push(`${routeCase.path} as ${role} did not render a usable app shell`)
          }
          if (audit.overflowX) {
            failures.push(`${routeCase.path} as ${role} has horizontal body overflow`)
          }
          if (!routeCases.find((item) => item.path === '/pos').allowedRoles.includes(role) && audit.hasPosShortcut) {
            failures.push(`${routeCase.path} as ${role} shows forbidden POS shortcut`)
          }
          if (
            routeCase.path === '/products'
              && !routeCases.find((item) => item.path === '/products/new').allowedRoles.includes(role)
              && audit.hasCreateProductAction
          ) {
            failures.push(`${routeCase.path} as ${role} shows forbidden create product action`)
          }
          assertDistinctButtonColors(routeCase.path, role, audit.buttons)
        } else if (!audit.denied) {
          failures.push(`${routeCase.path} as ${role} should show access denied`)
        }
      }
    }

    const screenshots = []
    for (const item of screenshotRoutes) {
      const screenshot = await captureScreenshot(cdp, item)
      screenshots.push(screenshot)
      if ((item.width ?? 1440) < 600 && screenshot.mainTop > 160) {
        failures.push(`${item.path} mobile layout leaves too much empty space before content`)
      }
      if (screenshot.overflowX) {
        failures.push(`${item.path} ${item.name} screenshot has horizontal overflow`)
      }
    }
    cdp.close()

    if (failures.length > 0) {
      console.error(JSON.stringify({ failures, screenshots }, null, 2))
      process.exitCode = 1
      return
    }

    console.log(JSON.stringify({
      checkedRoutes: routeCases.length,
      checkedRoleNavigations: routeCases.length * roles.length + 1,
      screenshots,
      status: 'passed',
    }, null, 2))
  } finally {
    chrome.kill()
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 1000)
      chrome.once('exit', () => {
        clearTimeout(timeout)
        resolve()
      })
    })
    await rm(userDataDir, { force: true, recursive: true, maxRetries: 3, retryDelay: 100 })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
