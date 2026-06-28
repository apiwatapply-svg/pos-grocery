import { type ReactNode, useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import { readSession } from '../../lib/auth/session'
import { baht, writeCustomerDisplayPayload } from './customerDisplay'

type Product = {
  id: string
  name: string
  barcode: string
  salePrice: number
  stockQuantity: number
  initialStockQuantity: number
  status: 'active' | 'inactive'
}

type CartItem = {
  productId: string
  productName: string
  barcode: string
  quantity: number
  unitPrice: number
}

type Sale = {
  receiptNumber: string
  items: CartItem[]
  total: number
  changeDue: number
  status: 'completed' | 'cancelled'
  cancelledBy?: string
}

const initialProducts: Product[] = [
  {
    id: 'product-water',
    name: 'Drinking Water',
    barcode: '8850002000010',
    salePrice: 7,
    stockQuantity: 24,
    initialStockQuantity: 24,
    status: 'active',
  },
  {
    id: 'product-noodle',
    name: 'Instant Noodles',
    barcode: '8850001000011',
    salePrice: 12,
    stockQuantity: 18,
    initialStockQuantity: 18,
    status: 'active',
  },
]
const quickCashAmounts = [5, 10, 20, 50, 100, 500, 1000]

function stockStatus(product: Product) {
  const stockRatio = product.stockQuantity / Math.max(product.initialStockQuantity, 1)

  if (product.stockQuantity === 0) {
    return { label: 'หมดสต็อก', tone: 'empty' }
  }

  if (stockRatio <= 0.35) {
    return { label: 'ใกล้หมด', tone: 'low' }
  }

  return { label: 'พร้อมขาย', tone: 'ready' }
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

export function PosCheckoutPage() {
  const session = readSession()
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [cart, setCart] = useState<CartItem[]>([])
  const [productQuery, setProductQuery] = useState('')
  const [cashReceived, setCashReceived] = useState(100)
  const [lastSale, setLastSale] = useState<Sale | null>(null)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [notice, setNotice] = useState('พร้อมขาย')

  const cartTotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const changeDue = cashReceived - cartTotal
  const canCheckout = cart.length > 0 && cashReceived >= cartTotal
  const activeProducts = products.filter((product) => product.status === 'active')
  const canCancelReceipt =
    session?.user.role === 'owner' || session?.user.role === 'admin'

  useEffect(() => {
    writeCustomerDisplayPayload({
      store: { name: 'POS Grocery' },
      cart,
      cartTotal,
      lastSale,
    })
  }, [cart, cartTotal, lastSale])

  function findProductByQuery(query: string) {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return undefined
    }

    return activeProducts.find(
      (product) =>
        product.barcode.toLowerCase() === normalizedQuery ||
        product.name.toLowerCase() === normalizedQuery ||
        `${product.name} - ${product.barcode}`.toLowerCase() === normalizedQuery,
    )
  }

  function addProductToCart(product: Product) {
    const existingQuantity = cart.find((item) => item.productId === product.id)?.quantity ?? 0
    if (product.stockQuantity < existingQuantity + 1) {
      setNotice('stock ไม่พอ')
      return
    }

    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id)
      if (existing) {
        return current.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        )
      }

      return [
        ...current,
        {
          productId: product.id,
          productName: product.name,
          barcode: product.barcode,
          quantity: 1,
          unitPrice: product.salePrice,
        },
      ]
    })
    setProductQuery('')
    setNotice(`${product.name} added`)
  }

  function handleProductQueryChange(value: string) {
    setProductQuery(value)
    const product = findProductByQuery(value)
    if (!product) {
      return
    }
    addProductToCart(product)
  }

  function handleProductQuerySubmit() {
    const product = findProductByQuery(productQuery)
    if (!product) {
      setNotice('ไม่พบสินค้า')
      return
    }
    addProductToCart(product)
  }

  async function checkout() {
    if (cart.length === 0) {
      setNotice('ตะกร้ายังว่าง')
      return
    }
    if (cashReceived < cartTotal) {
      setNotice('รับเงินไม่พอ')
      return
    }

    const result = await Swal.fire({
      cancelButtonText: 'กลับไปแก้ไข',
      confirmButtonColor: '#15803d',
      confirmButtonText: 'ยืนยันขาย',
      icon: 'question',
      showCancelButton: true,
      text: `ยอดขาย ${baht(cartTotal)} บาท รับเงิน ${baht(cashReceived)} บาท เงินทอน ${baht(changeDue)} บาท`,
      title: 'ยืนยันรับชำระเงิน',
    })

    if (!result.isConfirmed) {
      return
    }

    setProducts((current) =>
      current.map((product) => {
        const item = cart.find((line) => line.productId === product.id)
        return item ? { ...product, stockQuantity: product.stockQuantity - item.quantity } : product
      }),
    )

    const sale: Sale = {
      receiptNumber: `RC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      items: cart,
      total: cartTotal,
      changeDue,
      status: 'completed',
    }
    setLastSale(sale)
    setCart([])
    setNotice('ขายสำเร็จ')
  }

  async function cancelSale(sale: Sale) {
    if (!canCancelReceipt) {
      setNotice('ไม่มีสิทธิ์ยกเลิกบิล')
      return
    }
    if (sale.status === 'cancelled') {
      return
    }

    const result = await Swal.fire({
      cancelButtonText: 'ไม่ยกเลิก',
      confirmButtonColor: '#b42318',
      confirmButtonText: 'ยืนยันยกเลิก',
      icon: 'warning',
      showCancelButton: true,
      text: `บิล ${sale.receiptNumber} จะถูกยกเลิกและคืน stock กลับเข้าคลัง`,
      title: 'ยืนยันยกเลิกบิล',
    })

    if (!result.isConfirmed) {
      return
    }

    const cancelledSale: Sale = {
      ...sale,
      status: 'cancelled',
      cancelledBy: session?.user.displayName,
    }

    setProducts((current) =>
      current.map((product) => {
        const item = sale.items.find((line) => line.productId === product.id)
        return item ? { ...product, stockQuantity: product.stockQuantity + item.quantity } : product
      }),
    )
    setLastSale(cancelledSale)
    setSelectedSale(cancelledSale)
    setNotice('ยกเลิกบิลแล้ว')
  }

  return (
    <section className="route-page" aria-labelledby="pos-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Sales</p>
          <h1 id="pos-title">ขายสินค้า / Scan barcode</h1>
        </div>
        <div className="status-pill">{notice}</div>
      </div>

      <div className="pos-workspace">
        <section className="panel pos-panel pos-panel-large" aria-labelledby="checkout-title">
          <h2 id="checkout-title">Checkout</h2>
          <div className="pos-scan-bar">
            <label className="field" htmlFor="pos-product-query">
              <span>สแกนหรือค้นหาสินค้า</span>
              <input
                autoComplete="off"
                id="pos-product-query"
                list="pos-product-options"
                placeholder="สแกน barcode / QR หรือพิมพ์ชื่อสินค้า"
                value={productQuery}
                onChange={(event) => handleProductQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleProductQuerySubmit()
                  }
                }}
              />
            </label>
            <datalist id="pos-product-options">
              {activeProducts.map((product) => (
                <option
                  key={product.id}
                  value={product.name}
                >{`${product.barcode} - ${baht(product.salePrice)} บาท`}</option>
              ))}
            </datalist>
          </div>
          <div className="cart-list pos-scroll-area" aria-label="รายการสินค้าในตะกร้า">
            {cart.length > 0 ? (
              cart.map((item) => (
                <div className="cart-row" key={item.productId}>
                  <div>
                    <strong>{item.productName}</strong>
                    <span>{item.barcode}</span>
                  </div>
                  <strong>
                    {item.quantity} x {baht(item.unitPrice)}
                  </strong>
                </div>
              ))
            ) : (
              <p className="empty-hint">สแกนหรือเลือกสินค้าจากช่องค้นหา</p>
            )}
          </div>
          <div className="pos-checkout-footer">
            <p className="total-line">ยอดรวม {baht(cartTotal)} บาท</p>
            <div className="payment-box">
              <Field label="รับเงินสด">
                <input
                  min="0"
                  type="number"
                  value={cashReceived}
                  onChange={(event) => setCashReceived(Number(event.target.value))}
                />
              </Field>
              <div className="quick-cash-grid" aria-label="เลือกจำนวนเงินสด">
                {quickCashAmounts.map((amount) => (
                  <button
                    className={cashReceived === amount ? 'quick-cash-button selected' : 'quick-cash-button'}
                    key={amount}
                    type="button"
                    onClick={() => setCashReceived(amount)}
                  >
                    {amount} บาท
                  </button>
                ))}
              </div>
              <div
                aria-label={`${changeDue >= 0 ? 'เงินทอน' : 'ขาดอีก'} ${baht(Math.abs(changeDue))} บาท`}
                className={changeDue >= 0 ? 'change-summary positive' : 'change-summary negative'}
                role="status"
              >
                <span>{changeDue >= 0 ? 'เงินทอน' : 'ขาดอีก'}</span>
                <strong>{baht(Math.abs(changeDue))} บาท</strong>
              </div>
            </div>
            <button className="primary-button" disabled={!canCheckout} type="button" onClick={() => void checkout()}>
              ชำระเงิน
            </button>
          </div>
        </section>

        <div className="pos-side-column">
          <section className="panel receipt-panel pos-side-panel" aria-labelledby="receipt-title">
            <h2 id="receipt-title">ใบเสร็จ</h2>
            <div className="pos-scroll-area receipt-list">
              {lastSale ? (
                <button
                  className="receipt-card"
                  type="button"
                  onClick={() => setSelectedSale(lastSale)}
                >
                  <span>{lastSale.receiptNumber}</span>
                  <strong>ยอดรวม {baht(lastSale.total)} บาท</strong>
                  <small>{lastSale.status === 'cancelled' ? 'ยกเลิกแล้ว' : 'ดูรายละเอียดบิล'}</small>
                </button>
              ) : (
                <p className="empty-hint">ยังไม่มีบิลล่าสุด</p>
              )}
            </div>
          </section>

          <section className="panel pos-side-panel stock-panel" aria-labelledby="stock-after-sale-title">
            <div className="stock-panel-header">
              <div>
                <h2 id="stock-after-sale-title">Stock หลังขาย</h2>
                <span>{products.length} SKU พร้อมตรวจนับ</span>
              </div>
            </div>
            <div
              aria-label="รายการสินค้าคงเหลือหลังขาย"
              className="pos-scroll-area stock-list"
              role="list"
            >
              {products.map((product) => {
                const status = stockStatus(product)
                const stockPercent = Math.min(
                  100,
                  Math.round((product.stockQuantity / Math.max(product.initialStockQuantity, 1)) * 100),
                )

                return (
                  <article className={`stock-card stock-card-${status.tone}`} key={product.id} role="listitem">
                    <div className="stock-card-main">
                      <div className="stock-product">
                        <strong>{product.name}</strong>
                        <span>{product.barcode}</span>
                      </div>
                      <div className="stock-quantity">
                        <strong>{product.stockQuantity}</strong>
                        <span>คงเหลือ</span>
                      </div>
                    </div>
                    <div className="stock-card-footer">
                      <span className="stock-status">{status.label}</span>
                      <span>{stockPercent}% ของตั้งต้น</span>
                    </div>
                    <div
                      aria-label={`${product.name} คงเหลือ ${product.stockQuantity} จาก ${product.initialStockQuantity}`}
                      aria-valuemax={product.initialStockQuantity}
                      aria-valuemin={0}
                      aria-valuenow={product.stockQuantity}
                      className="stock-meter"
                      role="progressbar"
                    >
                      <span style={{ width: `${stockPercent}%` }} />
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        </div>
      </div>

      {selectedSale ? (
        <div className="modal-backdrop">
          <section
            aria-labelledby="receipt-modal-title"
            aria-modal="true"
            className="modal-panel receipt-modal"
            role="dialog"
          >
            <div className="modal-header">
              <h2 id="receipt-modal-title">รายละเอียดบิล {selectedSale.receiptNumber}</h2>
              <button className="ghost-button compact" type="button" onClick={() => setSelectedSale(null)}>
                ปิด
              </button>
            </div>
            <div className="receipt-paper">
              <strong>POS Grocery</strong>
              <span>{selectedSale.receiptNumber}</span>
              <span>{selectedSale.status === 'cancelled' ? 'ยกเลิกแล้ว' : 'ขายสำเร็จ'}</span>
              {selectedSale.items.map((item) => (
                <span key={item.productId}>
                  {item.productName} x{item.quantity} = {baht(item.quantity * item.unitPrice)}
                </span>
              ))}
              <strong>ยอดรวม {baht(selectedSale.total)} บาท</strong>
              <strong>เงินทอน {baht(selectedSale.changeDue)} บาท</strong>
              {selectedSale.cancelledBy ? <span>ยกเลิกโดย {selectedSale.cancelledBy}</span> : null}
            </div>
            <div className="modal-actions">
              <button className="info-button compact" type="button" onClick={() => window.print()}>
                Print receipt
              </button>
              {canCancelReceipt && selectedSale.status === 'completed' ? (
                <button
                  className="danger-button compact"
                  type="button"
                  onClick={() => void cancelSale(selectedSale)}
                >
                  ยกเลิกบิล
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}
