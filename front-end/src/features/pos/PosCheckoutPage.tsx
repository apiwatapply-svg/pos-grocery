import { useEffect, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import {
  SearchableDropdown,
  type SearchableDropdownHandle,
  type SearchableDropdownOption,
} from '../../components/ui/SearchableDropdown'
import { apiGet, apiPost } from '../../lib/api/client'
import { formatNumber } from '../../lib/format/number'
import { confirmDeleteAction } from '../../lib/ui/confirm'
import { baht, writeCustomerDisplayPayload } from './customerDisplay'
import {
  generateBillId,
  loadHeldBills,
  MAX_HELD_BILLS,
  saveHeldBills,
  type HeldBill,
} from './heldBills'

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

// Barcode scanners type a full barcode in a tight, even burst and the
// trailing Enter arrives within a few milliseconds of the last character.
// Manual typing is much slower (200-500ms per character) and irregular, with
// pauses to look at the screen. We treat the trailing Enter as a scanner
// terminator when:
//   - at least 3 characters were typed
//   - the gap between consecutive characters is consistent, i.e. the absolute
//     difference between every pair of consecutive intervals is below
//     MAX_INTERVAL_VARIANCE_MS (50ms). A scanner (even a slow one configured
//     at 100-150ms/char) keeps a near-constant cadence; a human pauses to
//     think, looks at the screen, or mistypes, so at least one interval
//     differs from the next by more than 50ms.
//   - the last char-to-Enter gap is also included in the variance check, so a
//     trailing Enter that is far later than the last character (typical of a
//     human pressing Enter after typing) breaks the pattern.
// Any irregularity means it is manual typing and the Enter should be allowed
// to move focus to the cash input.
const MAX_INTERVAL_VARIANCE_MS = 50
const MIN_SCAN_CHAR_COUNT = 3
const MAX_SCAN_TIMESTAMP_BUFFER = 15

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

/**
 * Decides whether a burst of recent keystrokes on the scan field looks like
 * a barcode scanner rather than a human typing.
 *
 * A scanner types the whole barcode in a tight, even cadence (typically
 * 10-30ms per character, sometimes 100-150ms on slow scanners) and the
 * trailing Enter arrives within a few milliseconds of the last character.
 * A human types much slower and with pauses, so at least one inter-character
 * gap differs from the next by more than MAX_INTERVAL_VARIANCE_MS.
 *
 * Returns true when:
 *   - the burst contains at least MIN_SCAN_CHAR_COUNT characters, AND
 *   - the sequence of inter-character intervals (with the final char-to-Enter
 *     gap appended) is consistent: |intervals[i] - intervals[i-1]| <=
 *     MAX_INTERVAL_VARIANCE_MS for every consecutive pair.
 */
function isScannerBurst(timestamps: number[], now: number): boolean {
  if (timestamps.length < MIN_SCAN_CHAR_COUNT) {
    return false
  }
  const intervals: number[] = []
  for (let i = 1; i < timestamps.length; i += 1) {
    intervals.push(timestamps[i] - timestamps[i - 1])
  }
  // Include the trailing char-to-Enter gap so a delayed Enter (manual typing
  // pattern) breaks the variance check.
  intervals.push(now - timestamps[timestamps.length - 1])
  for (let i = 1; i < intervals.length; i += 1) {
    if (Math.abs(intervals[i] - intervals[i - 1]) > MAX_INTERVAL_VARIANCE_MS) {
      return false
    }
  }
  return true
}

function computeScanDebug(timestamps: number[], now: number, includeEnterGap = false) {
  if (timestamps.length < 2) {
    return {
      buffer: timestamps.length,
      lastInterval: null,
      maxVariance: null,
      isScanner: false,
    }
  }
  const intervals: number[] = []
  for (let i = 1; i < timestamps.length; i += 1) {
    intervals.push(timestamps[i] - timestamps[i - 1])
  }
  if (includeEnterGap) {
    // Mirror isScannerBurst: the trailing char-to-Enter gap is part of the
    // variance check, so include it here too. Without this, the debug box
    // could show "low variance" while the real detector is being tripped by
    // a delayed Enter.
    intervals.push(now - timestamps[timestamps.length - 1])
  }
  let maxVariance = 0
  for (let i = 1; i < intervals.length; i += 1) {
    const variance = Math.abs(intervals[i] - intervals[i - 1])
    if (variance > maxVariance) {
      maxVariance = variance
    }
  }
  return {
    buffer: timestamps.length,
    lastInterval: intervals[intervals.length - 1],
    maxVariance,
    isScanner: false,
  }
}

export function PosCheckoutPage() {
  const productQueryInputRef = useRef<SearchableDropdownHandle>(null)
  const cashReceivedInputRef = useRef<HTMLInputElement>(null)
  const checkoutButtonRef = useRef<HTMLButtonElement>(null)
  // Tracks the trailing Enter that barcode scanners append to a scan so we
  // can consume it without triggering the global focus-handoff or the
  // search-field handler (which would add the same product twice and steal
  // focus away from the scan field).
  const isConsumingScanEnterRef = useRef(false)
  // Sliding window of timestamps for the most recent onChange calls on the
  // scan field. Used together with isScannerBurst to tell a scanner's
  // trailing Enter apart from a user pressing Enter after manually typing
  // a barcode.
  const scanCharTimestampsRef = useRef<number[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [productQuery, setProductQuery] = useState('')
  const [cashReceived, setCashReceived] = useState(100)
  const [lastSale, setLastSale] = useState<Sale | null>(null)
  const [currentStore, setCurrentStore] = useState<CurrentStore>({ name: 'POS Grocery' })
  const [notice, setNotice] = useState('พร้อมขาย')
  const [isCheckoutSubmitting, setIsCheckoutSubmitting] = useState(false)
  const [heldBills, setHeldBills] = useState<HeldBill[]>([])
  const [isHeldBillsModalOpen, setIsHeldBillsModalOpen] = useState(false)
  const [scanDebug, setScanDebug] = useState<{
    buffer: number
    lastInterval: number | null
    maxVariance: number | null
    isScanner: boolean
  }>({ buffer: 0, lastInterval: null, maxVariance: null, isScanner: false })

  const cartTotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0)
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

  function focusCashReceivedInput() {
    cashReceivedInputRef.current?.focus()
    cashReceivedInputRef.current?.select()
  }

  function selectProductQuery() {
    productQueryInputRef.current?.selectAll()
  }

  useEffect(() => {
    focusProductQuery()
  }, [])

  const checkoutRef = useRef<() => Promise<void>>(async () => {})
  const hasCartItemsRef = useRef(false)

  useEffect(() => {
    hasCartItemsRef.current = hasCartItems
  }, [hasCartItems])

  useEffect(() => {
    function handleDocumentMouseDown(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) {
        focusProductQuery()
        return
      }

      if (target.closest('.pos-product-query-dropdown')) {
        return
      }

      if (cashReceivedInputRef.current?.contains(target)) {
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
          if (document.activeElement.closest('.pos-product-query-dropdown')) {
            return
          }
          if (cashReceivedInputRef.current?.contains(document.activeElement)) {
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

    function handleDocumentFocusOut() {
      window.setTimeout(() => {
        const active = document.activeElement
        if (active instanceof HTMLElement) {
          if (active.closest('.pos-product-query-dropdown')) {
            return
          }
          if (cashReceivedInputRef.current?.contains(active)) {
            return
          }
          if (active.closest('.swal2-container')) {
            return
          }
          if (active.closest('[data-keep-focus="allow"]')) {
            return
          }
        }
        // No focus on any element we care about (e.g. focus is on body or
        // somewhere outside our POS layout) — return to the scan field.
        focusProductQuery()
      }, 0)
    }

    function handleGlobalKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Enter') {
        return
      }

      const swalContainer = document.querySelector('.swal2-container')
      if (swalContainer) {
        // Enter always confirms in every SweetAlert2 dialog on the POS page,
        // even if the cancel button is currently focused.
        const confirmButton = swalContainer.querySelector('.swal2-confirm') as HTMLButtonElement | null
        if (confirmButton && !confirmButton.disabled) {
          event.preventDefault()
          confirmButton.click()
        }
        return
      }

      // Prefer event.target so the handler works even when jsdom does not
      // move document.activeElement during synthetic key events.
      const target = event.target
      const active =
        target instanceof HTMLElement
          ? target
          : (document.activeElement as HTMLElement | null)
      if (active === cashReceivedInputRef.current) {
        event.preventDefault()
        void checkoutRef.current()
        return
      }
      if (active === checkoutButtonRef.current) {
        event.preventDefault()
        void checkoutRef.current()
        return
      }
      const queryInput = document.getElementById('pos-product-query')
      if (active === queryInput || (queryInput && queryInput.contains(active))) {
        event.preventDefault()
        if (isConsumingScanEnterRef.current) {
          // The Enter is the terminator from a barcode scanner that already
          // added the product via onChange. Keep focus on the scan field so
          // the cashier can keep scanning without having to click back.
          isConsumingScanEnterRef.current = false
          return
        }
        if (hasCartItemsRef.current) {
          focusCashReceivedInput()
        } else {
          selectProductQuery()
        }
        return
      }
      event.preventDefault()
      focusProductQuery()
    }

    document.addEventListener('mousedown', handleDocumentMouseDown)
    window.addEventListener('blur', handleWindowBlur)
    document.addEventListener('focusout', handleDocumentFocusOut)
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown)
      window.removeEventListener('blur', handleWindowBlur)
      document.removeEventListener('focusout', handleDocumentFocusOut)
      document.removeEventListener('keydown', handleGlobalKeyDown)
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
            setHeldBills(loadHeldBills(store.id))
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

  const productDropdownOptions: SearchableDropdownOption[] = activeProducts.map((product) => ({
    value: product.id,
    label: product.name,
    description: `${product.barcode} · คงเหลือ ${formatNumber(product.stockQuantity)} ชิ้น`,
    trailing: <strong>{baht(product.salePrice)} บาท</strong>,
    leading: product.imageUrl ? (
      <img
        alt=""
        className="dropdown-product-image"
        src={product.imageUrl}
        onError={(event) => {
          event.currentTarget.style.visibility = 'hidden'
        }}
      />
    ) : (
      <span className="dropdown-product-image dropdown-product-image-empty" aria-hidden="true" />
    ),
  }))

  const isProductExactMatch = (option: SearchableDropdownOption, query: string) => {
    const product = activeProducts.find((p) => p.id === option.value)
    if (!product) {
      return false
    }
    const normalized = query.trim().toLowerCase()
    if (!normalized) {
      return false
    }
    return (
      product.barcode.toLowerCase() === normalized ||
      product.name.toLowerCase() === normalized ||
      `${product.name} - ${product.barcode}`.toLowerCase() === normalized
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
    const timestamps = scanCharTimestampsRef.current
    timestamps.push(Date.now())
    if (timestamps.length > MAX_SCAN_TIMESTAMP_BUFFER) {
      timestamps.splice(0, timestamps.length - MAX_SCAN_TIMESTAMP_BUFFER)
    }
    setScanDebug(computeScanDebug(timestamps, Date.now()))

    const product = findProductByQuery(value)
    if (!product) {
      return
    }
    // The trailing Enter from a barcode scanner will arrive next. Mark it
    // so the keydown handler and the global focus-handoff can ignore it
    // instead of adding the same product again or moving focus away.
    isConsumingScanEnterRef.current = true
    void addProductToCart(product)
  }

  async function handleProductSelect(option: SearchableDropdownOption) {
    // The trailing Enter from a barcode scanner also makes the dropdown
    // call onSelect (because the exact match becomes the active row).
    // Skip the duplicate add that would otherwise happen here. The flag
    // is cleared by the keydown/global handlers that observe it.
    if (isConsumingScanEnterRef.current) {
      return
    }
    const product = activeProducts.find((current) => current.id === option.value)
    if (!product) {
      setProductQuery('')
      return
    }
    await addProductToCart(product)
  }

  function handleProductScanEnter() {
    // Enter on the search field: if the typed value is an exact match,
    // add it to the cart (preserves the original scanner flow). Otherwise
    // re-focus the field so the user can keep scanning.
    const product = findProductByQuery(productQuery)
    if (product) {
      void addProductToCart(product)
    } else {
      selectProductQuery()
    }
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

  async function clearCart() {
    if (cart.length === 0) {
      focusProductQuery()
      return
    }

    const { isConfirmed } = await Swal.fire({
      cancelButtonColor: '#6b7280',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#b42318',
      confirmButtonText: 'ยืนยัน',
      icon: 'warning',
      reverseButtons: true,
      showCancelButton: true,
      text: 'รายการสินค้าทั้งหมดในตะกร้าจะถูกลบ',
      title: 'ลบสินค้าทั้งหมด?',
    })

    if (isConfirmed) {
      setCart([])
      setNotice('ลบสินค้าทั้งหมดแล้ว')
    }
    focusProductQuery()
  }

  async function holdBill() {
    if (cart.length === 0) {
      focusProductQuery()
      return
    }

    const storeId = currentStore.id
    if (!storeId) {
      void Swal.fire({
        confirmButtonText: 'OK',
        icon: 'error',
        text: 'ยังไม่ได้โหลดข้อมูลร้านค้า กรุณารอสักครู่',
        title: 'ไม่สามารถพักบิลได้',
      })
      focusProductQuery()
      return
    }

    const result = await Swal.fire({
      cancelButtonColor: '#6b7280',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#15803d',
      confirmButtonText: 'พักบิล',
      html: `
        <div style="text-align:left;font-size:14px;color:#17201b;">
          <p style="margin:0 0 10px;color:#536259;">ใส่ชื่อ/หมายเหตุสำหรับบิลนี้ (ไม่บังคับ)</p>
          <input id="swal-hold-bill-note" class="swal2-input" placeholder="เช่น ลูกค้า A, โต๊ะ 5" style="margin:0;" />
        </div>
      `,
      icon: 'question',
      preConfirm: () => {
        const input = document.getElementById('swal-hold-bill-note') as HTMLInputElement | null
        return input?.value.trim() || undefined
      },
      reverseButtons: true,
      showCancelButton: true,
      title: 'พักบิล?',
    })

    if (!result.isConfirmed) {
      focusProductQuery()
      return
    }

    const note = typeof result.value === 'string' && result.value.length > 0 ? result.value : undefined

    const heldBill: HeldBill = {
      id: generateBillId(),
      storeId,
      items: cart.map((item) => ({ ...item })),
      cashReceived,
      note,
      createdAt: new Date().toISOString(),
    }

    const nextBills = [heldBill, ...heldBills].slice(0, MAX_HELD_BILLS)
    try {
      saveHeldBills(storeId, nextBills)
      setHeldBills(nextBills)
      setCart([])
      setNotice(note ? `พักบิล "${note}" แล้ว` : 'พักบิลแล้ว')
    } catch {
      void Swal.fire({
        confirmButtonText: 'OK',
        icon: 'error',
        text: 'ไม่สามารถบันทึกบิลที่พักได้ กรุณาลองใหม่',
        title: 'บันทึกไม่สำเร็จ',
      })
    }
    focusProductQuery()
  }

  async function resumeHeldBill(bill: HeldBill) {
    if (cart.length > 0) {
      const { isConfirmed } = await Swal.fire({
        cancelButtonColor: '#6b7280',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#15803d',
        confirmButtonText: 'แทนที่',
        icon: 'warning',
        reverseButtons: true,
        showCancelButton: true,
        text: 'รายการสินค้าปัจจุบันในตะกร้าจะถูกแทนที่',
        title: 'แทนที่รายการสินค้า?',
      })
      if (!isConfirmed) {
        return
      }
    }

    const storeId = currentStore.id
    if (!storeId) {
      return
    }

    setCart(bill.items.map((item) => ({ ...item })))
    setCashReceived(bill.cashReceived)
    const nextBills = heldBills.filter((b) => b.id !== bill.id)
    try {
      saveHeldBills(storeId, nextBills)
      setHeldBills(nextBills)
    } catch {
      // If storage fails, still keep the cart updated so the user can keep
      // working — the held list will fall back to memory until the next
      // successful save.
    }
    setNotice(bill.note ? `เรียกบิล "${bill.note}" กลับมาแล้ว` : 'เรียกบิลกลับมาแล้ว')
    setIsHeldBillsModalOpen(false)
    focusProductQuery()
  }

  async function deleteHeldBill(billId: string) {
    const bill = heldBills.find((b) => b.id === billId)
    if (!bill) {
      return
    }

    const { isConfirmed } = await Swal.fire({
      cancelButtonColor: '#6b7280',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#b42318',
      confirmButtonText: 'ลบ',
      icon: 'warning',
      reverseButtons: true,
      showCancelButton: true,
      text: bill.note
        ? `บิล "${bill.note}" จะถูกลบออกจากรายการบิลที่พัก`
        : 'บิลนี้จะถูกลบออกจากรายการบิลที่พัก',
      title: 'ลบบิลที่พัก?',
    })

    if (!isConfirmed) {
      return
    }

    const storeId = currentStore.id
    if (!storeId) {
      return
    }

    const nextBills = heldBills.filter((b) => b.id !== billId)
    try {
      saveHeldBills(storeId, nextBills)
      setHeldBills(nextBills)
    } catch {
      // ignore
    }
    setNotice('ลบบิลที่พักแล้ว')
    focusProductQuery()
  }

  function openHeldBillsModal() {
    setIsHeldBillsModalOpen(true)
  }

  function closeHeldBillsModal() {
    setIsHeldBillsModalOpen(false)
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
        didClose: () => {
          focusProductQuery()
        },
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

  useEffect(() => {
    checkoutRef.current = checkout
  })

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
          <div className="pos-panel-header">
            <h2 id="checkout-title">Checkout</h2>
            <div
              className={`pos-scan-debug ${scanDebug.isScanner ? 'pos-scan-debug-scanner' : 'pos-scan-debug-manual'}`}
              role="status"
              aria-live="polite"
              title="Scanner detection debug: buffer / last interval (ms) / max variance (ms) / verdict"
            >
              <span className="pos-scan-debug-label">SCAN</span>
              <span className="pos-scan-debug-cell">buf:{scanDebug.buffer}</span>
              <span className="pos-scan-debug-cell">Δ:{scanDebug.lastInterval ?? '-'}</span>
              <span className="pos-scan-debug-cell">var:{scanDebug.maxVariance ?? '-'}</span>
              <span className="pos-scan-debug-verdict">
                {scanDebug.isScanner ? 'scanner' : 'manual'}
              </span>
            </div>
          </div>
          <div className="pos-scan-bar">
            <label className="field" htmlFor="pos-product-query">
              <SearchableDropdown
                ref={productQueryInputRef}
                ariaLabel="สแกนหรือค้นหาสินค้า"
                className="pos-product-query-dropdown"
                emptyMessage="ไม่พบสินค้าที่ค้นหา"
                forceClose={isCheckoutSubmitting}
                id="pos-product-query"
                isExactMatch={isProductExactMatch}
                options={productDropdownOptions}
                placeholder="สแกน barcode / QR หรือพิมพ์ชื่อสินค้า"
                value={productQuery}
                onChange={handleProductQueryChange}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') {
                    return
                  }
                  event.preventDefault()
                  if (isConsumingScanEnterRef.current) {
                    // The exact match was just added to the cart. Decide
                    // whether this Enter is the scanner's trailing key or a
                    // user pressing Enter after typing the barcode by hand
                    // by looking at the consistency of the recent keystrokes.
                    isConsumingScanEnterRef.current = false
                    const burstTimestamps = scanCharTimestampsRef.current
                    const now = Date.now()
                    const isScanner = isScannerBurst(burstTimestamps, now)
                    // Clear the burst window so the next typing starts fresh.
                    scanCharTimestampsRef.current = []
                    setScanDebug({ ...computeScanDebug(burstTimestamps, now, true), isScanner })
                    if (isScanner) {
                      // Scanner: swallow the Enter and keep focus on the
                      // scan field so the cashier can keep scanning.
                      event.stopPropagation()
                    }
                    // Manual typing: let the document-level handler move
                    // focus to the cash input so the cashier can collect
                    // payment without an extra click.
                    return
                  }
                  handleProductScanEnter()
                }}
                onSelect={(option) => void handleProductSelect(option)}
              />
            </label>
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
            <div className="total-line-row">
              <p className="total-line">ยอดรวม {baht(cartTotal)} บาท ({formatNumber(cartItemCount)} ชิ้น)</p>
              <div className="total-line-actions">
                <button
                  aria-label="พักบิลปัจจุบัน"
                  className="hold-bill-button"
                  data-keep-focus="allow"
                  disabled={!hasCartItems}
                  type="button"
                  onClick={() => void holdBill()}
                >
                  พักบิล
                </button>
                <button
                  aria-label="เปิดรายการบิลที่พัก"
                  className="resume-bill-button"
                  data-keep-focus="allow"
                  disabled={heldBills.length === 0}
                  type="button"
                  onClick={openHeldBillsModal}
                >
                  เรียกบิล
                  {heldBills.length > 0 ? (
                    <span className="held-bill-badge" aria-label={`มี ${heldBills.length} บิลที่พัก`}>
                      {heldBills.length}
                    </span>
                  ) : null}
                </button>
                <button
                  aria-label="ลบสินค้าทั้งหมดในตะกร้า"
                  className="clear-cart-button"
                  data-keep-focus="allow"
                  disabled={!hasCartItems}
                  type="button"
                  onClick={() => void clearCart()}
                >
                  ลบทั้งหมด
                </button>
              </div>
            </div>
            <div className="payment-box">
              <div className="payment-input-row">
              <input
                aria-label="จำนวนเงินที่รับ"
                className="cash-received-input"
                data-keep-focus="allow"
                disabled={!hasCartItems}
                min="0"
                ref={cashReceivedInputRef}
                type="number"
                value={displayCashReceived > 0 ? displayCashReceived : ''}
                onChange={(event) => {
                  const next = event.target.value
                  setCashReceived(next === '' ? 0 : Number(next))
                }}
              />
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
                onClick={() => {
                  setCashReceived(cartTotal)
                  focusCashReceivedInput()
                }}
              >
                จ่ายพอดี
              </button>
              {quickCashAmounts.map((amount) => (
                <button
                  className={hasCartItems && cashReceived === amount ? 'quick-cash-button selected' : 'quick-cash-button'}
                  disabled={!hasCartItems}
                  key={amount}
                  type="button"
                  onClick={() => {
                    setCashReceived(amount)
                    focusCashReceivedInput()
                  }}
                >
                  {formatNumber(amount)} บาท
                </button>
              ))}
            </div>
          </div>
          <button
            ref={checkoutButtonRef}
            className="primary-button"
            data-keep-focus="allow"
            disabled={!canCheckout}
            type="button"
            onClick={() => void checkout()}
          >
            {isCheckoutSubmitting ? 'กำลังบันทึก...' : 'ชำระเงิน'}
          </button>
          </div>
        </section>

      </div>
      {isHeldBillsModalOpen ? (
        <div
          aria-modal="true"
          className="held-bills-modal-overlay"
          data-keep-focus="allow"
          role="dialog"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeHeldBillsModal()
            }
          }}
        >
          <div className="held-bills-modal" role="document">
            <header className="held-bills-modal-header">
              <h2>รายการบิลที่พัก ({heldBills.length})</h2>
              <button
                aria-label="ปิดรายการบิลที่พัก"
                className="held-bills-modal-close"
                data-keep-focus="allow"
                type="button"
                onClick={closeHeldBillsModal}
              >
                ×
              </button>
            </header>
            {heldBills.length === 0 ? (
              <p className="empty-hint">ยังไม่มีบิลที่พัก</p>
            ) : (
              <table className="held-bills-table" aria-label="รายการบิลที่พัก">
                <thead>
                  <tr>
                    <th>พักเมื่อ</th>
                    <th>ชื่อบิล</th>
                    <th>จำนวน</th>
                    <th>ยอดรวม</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {heldBills.map((bill) => {
                    const billTotal = bill.items.reduce(
                      (sum, item) => sum + item.quantity * item.unitPrice,
                      0,
                    )
                    const billItemCount = bill.items.reduce(
                      (sum, item) => sum + item.quantity,
                      0,
                    )
                    return (
                      <tr key={bill.id}>
                        <td>{formatHeldBillTime(bill.createdAt)}</td>
                        <td>{bill.note || '-'}</td>
                        <td>{formatNumber(billItemCount)}</td>
                        <td>{baht(billTotal)}</td>
                        <td className="held-bills-row-actions">
                          <button
                            aria-label={`เรียกบิล${bill.note ? ` ${bill.note}` : ''} กลับมา`}
                            className="resume-bill-row-button"
                            data-keep-focus="allow"
                            type="button"
                            onClick={() => void resumeHeldBill(bill)}
                          >
                            เรียก
                          </button>
                          <button
                            aria-label={`ลบบิล${bill.note ? ` ${bill.note}` : ''}`}
                            className="delete-held-bill-button"
                            data-keep-focus="allow"
                            type="button"
                            onClick={() => void deleteHeldBill(bill.id)}
                          >
                            ลบ
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function formatHeldBillTime(iso: string) {
  try {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) {
      return iso
    }
    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    const mo = String(date.getMonth() + 1).padStart(2, '0')
    return `${dd}/${mo} ${hh}:${mm}`
  } catch {
    return iso
  }
}
