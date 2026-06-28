export type StoreForCustomerDisplay = {
  name: string
}

export type CustomerCartItem = {
  productName: string
  quantity: number
  unitPrice: number
}

export type CustomerSale = {
  receiptNumber: string
} | null

export type CustomerDisplayPayload = {
  store: StoreForCustomerDisplay
  cart: CustomerCartItem[]
  cartTotal: number
  cashReceived: number
  changeDue: number
  lastSale: CustomerSale
}

export const customerDisplayStorageKey = 'pos-grocery:customer-display-enabled'
export const customerDisplayPayloadStorageKey = 'pos-grocery:customer-display-payload'
export const customerDisplayPayloadEvent = 'pos-grocery:customer-display-payload-updated'

function emptyCustomerDisplayPayload(): CustomerDisplayPayload {
  return {
    store: { name: 'POS Grocery' },
    cart: [],
    cartTotal: 0,
    cashReceived: 0,
    changeDue: 0,
    lastSale: null,
  }
}

export function baht(value: number) {
  return value.toFixed(2)
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function hasSecondScreen() {
  const screenWithExtension = window.screen as Screen & { isExtended?: boolean }
  return screenWithExtension.isExtended === true
}

export function readCustomerDisplayPreference() {
  if (!hasSecondScreen()) {
    localStorage.removeItem(customerDisplayStorageKey)
    return false
  }

  return localStorage.getItem(customerDisplayStorageKey) === 'true'
}

export function readCustomerDisplayPayload() {
  const rawPayload = localStorage.getItem(customerDisplayPayloadStorageKey)
  if (!rawPayload) {
    return emptyCustomerDisplayPayload()
  }

  try {
    const parsedPayload = JSON.parse(rawPayload) as Partial<CustomerDisplayPayload>
    return {
      store: {
        name: parsedPayload.store?.name || 'POS Grocery',
      },
      cart: Array.isArray(parsedPayload.cart) ? parsedPayload.cart : [],
      cartTotal: typeof parsedPayload.cartTotal === 'number' ? parsedPayload.cartTotal : 0,
      cashReceived:
        typeof parsedPayload.cashReceived === 'number' ? parsedPayload.cashReceived : 0,
      changeDue: typeof parsedPayload.changeDue === 'number' ? parsedPayload.changeDue : 0,
      lastSale: parsedPayload.lastSale?.receiptNumber
        ? { receiptNumber: parsedPayload.lastSale.receiptNumber }
        : null,
    }
  } catch {
    return emptyCustomerDisplayPayload()
  }
}

export function writeCustomerDisplayPayload(payload: CustomerDisplayPayload) {
  localStorage.setItem(customerDisplayPayloadStorageKey, JSON.stringify(payload))
  window.dispatchEvent(new Event(customerDisplayPayloadEvent))
}

export function buildCustomerDisplayHtml(input: {
  store: StoreForCustomerDisplay
  cart: CustomerCartItem[]
  cartTotal: number
  cashReceived: number
  changeDue: number
  lastSale: CustomerSale
}) {
  const rows =
    input.cart.length > 0
      ? input.cart
          .map(
            (item, index) => `<tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(item.productName)}</td>
              <td>${item.quantity}</td>
              <td>${baht(item.unitPrice)} บาท</td>
              <td>${baht(item.quantity * item.unitPrice)} บาท</td>
            </tr>`,
          )
          .join('')
      : '<p class="muted">รอรายการสินค้า</p>'

  return `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>จอลูกค้า - ${escapeHtml(input.store.name)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      background: #101814;
      color: #fff;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      margin: 0;
      min-height: 100vh;
      padding: 32px;
    }
    .screen { display: grid; gap: 24px; margin: 0 auto; max-width: 960px; }
    h1 { font-size: 48px; line-height: 1; margin: 0; }
    .store, .muted, .receipt { color: #c9d7cf; }
    table { border-collapse: collapse; font-size: 26px; width: 100%; }
    th, td { border-bottom: 1px solid #34463b; padding: 14px 10px; text-align: left; }
    th { color: #bff0d2; font-size: 18px; text-transform: uppercase; }
    td:nth-child(3), td:nth-child(4), td:nth-child(5) { text-align: right; }
    .summary { display: grid; gap: 12px; }
    .summary div {
      align-items: center;
      border-top: 1px solid #34463b;
      display: flex;
      justify-content: space-between;
      padding-top: 12px;
    }
    .total { color: #bff0d2; font-size: 42px; font-weight: 900; }
  </style>
</head>
<body>
  <main class="screen">
    <p class="store">${escapeHtml(input.store.name)}</p>
    <h1>จอลูกค้า</h1>
    <section>${input.cart.length > 0 ? `<table>
      <thead>
        <tr>
          <th>No</th>
          <th>สินค้า</th>
          <th>จำนวน</th>
          <th>ราคา</th>
          <th>รวม</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>` : rows}</section>
    <section class="summary">
      <div><span>ยอดที่ต้องชำระ</span><strong class="total">${baht(input.cartTotal)} บาท</strong></div>
      <div><span>รับเงิน</span><strong>${baht(input.cashReceived)} บาท</strong></div>
      <div><span>เงินทอน</span><strong>${baht(Math.max(input.changeDue, 0))} บาท</strong></div>
    </section>
    ${input.lastSale ? `<p class="receipt">บิลล่าสุด ${escapeHtml(input.lastSale.receiptNumber)}</p>` : ''}
  </main>
</body>
</html>`
}
