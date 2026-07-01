import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const appUrl = process.env.UI_AUDIT_BASE_URL ?? 'http://127.0.0.1:5173'
const apiBaseUrl = process.env.UI_AUDIT_API_BASE_URL ?? 'http://127.0.0.1:8787'
const debugPort = Number(process.env.UI_AUDIT_DEBUG_PORT ?? 9226)

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

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function waitForJson(url, timeoutMs = 15000) {
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
          (this.events.get(method) ?? []).filter((current) => current !== handler),
        )
        resolve(params)
      }

      this.events.set(method, [...(this.events.get(method) ?? []), handler])
    })
  }

  on(method, handler) {
    this.events.set(method, [...(this.events.get(method) ?? []), handler])
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
  await cdp.send('Network.enable')
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
  await delay(200)
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

function buildSampleProducts(count) {
  const baseNames = [
    'น้ำดื่มตราสิงห์ 600ml',
    'บะหมี่กึ่งสำเร็จรูป ตรามาม่า',
    'น้ำอัดลม โค้ก 1.25L',
    'ขนมปังถั่วแดง',
    'นมสดพาสเจอร์ไรส์ ตราหมี 1L',
    'ไข่ไก่เบอร์ 1 แผง 10 ฟอง',
    'ข้าวหอมมะลิ 5 กก.',
    'น้ำมันพืช 1 ลิตร',
    'น้ำตาลทราย 1 กก.',
    'ซอสปรุงรส ตราภูเขาทอง 700ml',
    'กาแฟสำเร็จรูป ตราเนสกาแฟ 200g',
    'แป้งสาลีอเนกประสงค์ 1 กก.',
    'น้ำยาล้างจาน ตราเพียวรีน 750ml',
    'ผงซักฟอก ตราโอโม 900g',
    'สบู่เหลวล้างมือ ตราเดทตอล 250ml',
  ]

  const items = []
  for (let i = 0; i < count; i += 1) {
    const name = baseNames[i % baseNames.length]
    items.push({
      id: `audit-product-${i + 1}`,
      name,
      barcode: `8850002${String(100000 + i).padStart(6, '0')}`,
      unit: i % 3 === 0 ? 'pack' : 'bottle',
      costPriceSatang: 500 + (i % 7) * 100,
      salePriceSatang: 1200 + (i % 5) * 200,
      stockQuantity: 5 + (i % 12) * 3,
    })
  }
  return items
}

function buildSampleHistory(count) {
  const productNames = [
    'น้ำดื่มตราสิงห์ 600ml',
    'บะหมี่กึ่งสำเร็จรูป ตรามาม่า',
    'น้ำอัดลม โค้ก 1.25L',
    'ขนมปังถั่วแดง',
    'นมสดพาสเจอร์ไรส์ ตราหมี 1L',
    'ไข่ไก่เบอร์ 1 แผง 10 ฟอง',
    'ข้าวหอมมะลิ 5 กก.',
    'น้ำมันพืช 1 ลิตร',
  ]
  const items = []
  for (let i = 0; i < count; i += 1) {
    const product = productNames[i % productNames.length]
    const quantityChange = 1 + (i % 24)
    const balanceAfterChange = 10 + (i % 200)
    items.push({
      id: `audit-history-${i + 1}`,
      productName: product,
      barcode: `8850002${String(200000 + i).padStart(6, '0')}`,
      type: 'receive',
      quantityChange,
      balanceAfterChange,
      createdAt: new Date(Date.now() - i * 600000).toISOString(),
    })
  }
  return items
}

async function main() {
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'pos-grocery-measure-'))
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

    const session = {
      token: 'audit-measure-token-owner',
      user: {
        id: 'audit-measure-owner',
        username: 'admin',
        displayName: 'Audit Measure',
        role: 'owner',
      },
    }

    const productPayload = JSON.stringify({ success: true, data: buildSampleProducts(20) })
    const historyPayload = JSON.stringify({ success: true, data: buildSampleHistory(25) })

    const injectedInit = `(() => {
      const productPayload = ${JSON.stringify(productPayload)};
      const historyPayload = ${JSON.stringify(historyPayload)};
      const sessionJson = ${JSON.stringify(JSON.stringify(session))};
      const tryInstall = () => {
        if (window.fetch && !window.__measureFetchPatched) {
          const originalFetch = window.fetch.bind(window);
          window.__originalFetch = originalFetch;
          window.fetch = function(input, init) {
            const url = typeof input === 'string' ? input : (input && input.url) || '';
            try {
              if (url.includes('/inventory/transactions')) {
                return Promise.resolve(new Response(historyPayload, {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                }));
              }
              if (url.includes('/api/products')) {
                return Promise.resolve(new Response(productPayload, {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                }));
              }
              if (url.includes('/api/auth/login') || url.includes('/api/auth/me') || url.includes('/api/store')) {
                return Promise.resolve(new Response(JSON.stringify({ success: true, data: { token: 'noop', user: { id: 'noop', username: 'admin', displayName: 'Admin', role: 'owner' }, store: { id: 'noop', name: 'POS Grocery' } } }), {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                }));
              }
            } catch (err) {
              // fall through
            }
            return originalFetch(input, init);
          };
          window.__measureFetchPatched = true;
        }
        if (!localStorage.getItem('pos-grocery:session')) {
          localStorage.setItem('pos-grocery:session', sessionJson);
        }
      };
      tryInstall();
      document.addEventListener('DOMContentLoaded', tryInstall);
      const interval = setInterval(tryInstall, 50);
      window.__measureInterval = interval;
      setTimeout(() => clearInterval(interval), 6000);
      true;
    })()`

    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: injectedInit })
    await navigate(cdp, `${appUrl}/login`)
    await evaluate(cdp, `localStorage.setItem('pos-grocery:session', ${JSON.stringify(JSON.stringify(session))}); undefined`)
    await navigate(cdp, `${appUrl}/inventory/receiving`)

    await evaluate(cdp, `new Promise((r) => setTimeout(r, 3000))`)

    const measurement = await evaluate(
      cdp,
      `(() => {
        const panel = document.querySelector('.receiving-history-panel');
        const scroll = document.querySelector('.receiving-history-panel .receiving-history-scroll');
        const table = document.querySelector('.receiving-history-panel .receiving-history-table');
        const thFirst = table?.querySelector('thead th:first-child');
        const tdFirst = table?.querySelector('tbody tr td:first-child');
        const thAll = table ? [...table.querySelectorAll('thead th')].map((node) => ({
          text: node.textContent.trim(),
          offsetWidth: node.offsetWidth,
          scrollWidth: node.scrollWidth,
        })) : [];
        const tdFirsts = table ? [...table.querySelectorAll('tbody tr')].slice(0, 5).map((row) => {
          const cell = row.querySelector('td:first-child');
          return {
            offsetWidth: cell?.offsetWidth ?? 0,
            scrollWidth: cell?.scrollWidth ?? 0,
            text: cell?.textContent?.trim() ?? '',
          };
        }) : [];
        const viewport = {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          documentScrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth,
        };
        return {
          viewport,
          panel: panel ? {
            offsetWidth: panel.offsetWidth,
            scrollWidth: panel.scrollWidth,
            clientWidth: panel.clientWidth,
            hasHorizontalScroll: panel.scrollWidth > panel.clientWidth + 1,
            overflowXStyle: getComputedStyle(panel).overflowX,
          } : null,
          scroll: scroll ? {
            offsetWidth: scroll.offsetWidth,
            scrollWidth: scroll.scrollWidth,
            clientWidth: scroll.clientWidth,
            hasHorizontalScroll: scroll.scrollWidth > scroll.clientWidth + 1,
            overflowXStyle: getComputedStyle(scroll).overflowX,
          } : null,
          table: table ? {
            offsetWidth: table.offsetWidth,
            scrollWidth: table.scrollWidth,
            clientWidth: table.clientWidth,
            hasHorizontalScroll: table.scrollWidth > table.clientWidth + 1,
            overflowXStyle: getComputedStyle(table).overflowX,
            rowCount: table.querySelectorAll('tbody tr').length,
          } : null,
          thFirst: thFirst ? {
            offsetWidth: thFirst.offsetWidth,
            scrollWidth: thFirst.scrollWidth,
            clientWidth: thFirst.clientWidth,
            text: thFirst.textContent.trim(),
          } : null,
          tdFirst: tdFirst ? {
            offsetWidth: tdFirst.offsetWidth,
            scrollWidth: tdFirst.scrollWidth,
            clientWidth: tdFirst.clientWidth,
            text: tdFirst.textContent?.trim() ?? '',
            overflowStyle: getComputedStyle(tdFirst).overflow,
            textOverflowStyle: getComputedStyle(tdFirst).textOverflow,
            whiteSpaceStyle: getComputedStyle(tdFirst).whiteSpace,
          } : null,
          thAll,
          tdFirsts,
        };
      })()`,
    )

    console.log(JSON.stringify(measurement, null, 2))
    cdp.close()
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
