import { type ReactNode, useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import { apiGet, apiPost } from '../../lib/api/client'
import { readSession } from '../../lib/auth/session'
import type { ApiSale as ReportApiSale, SalesReport } from '../reports/reportApi'
import { baht, writeCustomerDisplayPayload } from './customerDisplay'

type Product = {
  id: string
  name: string
  barcode: string
  imageUrl?: string
  salePrice: number
  stockQuantity: number
  initialStockQuantity: number
  status: 'active' | 'inactive'
}

type CartItem = {
  productId: string
  productName: string
  barcode: string
  imageUrl?: string
  quantity: number
  unitPrice: number
}

type Sale = {
  id?: string
  receiptNumber: string
  items: CartItem[]
  total: number
  changeDue: number
  status: 'completed' | 'cancelled'
  cancelledBy?: string
}

type ApiProduct = {
  id: string
  name: string
  barcode: string
  images?: Array<{
    thumbnailUrl?: string
    secureUrl?: string
    altText?: string
  }>
  salePriceSatang: number
  stockQuantity: number
  status: 'active' | 'inactive'
}

type ApiSale = {
  id: string
  receiptNumber: string
  totalSatang: number
  changeDueSatang: number
  status: 'completed' | 'void' | 'cancelled'
  items: Array<{
    productId: string
    productName: string
    barcode: string
    quantity: number
    unitPriceSatang: number
  }>
}

const quickCashAmounts = [5, 10, 20, 50, 100, 500, 1000]

function mapApiProduct(product: ApiProduct, existingProduct?: Product): Product {
  return {
    id: product.id,
    name: product.name,
    barcode: product.barcode,
    imageUrl: product.images?.[0]?.thumbnailUrl ?? product.images?.[0]?.secureUrl,
    salePrice: product.salePriceSatang / 100,
    stockQuantity: product.stockQuantity,
    initialStockQuantity: existingProduct?.initialStockQuantity ?? Math.max(product.stockQuantity, 1),
    status: product.status,
  }
}

function mapApiProducts(apiProducts: ApiProduct[], currentProducts: Product[]) {
  return apiProducts.map((product) =>
    mapApiProduct(
      product,
      currentProducts.find((currentProduct) => currentProduct.id === product.id),
    ),
  )
}

function mapApiSale(sale: ApiSale | ReportApiSale): Sale {
  return {
    id: sale.id,
    receiptNumber: sale.receiptNumber,
    items: sale.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      barcode: item.barcode ?? '',
      quantity: item.quantity,
      unitPrice: item.unitPriceSatang / 100,
    })),
    total: sale.totalSatang / 100,
    changeDue: sale.changeDueSatang / 100,
    status: sale.status === 'void' ? 'cancelled' : sale.status,
  }
}

function productsAreSame(current: Product[], next: Product[]) {
  return (
    current.length === next.length &&
    current.every((product, index) => {
      const nextProduct = next[index]
      return (
        nextProduct &&
        product.id === nextProduct.id &&
        product.name === nextProduct.name &&
        product.barcode === nextProduct.barcode &&
        product.salePrice === nextProduct.salePrice &&
        product.stockQuantity === nextProduct.stockQuantity &&
        product.status === nextProduct.status
      )
    })
  )
}

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
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [productQuery, setProductQuery] = useState('')
  const [cashReceived, setCashReceived] = useState(100)
  const [receipts, setReceipts] = useState<Sale[]>([])
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [notice, setNotice] = useState('พร้อมขาย')

  const cartTotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const changeDue = cashReceived - cartTotal
  const paymentStatusLabel =
    changeDue < 0 ? 'ขาดอีก' : cartTotal > 0 && changeDue === 0 ? 'จ่ายพอดี' : 'เงินทอน'
  const canCheckout = cart.length > 0 && cashReceived >= cartTotal
  const activeProducts = products.filter((product) => product.status === 'active')
  const lastSale = receipts[0] ?? null
  const canCancelReceipt =
    session?.user.role === 'owner' || session?.user.role === 'admin'

  async function refreshProducts() {
    const apiProducts = await apiGet<ApiProduct[]>('/products')
    setProducts((current) => {
      const nextProducts = mapApiProducts(apiProducts, current)
      return productsAreSame(current, nextProducts) ? current : nextProducts
    })
  }

  async function refreshReceipts() {
    const report = await apiGet<SalesReport>('/reports/sales')
    setReceipts(report.sales.map(mapApiSale))
  }

  useEffect(() => {
    let active = true

    apiGet<ApiProduct[]>('/products')
      .then((apiProducts) => {
        if (active) {
          setProducts((current) => {
            const nextProducts = mapApiProducts(apiProducts, current)
            return productsAreSame(current, nextProducts) ? current : nextProducts
          })
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setNotice(error instanceof Error ? error.message : 'โหลดสินค้าไม่สำเร็จ')
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    apiGet<SalesReport>('/reports/sales')
      .then((report) => {
        if (active) {
          setReceipts(report.sales.map(mapApiSale))
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setNotice(error instanceof Error ? error.message : 'โหลดใบเสร็จไม่สำเร็จ')
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    writeCustomerDisplayPayload({
      store: { name: 'POS Grocery' },
      cart,
      cartTotal,
      cashReceived,
      changeDue,
      lastSale,
    })
  }, [cart, cartTotal, cashReceived, changeDue, lastSale])

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
          imageUrl: product.imageUrl,
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

    try {
      const sale = await apiPost<ApiSale>('/sales/checkout', {
        barcodeItems: cart.map((item) => ({
          barcode: item.barcode,
          quantity: item.quantity,
        })),
        cashReceivedSatang: Math.round(cashReceived * 100),
        paymentMethod: 'cash',
      })
      setReceipts((current) => [mapApiSale(sale), ...current])
      setCart([])
      setNotice('ขายสำเร็จ')
      await refreshProducts()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'ขายไม่สำเร็จ')
    }
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

    try {
      const cancelledSale = mapApiSale(await apiPost<ApiSale>(`/sales/${sale.id}/cancel`, {}))
      setReceipts((current) =>
        current.map((receipt) => (receipt.id === cancelledSale.id ? cancelledSale : receipt)),
      )
      setSelectedSale(cancelledSale)
      setNotice('ยกเลิกบิลแล้ว')
      await refreshProducts()
      await refreshReceipts()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'ยกเลิกบิลไม่สำเร็จ')
    }
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
          <div className="cart-table-wrap pos-scroll-area">
            {cart.length > 0 ? (
              <table className="cart-table" aria-label="รายการสินค้าในตะกร้า">
                <thead>
                  <tr>
                    <th scope="col">No</th>
                    <th scope="col">ภาพ</th>
                    <th scope="col">สินค้า</th>
                    <th scope="col">ราคา</th>
                    <th scope="col">จำนวน</th>
                    <th scope="col">ราคารวม</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, index) => (
                    <tr key={item.productId}>
                      <td>{index + 1}</td>
                      <td>
                        {item.imageUrl ? (
                          <img className="cart-product-image" src={item.imageUrl} alt="" />
                        ) : (
                          <span className="cart-product-image cart-product-image-empty" aria-label="ไม่มีรูป" />
                        )}
                      </td>
                      <td>
                        <strong>{item.productName}</strong>
                        <span>{item.barcode}</span>
                      </td>
                      <td>{baht(item.unitPrice)}</td>
                      <td>{item.quantity}</td>
                      <td>{baht(item.quantity * item.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                <button
                  className={cartTotal > 0 && cashReceived === cartTotal ? 'quick-cash-button selected' : 'quick-cash-button'}
                  disabled={cartTotal <= 0}
                  type="button"
                  onClick={() => setCashReceived(cartTotal)}
                >
                  จ่ายพอดี
                </button>
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
                aria-label={`${paymentStatusLabel} ${baht(Math.abs(changeDue))} บาท`}
                className={changeDue >= 0 ? 'change-summary positive' : 'change-summary negative'}
                role="status"
              >
                <span>{paymentStatusLabel}</span>
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
            <div aria-label="รายการใบเสร็จล่าสุด" className="pos-scroll-area receipt-list" role="list">
              {receipts.length > 0 ? (
                receipts.map((receipt) => (
                  <div className="receipt-row-wrap" key={receipt.receiptNumber} role="listitem">
                    <button
                      className={receipt.status === 'cancelled' ? 'receipt-row receipt-row-cancelled' : 'receipt-row'}
                      type="button"
                      onClick={() => setSelectedSale(receipt)}
                    >
                      <span>{receipt.receiptNumber}</span>
                      <strong>{baht(receipt.total)} บาท</strong>
                      <small>{receipt.status === 'cancelled' ? 'ยกเลิกแล้ว' : 'ขายสำเร็จ'}</small>
                      <em>ดูรายละเอียดบิล</em>
                    </button>
                  </div>
                ))
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
              {products.length > 0 ? products.map((product) => {
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
              }) : (
                <p className="empty-hint">ยังไม่มีสินค้าในฐานข้อมูล</p>
              )}
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
