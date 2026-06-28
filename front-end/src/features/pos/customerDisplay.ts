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
  lastSale: CustomerSale
}) {
  const rows =
    input.cart.length > 0
      ? input.cart
          .map(
            (item) => `<div class="row"><span>${escapeHtml(item.productName)} x${item.quantity}</span><strong>${baht(
              item.quantity * item.unitPrice,
            )} บาท</strong></div>`,
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
    .row {
      align-items: center;
      border-top: 1px solid #34463b;
      display: grid;
      font-size: 28px;
      gap: 16px;
      grid-template-columns: minmax(0, 1fr) auto;
      padding: 18px 0 0;
    }
    .total { color: #bff0d2; font-size: 42px; font-weight: 900; }
  </style>
</head>
<body>
  <main class="screen">
    <p class="store">${escapeHtml(input.store.name)}</p>
    <h1>จอลูกค้า</h1>
    <section>${rows}</section>
    <strong class="total">ยอดที่ต้องชำระ ${baht(input.cartTotal)} บาท</strong>
    ${input.lastSale ? `<p class="receipt">บิลล่าสุด ${escapeHtml(input.lastSale.receiptNumber)}</p>` : ''}
  </main>
</body>
</html>`
}
