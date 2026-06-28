import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react'

type Store = {
  name: string
  phone: string
  address: string
  ownerName: string
}

type User = {
  id: string
  username: string
  displayName: string
  role: 'owner' | 'admin' | 'cashier' | 'stock'
  status: 'active' | 'inactive'
}

type Product = {
  id: string
  name: string
  barcode: string
  sku: string
  unit: string
  costPrice: number
  salePrice: number
  stockQuantity: number
  status: 'active' | 'inactive'
  imageUrl: string
}

type CartItem = {
  productId: string
  productName: string
  barcode: string
  quantity: number
  unitPrice: number
}

type Sale = {
  id: string
  receiptNumber: string
  soldAt: string
  items: CartItem[]
  total: number
  cashReceived: number
  changeDue: number
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787/api'
const customerDisplayStorageKey = 'pos-grocery:customer-display-enabled'

const initialProducts: Product[] = [
  {
    id: 'product-water',
    name: 'Drinking Water',
    barcode: '8850002000010',
    sku: 'WATER-001',
    unit: 'bottle',
    costPrice: 4,
    salePrice: 7,
    stockQuantity: 24,
    status: 'active',
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
  },
  {
    id: 'product-noodle',
    name: 'Instant Noodles',
    barcode: '8850001000011',
    sku: 'NOODLE-001',
    unit: 'pack',
    costPrice: 7,
    salePrice: 12,
    stockQuantity: 18,
    status: 'active',
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
  },
]

function baht(value: number) {
  return value.toFixed(2)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildCustomerDisplayHtml(input: {
  store: Store
  cart: CartItem[]
  cartTotal: number
  lastSale: Sale | null
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

function hasSecondScreen() {
  const screenWithExtension = window.screen as Screen & { isExtended?: boolean }
  return screenWithExtension.isExtended === true
}

function readCustomerDisplayPreference() {
  if (!hasSecondScreen()) {
    localStorage.removeItem(customerDisplayStorageKey)
    return false
  }

  return localStorage.getItem(customerDisplayStorageKey) === 'true'
}

function Field(props: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      {props.children}
    </label>
  )
}

export function App() {
  const customerDisplayWindowRef = useRef<Window | null>(null)
  const [store, setStore] = useState<Store>({
    name: 'POS Grocery',
    phone: '0800000000',
    address: 'Bangkok',
    ownerName: 'admin',
  })
  const [users, setUsers] = useState<User[]>([
    { id: 'user-owner', username: 'admin', displayName: 'Admin', role: 'owner', status: 'active' },
    { id: 'user-cashier', username: 'cashier', displayName: 'Cashier One', role: 'cashier', status: 'active' },
  ])
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [cart, setCart] = useState<CartItem[]>([])
  const [barcode, setBarcode] = useState('8850002000010')
  const [saleQuantity, setSaleQuantity] = useState(1)
  const [cashReceived, setCashReceived] = useState(100)
  const [lastSale, setLastSale] = useState<Sale | null>(null)
  const [notice, setNotice] = useState('พร้อมขาย')
  const [hasCustomerScreen, setHasCustomerScreen] = useState(hasSecondScreen)
  const [customerDisplayEnabled, setCustomerDisplayEnabled] = useState(
    readCustomerDisplayPreference,
  )

  const cartTotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const soldItems =
    lastSale?.items.reduce<Record<string, { productName: string; quantity: number; total: number }>>(
      (rows, item) => {
        const current = rows[item.productId] ?? {
          productName: item.productName,
          quantity: 0,
          total: 0,
        }
        rows[item.productId] = {
          ...current,
          quantity: current.quantity + item.quantity,
          total: current.total + item.quantity * item.unitPrice,
        }
        return rows
      },
      {},
    ) ?? {}
  const bestSellers = Object.values(soldItems).sort((left, right) => right.quantity - left.quantity)

  useEffect(() => {
    if (!customerDisplayEnabled || !customerDisplayWindowRef.current) {
      return
    }

    if (customerDisplayWindowRef.current.closed) {
      customerDisplayWindowRef.current = null
      return
    }

    customerDisplayWindowRef.current.document.open()
    customerDisplayWindowRef.current.document.write(
      buildCustomerDisplayHtml({ store, cart, cartTotal, lastSale }),
    )
    customerDisplayWindowRef.current.document.close()
  }, [cart, cartTotal, customerDisplayEnabled, lastSale, store])

  useEffect(() => {
    if (customerDisplayEnabled || !customerDisplayWindowRef.current) {
      return
    }

    if (!customerDisplayWindowRef.current.closed) {
      customerDisplayWindowRef.current.close()
    }
    customerDisplayWindowRef.current = null
  }, [customerDisplayEnabled])

  function updateStore<K extends keyof Store>(key: K, value: Store[K]) {
    setStore((current) => ({ ...current, [key]: value }))
  }

  function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setUsers((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        username: String(form.get('username')),
        displayName: String(form.get('displayName')),
        role: String(form.get('role')) as User['role'],
        status: 'active',
      },
    ])
    event.currentTarget.reset()
  }

  function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setProducts((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: String(form.get('name')),
        barcode: String(form.get('barcode')),
        sku: String(form.get('sku')),
        unit: String(form.get('unit')),
        costPrice: Number(form.get('costPrice')),
        salePrice: Number(form.get('salePrice')),
        stockQuantity: 0,
        status: 'active',
        imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      },
    ])
    event.currentTarget.reset()
  }

  function updateProductStock(productId: string, quantity: number, mode: 'receive' | 'count') {
    setProducts((current) =>
      current.map((product) => {
        if (product.id !== productId) {
          return product
        }

        return {
          ...product,
          stockQuantity: mode === 'receive' ? product.stockQuantity + quantity : quantity,
        }
      }),
    )
  }

  function addScannedItem() {
    const product = products.find((item) => item.barcode === barcode && item.status === 'active')
    if (!product) {
      setNotice('ไม่พบสินค้า')
      return
    }
    if (product.stockQuantity < saleQuantity) {
      setNotice('stock ไม่พอ')
      return
    }

    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id)
      if (existing) {
        return current.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + saleQuantity }
            : item,
        )
      }

      return [
        ...current,
        {
          productId: product.id,
          productName: product.name,
          barcode: product.barcode,
          quantity: saleQuantity,
          unitPrice: product.salePrice,
        },
      ]
    })
    setNotice(`${product.name} added`)
  }

  function refreshCustomerDisplayAvailability() {
    const nextHasCustomerScreen = hasSecondScreen()
    setHasCustomerScreen(nextHasCustomerScreen)

    if (!nextHasCustomerScreen) {
      localStorage.removeItem(customerDisplayStorageKey)
      setCustomerDisplayEnabled(false)
    }
  }

  function updateCustomerDisplayPreference(event: ChangeEvent<HTMLInputElement>) {
    if (!hasCustomerScreen) {
      localStorage.removeItem(customerDisplayStorageKey)
      setCustomerDisplayEnabled(false)
      return
    }

    setCustomerDisplayEnabled(event.target.checked)
    localStorage.setItem(customerDisplayStorageKey, String(event.target.checked))
  }

  function openCustomerDisplayWindow() {
    if (!customerDisplayEnabled) {
      return
    }

    const displayWindow = window.open(
      '',
      'pos-grocery-customer-display',
      'popup,width=900,height=700',
    )

    if (!displayWindow) {
      setNotice('เปิดหน้าต่างจอลูกค้าไม่สำเร็จ')
      return
    }

    customerDisplayWindowRef.current = displayWindow
    displayWindow.document.open()
    displayWindow.document.write(buildCustomerDisplayHtml({ store, cart, cartTotal, lastSale }))
    displayWindow.document.close()
  }

  function checkout() {
    if (cart.length === 0) {
      setNotice('ตะกร้ายังว่าง')
      return
    }
    if (cashReceived < cartTotal) {
      setNotice('รับเงินไม่พอ')
      return
    }

    setProducts((current) =>
      current.map((product) => {
        const item = cart.find((line) => line.productId === product.id)
        return item ? { ...product, stockQuantity: product.stockQuantity - item.quantity } : product
      }),
    )

    const sale: Sale = {
      id: crypto.randomUUID(),
      receiptNumber: `RC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      soldAt: new Date().toISOString(),
      items: cart,
      total: cartTotal,
      cashReceived,
      changeDue: cashReceived - cartTotal,
    }
    setLastSale(sale)
    setCart([])
    setNotice('ขายสำเร็จ')
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>POS Grocery</h1>
          <p>ระบบ POS ร้านของชำ: ตั้งค่าร้าน จัดการสินค้า รับของ ขาย ออกบิล และรายงาน</p>
        </div>
        <div className="status-pill">{notice}</div>
      </header>

      <section className="metric-strip" aria-label="สรุปสถานะ">
        <div>
          <span>ยอดขายล่าสุด</span>
          <strong>{lastSale ? baht(lastSale.total) : '0.00'} บาท</strong>
        </div>
        <div>
          <span>สินค้า active</span>
          <strong>{products.filter((product) => product.status === 'active').length}</strong>
        </div>
        <div>
          <span>stock รวม</span>
          <strong>{products.reduce((sum, product) => sum + product.stockQuantity, 0)}</strong>
        </div>
      </section>

      <section className="customer-display-control" aria-labelledby="customer-display-control-title">
        <div>
          <h2 id="customer-display-control-title">หน้าจอลูกค้า</h2>
          <p>
            {hasCustomerScreen
              ? 'พร้อมแสดงหน้าจอสำหรับลูกค้าเมื่อมีจอที่สอง'
              : 'ใช้ได้เมื่อพบการต่อ 2 จอเท่านั้น'}
          </p>
        </div>
        <div className="customer-display-actions">
          <label className="toggle-field">
            <input
              checked={customerDisplayEnabled}
              disabled={!hasCustomerScreen}
              onChange={updateCustomerDisplayPreference}
              type="checkbox"
            />
            เปิดหน้าจอลูกค้า
          </label>
          <button className="ghost-button" onClick={refreshCustomerDisplayAvailability} type="button">
            ตรวจจออีกครั้ง
          </button>
          <button
            className="ghost-button"
            disabled={!customerDisplayEnabled}
            onClick={openCustomerDisplayWindow}
            type="button"
          >
            เปิดหน้าต่างจอลูกค้า
          </button>
        </div>
      </section>

      {customerDisplayEnabled ? (
        <section className="customer-display-screen" aria-labelledby="customer-display-title">
          <div>
            <p>{store.name}</p>
            <h2 id="customer-display-title">จอลูกค้า</h2>
          </div>
          <div className="customer-cart">
            {cart.length > 0 ? (
              cart.map((item) => (
                <div className="customer-cart-row" key={item.productId}>
                  <span>{item.productName} x{item.quantity}</span>
                  <strong>{baht(item.quantity * item.unitPrice)} บาท</strong>
                </div>
              ))
            ) : (
              <p>รอรายการสินค้า</p>
            )}
          </div>
          <strong className="customer-total">ยอดที่ต้องชำระ {baht(cartTotal)} บาท</strong>
          {lastSale ? <span>บิลล่าสุด {lastSale.receiptNumber}</span> : null}
        </section>
      ) : null}

      <div className="operations-grid">
        <section className="panel store-panel" aria-labelledby="store-title">
          <h2 id="store-title">ข้อมูลร้านค้า</h2>
          <div className="form-grid">
            <Field label="ชื่อร้าน">
              <input value={store.name} onChange={(event) => updateStore('name', event.target.value)} />
            </Field>
            <Field label="เบอร์โทร">
              <input value={store.phone} onChange={(event) => updateStore('phone', event.target.value)} />
            </Field>
            <Field label="ที่อยู่">
              <textarea value={store.address} onChange={(event) => updateStore('address', event.target.value)} />
            </Field>
            <Field label="เจ้าของร้าน">
              <input
                value={store.ownerName}
                onChange={(event) => updateStore('ownerName', event.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="panel" aria-labelledby="users-title">
          <h2 id="users-title">ผู้ใช้ระบบ</h2>
          <form className="compact-form" onSubmit={createUser}>
            <input name="username" placeholder="username" required />
            <input name="displayName" placeholder="ชื่อผู้ใช้" required />
            <select name="role" defaultValue="cashier">
              <option value="owner">owner</option>
              <option value="admin">admin</option>
              <option value="cashier">cashier</option>
              <option value="stock">stock</option>
            </select>
            <button type="submit">เพิ่มผู้ใช้</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>ชื่อ</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>{user.displayName}</td>
                    <td>{user.role}</td>
                    <td>{user.status}</td>
                    <td>
                      <button
                        className="ghost-button"
                        onClick={() =>
                          setUsers((current) =>
                            current.map((row) =>
                              row.id === user.id ? { ...row, status: 'inactive' } : row,
                            ),
                          )
                        }
                        type="button"
                      >
                        ปิดใช้งาน
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel wide-panel" aria-labelledby="products-title">
          <h2 id="products-title">สินค้า</h2>
          <form className="compact-form product-form" onSubmit={createProduct}>
            <input name="name" placeholder="ชื่อสินค้า" required />
            <input name="barcode" placeholder="barcode" required />
            <input name="sku" placeholder="SKU" />
            <input name="unit" placeholder="หน่วย" required />
            <input name="costPrice" placeholder="ต้นทุน" type="number" min="0" step="0.01" required />
            <input name="salePrice" placeholder="ราคาขาย" type="number" min="0" step="0.01" required />
            <input aria-label="Upload รูปสินค้าไป Cloudinary" type="file" />
            <button type="submit">เพิ่มสินค้า</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>รูป</th>
                  <th>สินค้า</th>
                  <th>Barcode</th>
                  <th>ต้นทุน</th>
                  <th>ขาย</th>
                  <th>Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <img alt={product.name} className="product-thumb" src={product.imageUrl} />
                    </td>
                    <td>
                      <strong>{product.name}</strong>
                      <span>{product.sku}</span>
                    </td>
                    <td>{product.barcode}</td>
                    <td>{baht(product.costPrice)}</td>
                    <td>{baht(product.salePrice)}</td>
                    <td>คงเหลือ {product.stockQuantity}</td>
                    <td>{product.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel" aria-labelledby="inventory-title">
          <h2 id="inventory-title">รับของเข้า / ตรวจนับ stock</h2>
          <div className="inventory-list">
            {products.map((product) => (
              <div className="inventory-row" key={product.id}>
                <div>
                  <strong>{product.name}</strong>
                  <span>{product.barcode}</span>
                </div>
                <div className="stepper">
                  <button type="button" onClick={() => updateProductStock(product.id, 1, 'receive')}>
                    รับ +1
                  </button>
                  <button type="button" onClick={() => updateProductStock(product.id, 20, 'count')}>
                    นับเป็น 20
                  </button>
                </div>
              </div>
            ))}
          </div>
          <a className="export-link" href={`${apiBaseUrl}/inventory/export.xlsx`}>
            Export inventory Excel
          </a>
        </section>

        <section className="panel pos-panel" aria-labelledby="pos-title">
          <h2 id="pos-title">ขายสินค้า / Scan barcode</h2>
          <div className="scan-grid">
            <Field label="Barcode">
              <input value={barcode} onChange={(event) => setBarcode(event.target.value)} />
            </Field>
            <Field label="จำนวนขาย">
              <input
                min="1"
                type="number"
                value={saleQuantity}
                onChange={(event) => setSaleQuantity(Number(event.target.value))}
              />
            </Field>
            <button type="button" onClick={addScannedItem}>
              เพิ่มลงตะกร้า
            </button>
          </div>
          <div className="cart-list">
            {cart.map((item) => (
              <div className="cart-row" key={item.productId}>
                <span>{item.productName}</span>
                <strong>
                  {item.quantity} x {baht(item.unitPrice)}
                </strong>
              </div>
            ))}
          </div>
          <p className="total-line">ยอดรวม {baht(cartTotal)} บาท</p>
          <Field label="รับเงินสด">
            <input
              min="0"
              type="number"
              value={cashReceived}
              onChange={(event) => setCashReceived(Number(event.target.value))}
            />
          </Field>
          <button className="primary-button" type="button" onClick={checkout}>
            ชำระเงิน
          </button>
        </section>

        <section className="panel receipt-panel" aria-labelledby="receipt-title">
          <h2 id="receipt-title">ใบเสร็จ</h2>
          {lastSale ? (
            <>
              <div className="receipt-paper">
                <strong>{store.name}</strong>
                <span>{lastSale.receiptNumber}</span>
                {lastSale.items.map((item) => (
                  <span key={item.productId}>
                    {item.productName} x{item.quantity} = {baht(item.quantity * item.unitPrice)}
                  </span>
                ))}
                <strong>ยอดรวม {baht(lastSale.total)} บาท</strong>
                <strong>เงินทอน {baht(lastSale.changeDue)} บาท</strong>
              </div>
              <button type="button" onClick={() => window.print()}>
                Print receipt
              </button>
            </>
          ) : (
            <p>ยังไม่มีบิลล่าสุด</p>
          )}
        </section>

        <section className="panel" aria-labelledby="reports-title">
          <h2 id="reports-title">รายงานยอดขาย</h2>
          <div className="date-row">
            <input aria-label="วันที่เริ่ม" type="date" defaultValue="2026-06-28" />
            <input aria-label="วันที่สิ้นสุด" type="date" defaultValue="2026-06-28" />
          </div>
          <dl className="summary-list">
            <div>
              <dt>จำนวนบิล</dt>
              <dd>{lastSale ? 1 : 0}</dd>
            </div>
            <div>
              <dt>ยอดขาย</dt>
              <dd>{lastSale ? baht(lastSale.total) : '0.00'} บาท</dd>
            </div>
            <div>
              <dt>จำนวนชิ้น</dt>
              <dd>{lastSale?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0}</dd>
            </div>
          </dl>
          <a className="export-link" href={`${apiBaseUrl}/reports/export.xlsx`}>
            Export report Excel
          </a>
        </section>

        <section className="panel" aria-labelledby="dashboard-title">
          <h2 id="dashboard-title">Dashboard</h2>
          <div className="dashboard-grid">
            <div>
              <h3>สินค้าขายดี</h3>
              {bestSellers.length > 0 ? (
                bestSellers.map((item) => (
                  <p key={item.productName}>
                    {item.productName} ขาย {item.quantity} ชิ้น
                  </p>
                ))
              ) : (
                <p>รอข้อมูลยอดขาย</p>
              )}
            </div>
            <div>
              <h3>ช่วงเวลาขายดี</h3>
              <p>{lastSale ? 'ช่วงเช้า 09:00-10:00' : 'รอข้อมูลยอดขาย'}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
