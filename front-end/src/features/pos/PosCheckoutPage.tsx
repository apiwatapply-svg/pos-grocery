import { type ReactNode, useEffect, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import { apiGet, apiPost } from '../../lib/api/client'
import { formatNumber } from '../../lib/format/number'
import { confirmDeleteAction } from '../../lib/ui/confirm'
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
  soldAt?: string
  items: CartItem[]
  total: number
  cashReceived: number
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
  soldAt?: string
  totalSatang: number
  cashReceivedSatang?: number
  changeDueSatang: number
  status: 'completed' | 'void' | 'cancelled'
  items?: Array<{
    productId: string
    productName: string
    barcode: string
    quantity: number
    unitPriceSatang: number
  }>
}

type CurrentStore = {
  id?: string
  name: string
  address?: string
  logoUrl?: string
  phone?: string
}

const quickCashAmounts = [5, 10, 20, 50, 100, 500, 1000]

const posCartStorageKeyPrefix = 'pos-grocery:pos-cart'

function posCartStorageKey(storeId: string) {
  return `${posCartStorageKeyPrefix}:${storeId}`
}

function loadCartFromStorage(storeId: string): CartItem[] {
  try {
    const raw = localStorage.getItem(posCartStorageKey(storeId))
    if (!raw) {
      return []
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter(
      (item): item is CartItem =>
        item !== null &&
        typeof item === 'object' &&
        typeof (item as CartItem).productId === 'string' &&
        typeof (item as CartItem).productName === 'string' &&
        typeof (item as CartItem).barcode === 'string' &&
        typeof (item as CartItem).quantity === 'number' &&
        typeof (item as CartItem).unitPrice === 'number',
    )
  } catch {
    return []
  }
}

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

function buildSaleSummaryHtml(sale: Sale, cart: CartItem[]): string {
  const itemRows = (sale.items.length > 0 ? sale.items : cart)
    .map((item) => {
      const lineTotal = item.quantity * item.unitPrice
      return `
        <tr>
          <td style="text-align:left;padding:6px 8px;border-bottom:1px solid #e0e5dd;">${item.productName}</td>
          <td style="text-align:right;padding:6px 8px;border-bottom:1px solid #e0e5dd;white-space:nowrap;">${formatNumber(item.quantity)}</td>
          <td style="text-align:right;padding:6px 8px;border-bottom:1px solid #e0e5dd;white-space:nowrap;">${baht(item.unitPrice)}</td>
          <td style="text-align:right;padding:6px 8px;border-bottom:1px solid #e0e5dd;white-space:nowrap;">${baht(lineTotal)}</td>
        </tr>
      `
    })
    .join('')

  return `
    <div style="text-align:left;font-size:14px;color:#17201b;">
      <p style="margin:0 0 8px;color:#536259;">
        เลขที่บิล <strong style="color:#102017;">${sale.receiptNumber}</strong>
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
        <thead>
          <tr style="background:#eef2ed;">
            <th style="text-align:left;padding:6px 8px;font-size:12px;color:#4a5a50;">สินค้า</th>
            <th style="text-align:right;padding:6px 8px;font-size:12px;color:#4a5a50;">จำนวน</th>
            <th style="text-align:right;padding:6px 8px;font-size:12px;color:#4a5a50;">ราคา</th>
            <th style="text-align:right;padding:6px 8px;font-size:12px;color:#4a5a50;">รวม</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div style="display:grid;gap:4px;padding:10px 12px;background:#f7faf7;border:1px solid #dfe7df;border-radius:6px;">
        <div style="display:flex;justify-content:space-between;">
          <span>ยอดรวม</span>
          <strong>${baht(sale.total)} บาท</strong>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span>รับเงิน</span>
          <strong>${baht(sale.cashReceived)} บาท</strong>
        </div>
        <div style="display:flex;justify-content:space-between;color:#0f6b3b;">
          <span>เงินทอน</span>
          <strong>${baht(sale.changeDue)} บาท</strong>
        </div>
      </div>
    </div>
  `
}

function buildConfirmationHtml(cart: CartItem[], cartTotal: number, cashReceived: number, changeDue: number): string {
  const itemRows = cart
    .map((item) => {
      const lineTotal = item.quantity * item.unitPrice
      return `
        <tr>
          <td style="text-align:left;padding:6px 8px;border-bottom:1px solid #e0e5dd;">${item.productName}</td>
          <td style="text-align:right;padding:6px 8px;border-bottom:1px solid #e0e5dd;white-space:nowrap;">${formatNumber(item.quantity)}</td>
          <td style="text-align:right;padding:6px 8px;border-bottom:1px solid #e0e5dd;white-space:nowrap;">${baht(item.unitPrice)}</td>
          <td style="text-align:right;padding:6px 8px;border-bottom:1px solid #e0e5dd;white-space:nowrap;">${baht(lineTotal)}</td>
        </tr>
      `
    })
    .join('')

  return `
    <div style="text-align:left;font-size:14px;color:#17201b;">
      <p style="margin:0 0 8px;color:#536259;">รายการสินค้าในตะกร้า</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
        <thead>
          <tr style="background:#eef2ed;">
            <th style="text-align:left;padding:6px 8px;font-size:12px;color:#4a5a50;">สินค้า</th>
            <th style="text-align:right;padding:6px 8px;font-size:12px;color:#4a5a50;">จำนวน</th>
            <th style="text-align:right;padding:6px 8px;font-size:12px;color:#4a5a50;">ราคา</th>
            <th style="text-align:right;padding:6px 8px;font-size:12px;color:#4a5a50;">รวม</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div style="display:grid;gap:4px;padding:10px 12px;background:#f7faf7;border:1px solid #dfe7df;border-radius:6px;">
        <div style="display:flex;justify-content:space-between;">
          <span>ยอดรวม</span>
          <strong>${baht(cartTotal)} บาท</strong>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span>รับเงิน</span>
          <strong>${baht(cashReceived)} บาท</strong>
        </div>
        <div style="display:flex;justify-content:space-between;color:#0f6b3b;">
          <span>เงินทอน</span>
          <strong>${baht(changeDue)} บาท</strong>
        </div>
      </div>
    </div>
  `
}

function mapApiSale(sale: ApiSale): Sale {
  return {
    id: sale.id,
    receiptNumber: sale.receiptNumber,
    soldAt: sale.soldAt,
    items: (sale.items ?? []).map((item) => ({
      productId: item.productId,
      productName: item.productName,
      barcode: item.barcode ?? '',
      quantity: item.quantity,
      unitPrice: item.unitPriceSatang / 100,
    })),
    total: sale.totalSatang / 100,
    cashReceived: (sale.cashReceivedSatang ?? sale.totalSatang + sale.changeDueSatang) / 100,
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
  const productQueryInputRef = useRef<HTMLInputElement>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [productQuery, setProductQuery] = useState('')
  const [cashReceived, setCashReceived] = useState(100)
  const [lastSale, setLastSale] = useState<Sale | null>(null)
  const [currentStore, setCurrentStore] = useState<CurrentStore>({ name: 'POS Grocery' })
  const [notice, setNotice] = useState('พร้อมขาย')
  const [isCheckoutSubmitting, setIsCheckoutSubmitting] = useState(false)

  const cartTotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const hasCartItems = cart.length > 0
  const displayCashReceived = hasCartItems ? cashReceived : 0
  const changeDue = displayCashReceived - cartTotal
  const paymentStatusLabel =
    !hasCartItems ? 'รอสินค้า' : changeDue < 0 ? 'ขาดอีก' : changeDue === 0 ? 'จ่ายพอดี' : 'เงินทอน'
  const canCheckout = hasCartItems && cashReceived >= cartTotal && !isCheckoutSubmitting
  const activeProducts = products.filter((product) => product.status === 'active')

  function focusProductQuery() {
    productQueryInputRef.current?.focus()
  }

  useEffect(() => {
    focusProductQuery()
  }, [])

  useEffect(() => {
    function handleDocumentMouseDown(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) {
        focusProductQuery()
        return
      }

      if (productQueryInputRef.current?.contains(target)) {
        return
      }

      if (target.closest('.swal2-container')) {
        return
      }

      if (target.closest('[data-keep-focus="allow"]')) {
        return
      }

      if (target.closest('a, [role="link"]')) {
        return
      }

      event.preventDefault()
      focusProductQuery()
    }

    function handleWindowBlur() {
      window.setTimeout(() => {
        if (document.activeElement instanceof HTMLElement) {
          if (productQueryInputRef.current?.contains(document.activeElement)) {
            return
          }
          if (document.activeElement.closest('.swal2-container')) {
            return
          }
          if (document.activeElement.closest('[data-keep-focus="allow"]')) {
            return
          }
          focusProductQuery()
        } else {
          focusProductQuery()
        }
      }, 0)
    }

    document.addEventListener('mousedown', handleDocumentMouseDown)
    window.addEventListener('blur', handleWindowBlur)
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [])

  async function refreshProducts() {
    const apiProducts = await apiGet<ApiProduct[]>('/products?view=operation')
    setProducts((current) => {
      const nextProducts = mapApiProducts(apiProducts, current)
      return productsAreSame(current, nextProducts) ? current : nextProducts
    })
  }

  useEffect(() => {
    let active = true

    function loadInitialPosData() {
      const productsRequest = apiGet<ApiProduct[]>('/products?view=operation')
      const storeRequest = apiGet<CurrentStore>('/store/current')

      productsRequest
        .then((apiProducts) => {
          if (!active) {
            return
          }

          setProducts((current) => {
            const nextProducts = mapApiProducts(apiProducts, current)
            return productsAreSame(current, nextProducts) ? current : nextProducts
          })
        })
        .catch((error: unknown) => {
          if (active) {
            setNotice(error instanceof Error ? error.message : 'โหลดสินค้าไม่สำเร็จ')
          }
        })

      storeRequest
        .then((store) => {
          if (!active) {
            return
          }

          setCurrentStore({
            id: store.id,
            address: store.address,
            name: store.name || 'POS Grocery',
            logoUrl: store.logoUrl,
            phone: store.phone,
          })
          if (store.id) {
            setCart(loadCartFromStorage(store.id))
          }
        })
        .catch(() => {
          if (active) {
            setCurrentStore({ name: 'POS Grocery' })
          }
        })
    }

    loadInitialPosData()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    writeCustomerDisplayPayload({
      store: currentStore,
      cart,
      cartTotal,
      cashReceived: displayCashReceived,
      changeDue,
      lastSale,
    })
  }, [cart, cartTotal, displayCashReceived, changeDue, currentStore, lastSale])

  useEffect(() => {
    const storeId = currentStore.id
    if (!storeId) {
      return
    }
    const key = posCartStorageKey(storeId)
    if (cart.length === 0) {
      localStorage.removeItem(key)
      return
    }
    localStorage.setItem(key, JSON.stringify(cart))
  }, [cart, currentStore.id])

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

  async function addProductToCart(product: Product) {
    if (product.stockQuantity <= 0) {
      setProductQuery('')
      setNotice(`สินค้า "${product.name}" หมด stock`)
      await Swal.fire({
        title: 'สินค้าหมด stock',
        text: `"${product.name}" หมด stock แล้ว กรุณาไปเพิ่ม stock ที่หน้ารับสินค้าเข้าก่อน`,
        icon: 'warning',
        confirmButtonText: 'OK',
        confirmButtonColor: '#15803d',
        allowEscapeKey: false,
        allowOutsideClick: false,
      })
      setProductQuery('')
      focusProductQuery()
      return
    }

    const existingQuantity = cart.find((item) => item.productId === product.id)?.quantity ?? 0
    if (product.stockQuantity < existingQuantity + 1) {
      setNotice('stock ไม่พอ')
      setProductQuery('')
      focusProductQuery()
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
        {
          productId: product.id,
          productName: product.name,
          barcode: product.barcode,
          imageUrl: product.imageUrl,
          quantity: 1,
          unitPrice: product.salePrice,
        },
        ...current,
      ]
    })
    setProductQuery('')
    setNotice(`${product.name} added`)
    focusProductQuery()
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

  async function removeCartItem(productId: string) {
    const productName = cart.find((item) => item.productId === productId)?.productName
    const { isConfirmed } = await confirmDeleteAction({
      title: 'เอาออกจากตะกร้า?',
      text: productName
        ? `${productName} จะถูกเอาออกจากตะกร้าการขายนี้`
        : 'รายการนี้จะถูกเอาออกจากตะกร้าการขายนี้',
      confirmText: 'เอาออก',
    })
    if (!isConfirmed) {
      return
    }
    setCart((current) => current.filter((item) => item.productId !== productId))
    setNotice(productName ? `เอา ${productName} ออกจากตะกร้าแล้ว` : 'เอารายการออกจากตะกร้าแล้ว')
    focusProductQuery()
  }

  function adjustCartItemQuantity(productId: string, delta: number) {
    const cartItem = cart.find((item) => item.productId === productId)
    const product = products.find((currentProduct) => currentProduct.id === productId)

    if (!cartItem) {
      return
    }

    const maxQuantity = product?.stockQuantity ?? cartItem.quantity
    const nextQuantity = cartItem.quantity + delta

    if (nextQuantity < 1) {
      focusProductQuery()
      return
    }

    if (nextQuantity > maxQuantity) {
      setNotice('stock ไม่พอ')
      focusProductQuery()
      return
    }

    setCart((current) =>
      current.map((item) =>
        item.productId === productId ? { ...item, quantity: nextQuantity } : item,
      ),
    )
    setNotice(`${cartItem.productName} จำนวน ${formatNumber(nextQuantity)}`)
    focusProductQuery()
  }

  async function checkout() {
    if (isCheckoutSubmitting) {
      return
    }
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
      html: buildConfirmationHtml(cart, cartTotal, cashReceived, changeDue),
      icon: 'question',
      showCancelButton: true,
      title: 'ยืนยันรับชำระเงิน',
      width: 520,
    })

    if (!result.isConfirmed) {
      return
    }

    try {
      setIsCheckoutSubmitting(true)
      const soldCart = cart
      const sale = await apiPost<ApiSale>('/sales/checkout', {
        barcodeItems: soldCart.map((item) => ({
          barcode: item.barcode,
          quantity: item.quantity,
        })),
        cashReceivedSatang: Math.round(cashReceived * 100),
        paymentMethod: 'cash',
      })
      setLastSale(mapApiSale(sale))
      setProducts((current) =>
        current.map((product) => {
          const soldItem = soldCart.find((item) => item.productId === product.id)
          return soldItem
            ? { ...product, stockQuantity: Math.max(0, product.stockQuantity - soldItem.quantity) }
            : product
        }),
      )
      setCart([])
      setNotice('ขายสำเร็จ')
      const completedSale = mapApiSale(sale)
      void Swal.fire({
        allowEscapeKey: false,
        allowOutsideClick: false,
        confirmButtonColor: '#15803d',
        confirmButtonText: 'ยืนยัน',
        html: buildSaleSummaryHtml(completedSale, soldCart),
        icon: 'success',
        title: 'บันทึกการขายเรียบร้อย',
        width: 520,
      })
      void refreshProducts().catch((error: unknown) => {
        setNotice(error instanceof Error ? error.message : 'โหลด stock ล่าสุดไม่สำเร็จ')
      })
      focusProductQuery()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'ขายไม่สำเร็จ')
    } finally {
      setIsCheckoutSubmitting(false)
    }
  }

  return (
    <section className="route-page" aria-labelledby="pos-title">
      <div className="page-header">
        <div>
          <h1 id="pos-title">ขายสินค้า / Scan barcode</h1>
        </div>
        <div className="status-pill">{notice}</div>
      </div>

      <div className="pos-workspace">
        <section className="panel pos-panel pos-panel-large" aria-labelledby="checkout-title">
          <h2 id="checkout-title">Checkout</h2>
          <div className="pos-scan-bar">
            <label className="field" htmlFor="pos-product-query">
              <input
                aria-label="สแกนหรือค้นหาสินค้า"
                autoComplete="off"
                id="pos-product-query"
                list="pos-product-options"
                placeholder="สแกน barcode / QR หรือพิมพ์ชื่อสินค้า"
                ref={productQueryInputRef}
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
                >{`${product.name} - ${product.barcode} - ${baht(product.salePrice)} บาท`}</option>
              ))}
            </datalist>
          </div>
          <div className="cart-table-wrap pos-scroll-area">
            {cart.length > 0 ? (
              <table className="cart-table" aria-label="รายการสินค้าในตะกร้า">
                <colgroup>
                  <col className="col-no" />
                  <col className="col-image" />
                  <col className="col-product" />
                  <col className="col-price" />
                  <col className="col-quantity" />
                  <col className="col-total" />
                  <col className="col-action" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">No</th>
                    <th scope="col">ภาพ</th>
                    <th scope="col">สินค้า</th>
                    <th scope="col">ราคา</th>
                    <th scope="col">จำนวน</th>
                    <th scope="col">ราคารวม</th>
                    <th scope="col">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, index) => {
                    const product = products.find((currentProduct) => currentProduct.id === item.productId)
                    const maxQuantity = product?.stockQuantity ?? item.quantity

                    return (
                      <tr key={item.productId}>
                        <td>{formatNumber(index + 1)}</td>
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
                        <td>
                          <div className="cart-quantity-control" aria-label={`ปรับจำนวน ${item.productName}`} data-keep-focus="allow">
                            <button
                              aria-label={`ลดจำนวน ${item.productName}`}
                              className="quantity-step-button quantity-step-button-minus"
                              disabled={item.quantity <= 1}
                              onClick={() => adjustCartItemQuantity(item.productId, -1)}
                              type="button"
                            >
                              -
                            </button>
                            <span className="cart-quantity-value" aria-label={`จำนวน ${item.productName}`}>
                              {formatNumber(item.quantity)}
                            </span>
                            <button
                              aria-label={`เพิ่มจำนวน ${item.productName}`}
                              className="quantity-step-button quantity-step-button-plus"
                              disabled={item.quantity >= maxQuantity}
                              onClick={() => adjustCartItemQuantity(item.productId, 1)}
                              type="button"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td>{baht(item.quantity * item.unitPrice)}</td>
                        <td>
                          <button
                            aria-label={`เอา ${item.productName} ออกจากตะกร้า`}
                            className="cart-remove-button"
                            data-keep-focus="allow"
                            onClick={() => removeCartItem(item.productId)}
                            type="button"
                          >
                            ลบ
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <p className="empty-hint">สแกนหรือเลือกสินค้าจากช่องค้นหา</p>
            )}
          </div>
          <div className="pos-checkout-footer">
            <p className="total-line">ยอดรวม {baht(cartTotal)} บาท</p>
            <div className="payment-box">
              <div className="payment-input-row">
                <Field label="รับเงินสด">
                  <input
                    data-keep-focus="allow"
                    disabled={!hasCartItems}
                    min="0"
                    type="number"
                    value={displayCashReceived}
                    onChange={(event) => setCashReceived(Number(event.target.value))}
                  />
                </Field>
                <div
                  aria-label={`${paymentStatusLabel} ${baht(Math.abs(changeDue))} บาท`}
                  className={!hasCartItems ? 'change-summary idle' : changeDue >= 0 ? 'change-summary positive' : 'change-summary negative'}
                  role="status"
                >
                  <span>{paymentStatusLabel}</span>
                  <strong>{baht(Math.abs(changeDue))} บาท</strong>
                </div>
              </div>
              <div className="quick-cash-grid" aria-label="เลือกจำนวนเงินสด" data-keep-focus="allow">
                <button
                  className={hasCartItems && cashReceived === cartTotal ? 'quick-cash-button selected' : 'quick-cash-button'}
                  disabled={!hasCartItems}
                  type="button"
                  onClick={() => setCashReceived(cartTotal)}
                >
                  จ่ายพอดี
                </button>
                {quickCashAmounts.map((amount) => (
                  <button
                    className={hasCartItems && cashReceived === amount ? 'quick-cash-button selected' : 'quick-cash-button'}
                    disabled={!hasCartItems}
                    key={amount}
                    type="button"
                    onClick={() => setCashReceived(amount)}
                  >
                    {formatNumber(amount)} บาท
                  </button>
                ))}
              </div>
            </div>
            <button className="primary-button" data-keep-focus="allow" disabled={!canCheckout} type="button" onClick={() => void checkout()}>
              {isCheckoutSubmitting ? 'กำลังบันทึก...' : 'ชำระเงิน'}
            </button>
          </div>
        </section>

      </div>
    </section>
  )
}
