import { formatBaht } from '../../lib/format/number'
import { displayReceiptNumber } from '../receipts/receiptNumber'

export type StoreForCustomerDisplay = {
  name: string
  logoUrl?: string
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
  return formatBaht(value)
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
        logoUrl: parsedPayload.store?.logoUrl || undefined,
      },
      cart: Array.isArray(parsedPayload.cart) ? parsedPayload.cart : [],
      cartTotal: typeof parsedPayload.cartTotal === 'number' ? parsedPayload.cartTotal : 0,
      cashReceived:
        typeof parsedPayload.cashReceived === 'number' ? parsedPayload.cashReceived : 0,
      changeDue: typeof parsedPayload.changeDue === 'number' ? parsedPayload.changeDue : 0,
      lastSale: parsedPayload.lastSale?.receiptNumber
        ? { receiptNumber: displayReceiptNumber(parsedPayload.lastSale.receiptNumber) }
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

function customerDisplayLiveScript() {
  return `<script>
(function () {
  var storageKey = ${JSON.stringify(customerDisplayPayloadStorageKey)};
  var lastPayloadText = '';

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function baht(value) {
    return Number(value || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function twoDigit(value) {
    return String(value).padStart(2, '0');
  }

  function displayReceiptNumber(receiptNumber) {
    var match = /^RC(\\d{8})-(\\d{13})$/.exec(String(receiptNumber || ''));
    if (!match) {
      return String(receiptNumber || '');
    }

    var timestamp = Number(match[2]);
    if (!Number.isFinite(timestamp)) {
      return String(receiptNumber || '');
    }

    var date = new Date(timestamp);
    return 'RC' + match[1] + '-' + twoDigit(date.getHours()) + twoDigit(date.getMinutes()) + twoDigit(date.getSeconds());
  }

  function normalizePayload(payload) {
    var cart = Array.isArray(payload && payload.cart)
      ? payload.cart.map(function (item) {
          return {
            productName: String(item && item.productName ? item.productName : ''),
            quantity: Number(item && item.quantity ? item.quantity : 0),
            unitPrice: Number(item && item.unitPrice ? item.unitPrice : 0)
          };
        }).filter(function (item) {
          return item.productName && item.quantity > 0;
        })
      : [];

    return {
      store: {
        name: payload && payload.store && payload.store.name ? String(payload.store.name) : 'POS Grocery'
      },
      cart: cart,
      cartTotal: Number(payload && payload.cartTotal ? payload.cartTotal : 0),
      cashReceived: Number(payload && payload.cashReceived ? payload.cashReceived : 0),
      changeDue: Number(payload && payload.changeDue ? payload.changeDue : 0),
      lastSale: payload && payload.lastSale && payload.lastSale.receiptNumber
        ? { receiptNumber: String(payload.lastSale.receiptNumber) }
        : null
    };
  }

  function readPayload(rawPayload) {
    if (!rawPayload) {
      return normalizePayload({});
    }

    try {
      return normalizePayload(JSON.parse(rawPayload));
    } catch (error) {
      return normalizePayload({});
    }
  }

  function cartHtml(cart) {
    if (cart.length === 0) {
      return '<p class="muted">รอรายการสินค้า</p>';
    }

    return '<table>' +
      '<thead><tr><th>No</th><th>สินค้า</th><th>จำนวน</th><th>ราคา</th><th>รวม</th></tr></thead>' +
      '<tbody>' + cart.map(function (item, index) {
        return '<tr>' +
          '<td>' + (index + 1) + '</td>' +
          '<td>' + escapeHtml(item.productName) + '</td>' +
          '<td>' + item.quantity.toLocaleString('en-US') + '</td>' +
          '<td>' + baht(item.unitPrice) + ' บาท</td>' +
          '<td>' + baht(item.quantity * item.unitPrice) + ' บาท</td>' +
          '</tr>';
      }).join('') + '</tbody></table>';
  }

  function syncCustomerDisplay() {
    var rawPayload = localStorage.getItem(storageKey) || '';
    if (rawPayload === lastPayloadText) {
      return;
    }
    lastPayloadText = rawPayload;

    var payload = readPayload(rawPayload);
    var paymentBalanceLabel = payload.changeDue < 0 ? 'ยังขาดอีก' : 'เงินทอน';
    var paymentBalanceAmount = Math.abs(payload.changeDue);

    document.title = 'จอลูกค้า - ' + payload.store.name;
    document.getElementById('customer-display-store').textContent = payload.store.name;
    document.getElementById('customer-display-cart').innerHTML = cartHtml(payload.cart);
    document.getElementById('customer-display-total').textContent = baht(payload.cartTotal) + ' บาท';
    document.getElementById('customer-display-cash').textContent = baht(payload.cashReceived) + ' บาท';
    document.getElementById('customer-display-balance-label').textContent = paymentBalanceLabel;
    document.getElementById('customer-display-balance').textContent = baht(paymentBalanceAmount) + ' บาท';
    document.getElementById('customer-display-receipt').textContent = payload.lastSale
      ? 'บิลล่าสุด ' + displayReceiptNumber(payload.lastSale.receiptNumber)
      : '';
  }

  window.addEventListener('storage', function (event) {
    if (!event.key || event.key === storageKey) {
      lastPayloadText = '';
      syncCustomerDisplay();
    }
  });
  window.addEventListener('focus', function () {
    lastPayloadText = '';
    syncCustomerDisplay();
  });

  lastPayloadText = '';
  syncCustomerDisplay();
  setInterval(syncCustomerDisplay, 300);
})();
</script>`
}

export function buildCustomerDisplayHtml(input: {
  store: StoreForCustomerDisplay
  cart: CustomerCartItem[]
  cartTotal: number
  cashReceived: number
  changeDue: number
  lastSale: CustomerSale
}) {
  const paymentBalanceLabel = input.changeDue < 0 ? 'ยังขาดอีก' : 'เงินทอน'
  const paymentBalanceAmount = Math.abs(input.changeDue)
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
    <p class="store" id="customer-display-store">${escapeHtml(input.store.name)}</p>
    <h1>จอลูกค้า</h1>
    <section id="customer-display-cart">${input.cart.length > 0 ? `<table>
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
      <div><span>ยอดที่ต้องชำระ</span><strong class="total" id="customer-display-total">${baht(input.cartTotal)} บาท</strong></div>
      <div><span>รับเงิน</span><strong id="customer-display-cash">${baht(input.cashReceived)} บาท</strong></div>
      <div><span id="customer-display-balance-label">${paymentBalanceLabel}</span><strong id="customer-display-balance">${baht(paymentBalanceAmount)} บาท</strong></div>
    </section>
    <p class="receipt" id="customer-display-receipt">${input.lastSale ? `บิลล่าสุด ${escapeHtml(displayReceiptNumber(input.lastSale.receiptNumber))}` : ''}</p>
  </main>
  ${customerDisplayLiveScript()}
</body>
</html>`
}
