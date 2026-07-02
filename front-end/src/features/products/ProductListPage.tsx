import { type FormEvent, useEffect, useRef, useState } from 'react'
import { apiDownload, apiGet, apiPatch, apiPost } from '../../lib/api/client'
import { confirmAction, confirmDeleteAction } from '../../lib/ui/confirm'
import { canAccessRoute } from '../../lib/auth/permissions'
import { readSession } from '../../lib/auth/session'
import { formatBaht, formatNumber, formatPercent } from '../../lib/format/number'
import { compressImageFile, productImageCompression } from '../../lib/images/imageCompression'

type Product = {
  id: string
  name: string
  barcode: string
  unit?: string
  images?: Array<{
    thumbnailUrl?: string
    secureUrl?: string
  }>
  costPriceSatang: number
  salePriceSatang: number
  stockQuantity: number
  status: 'active' | 'inactive'
  averageMonthlySalesQuantity?: number
}

type SortDirection = 'ascending' | 'descending'

type ProductSortKey =
  | 'rank'
  | 'name'
  | 'barcode'
  | 'unit'
  | 'costPriceSatang'
  | 'salePriceSatang'
  | 'profitMargin'
  | 'averageMonthlySalesQuantity'
  | 'stockQuantity'
  | 'stockStatus'
  | 'status'

type ProductSort = {
  key: ProductSortKey
  direction: SortDirection
}

const productTableSortStorageKey = 'pos-grocery:product-table-sort'

type ProductDraft = {
  id: string
  name: string
  imageFile: File | null
  barcode: string
  unit: string
  costPrice: string
  salePrice: string
}

type ProductEditDraft = {
  name: string
  barcode: string
  unit: string
  costPrice: string
  salePrice: string
  status: Product['status']
  imageFile: File | null
  imageFileName: string
  imagePreviewUrl: string
}

type ProductSalesHistoryRow = {
  date: string
  quantity: number
  totalSalesSatang: number
  totalCostSatang: number
  profitSatang: number
  profitMarginPercent: number
}

type ProductSalesHistoryResponse = {
  productId: string
  rows: ProductSalesHistoryRow[]
}

type ProductSalesHistoryFilter = {
  from: string
  to: string
}

const emptyDraft = (): ProductDraft => ({
  id: crypto.randomUUID(),
  name: '',
  imageFile: null,
  barcode: '',
  unit: '',
  costPrice: '',
  salePrice: '',
})

const productSalesHistoryFilterStorageKey = 'pos-grocery:product-sales-history-filter'

function localDateKey(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function defaultProductSalesHistoryFilter(): ProductSalesHistoryFilter {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 13)

  return {
    from: localDateKey(from),
    to: localDateKey(to),
  }
}

function readProductSalesHistoryFilter(): ProductSalesHistoryFilter {
  try {
    const storedFilter = localStorage.getItem(productSalesHistoryFilterStorageKey)
    if (!storedFilter) {
      return defaultProductSalesHistoryFilter()
    }

    const parsedFilter = JSON.parse(storedFilter) as Partial<ProductSalesHistoryFilter>
    if (parsedFilter.from && parsedFilter.to) {
      return { from: parsedFilter.from, to: parsedFilter.to }
    }
  } catch {
    // Ignore invalid storage and fall back to a practical recent range.
  }

  return defaultProductSalesHistoryFilter()
}

function saveProductSalesHistoryFilter(filter: ProductSalesHistoryFilter) {
  try {
    localStorage.setItem(productSalesHistoryFilterStorageKey, JSON.stringify(filter))
  } catch {
    // Ignore storage failures so the report modal remains usable.
  }
}

function dayStartIso(dateKey: string) {
  return `${dateKey}T00:00:00.000Z`
}

function dayEndIso(dateKey: string) {
  return `${dateKey}T23:59:59.999Z`
}

function productSalesHistoryPath(productId: string, filter: ProductSalesHistoryFilter) {
  const params = new URLSearchParams({
    from: dayStartIso(filter.from),
    to: dayEndIso(filter.to),
  })

  return `/reports/products/${productId}/sales-history?${params.toString()}`
}

function productSalesHistoryWithEma(rows: ProductSalesHistoryRow[]) {
  const alpha = 0.35
  let previousEma = 0

  return rows.map((row, index) => {
    const currentValue = row.totalSalesSatang
    previousEma = index === 0 ? currentValue : (currentValue * alpha) + (previousEma * (1 - alpha))

    return {
      ...row,
      emaSalesSatang: Math.round(previousEma),
    }
  })
}

function bahtFromSatang(value: number) {
  return formatBaht(value / 100)
}

function profitMarginPercent(product: Product) {
  if (product.salePriceSatang <= 0) {
    return '0.0%'
  }

  return formatPercent(productProfitMargin(product), 1)
}

function monthlySalesLabel(product: Product) {
  if (typeof product.averageMonthlySalesQuantity !== 'number') {
    return '-'
  }

  return `${formatNumber(product.averageMonthlySalesQuantity, {
    maximumFractionDigits: 1,
    minimumFractionDigits: product.averageMonthlySalesQuantity % 1 === 0 ? 0 : 1,
  })} ชิ้น`
}

function productProfitMargin(product: Product) {
  if (product.costPriceSatang <= 0) {
    return 0
  }

  const profitSatang = product.salePriceSatang - product.costPriceSatang

  return (profitSatang / product.costPriceSatang) * 100
}

function draftProfitMarginPercent(draft: Pick<ProductDraft, 'costPrice' | 'salePrice'>) {
  const costPrice = Number(draft.costPrice || 0)
  if (costPrice <= 0) {
    return '0.0%'
  }

  const salePrice = Number(draft.salePrice || 0)

  return formatPercent(((salePrice - costPrice) / costPrice) * 100, 1)
}

function satangFromBaht(value: string) {
  return Math.round(Number(value || 0) * 100)
}

function productImageUrl(product: Product) {
  return product.images?.[0]?.thumbnailUrl ?? product.images?.[0]?.secureUrl
}

function editDraftFromProduct(product: Product): ProductEditDraft {
  return {
    name: product.name,
    barcode: product.barcode,
    unit: product.unit ?? '',
    costPrice: bahtFromSatang(product.costPriceSatang),
    salePrice: bahtFromSatang(product.salePriceSatang),
    status: product.status,
    imageFile: null,
    imageFileName: '',
    imagePreviewUrl: productImageUrl(product) ?? '',
  }
}

function stockStatus(product: Product) {
  if (product.stockQuantity <= 0) {
    return 'หมดสต็อก'
  }

  return 'พร้อมขาย'
}

function productStatusLabel(product: Product) {
  return product.status === 'inactive' ? 'inactive' : 'active'
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, 'th', { numeric: true, sensitivity: 'base' })
}

function isProductSortKey(value: unknown): value is ProductSortKey {
  return (
    value === 'rank' ||
    value === 'name' ||
    value === 'barcode' ||
    value === 'unit' ||
    value === 'costPriceSatang' ||
    value === 'salePriceSatang' ||
    value === 'profitMargin' ||
    value === 'averageMonthlySalesQuantity' ||
    value === 'stockQuantity' ||
    value === 'stockStatus' ||
    value === 'status'
  )
}

function isSortDirection(value: unknown): value is SortDirection {
  return value === 'ascending' || value === 'descending'
}

function readStoredProductSort(): ProductSort | null {
  try {
    const storedSort = localStorage.getItem(productTableSortStorageKey)
    if (!storedSort) {
      return null
    }

    const parsedSort = JSON.parse(storedSort) as Partial<ProductSort>

    return isProductSortKey(parsedSort.key) && isSortDirection(parsedSort.direction)
      ? { key: parsedSort.key, direction: parsedSort.direction }
      : null
  } catch {
    return null
  }
}

function saveProductSort(productSort: ProductSort) {
  try {
    localStorage.setItem(productTableSortStorageKey, JSON.stringify(productSort))
  } catch {
    // Ignore storage failures so sorting still works in restricted browsers.
  }
}

function ProductSalesHistoryChart({ rows }: { rows: ProductSalesHistoryRow[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const chartRows = productSalesHistoryWithEma(rows)
  const width = 760
  const height = 300
  const padding = { bottom: 48, left: 56, right: 24, top: 26 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const maxValue = Math.max(100, ...chartRows.map((row) => Math.max(row.totalSalesSatang, row.emaSalesSatang)))
  const barSlot = chartRows.length > 0 ? plotWidth / chartRows.length : plotWidth
  const barWidth = Math.max(8, Math.min(32, barSlot * 0.48))
  const pointFor = (value: number, index: number) => {
    const x = padding.left + (barSlot * index) + (barSlot / 2)
    const y = padding.top + plotHeight - ((value / maxValue) * plotHeight)

    return { x, y }
  }
  const emaPoints = chartRows.map((row, index) => pointFor(row.emaSalesSatang, index))
  const emaLine = emaPoints.map((point) => `${point.x},${point.y}`).join(' ')
  const yAxisValues = [maxValue, maxValue / 2, 0]
  const hasActiveIndex = activeIndex !== null && activeIndex >= 0 && activeIndex < chartRows.length
  const activeRow = hasActiveIndex ? chartRows[activeIndex] : null
  const activeBarPoint = hasActiveIndex ? pointFor(chartRows[activeIndex].totalSalesSatang, activeIndex) : null
  const activeEmaPoint = hasActiveIndex ? emaPoints[activeIndex] : null
  const activeAnchorPoint = activeBarPoint && activeEmaPoint
    ? {
      x: activeBarPoint.x,
      y: Math.min(activeBarPoint.y, activeEmaPoint.y),
    }
    : null
  const tooltipId = activeRow ? `product-history-tooltip-${activeRow.date}` : undefined

  function clamp(value: number, minimum: number, maximum: number) {
    return Math.min(maximum, Math.max(minimum, value))
  }

  if (chartRows.length === 0) {
    return <div className="product-history-empty">ยังไม่มีประวัติการขายในช่วงวันที่เลือก</div>
  }

  return (
    <div className="product-history-chart-wrap">
      <div className="product-history-chart-legend">
        <span className="bar-key">ยอดขายรายวัน</span>
        <span className="line-key">ค่าเฉลี่ย EMA</span>
      </div>
      <div className="product-history-chart-frame">
        <svg aria-label="กราฟยอดขายรายวันและค่าเฉลี่ย EMA" className="product-history-chart" viewBox={`0 0 ${width} ${height}`}>
          <defs>
            <linearGradient id="product-history-bar-gradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#0f766e" />
              <stop offset="100%" stopColor="#5eead4" />
            </linearGradient>
          </defs>
          {yAxisValues.map((value) => {
            const y = padding.top + plotHeight - ((value / maxValue) * plotHeight)

            return (
              <g key={value}>
                <line className="product-history-grid-line" x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
                <text className="product-history-axis-text" x={padding.left - 10} y={y + 4} textAnchor="end">
                  {bahtFromSatang(value)}
                </text>
              </g>
            )
          })}
          <line className="product-history-axis-line" x1={padding.left} x2={padding.left} y1={padding.top} y2={padding.top + plotHeight} />
          <line className="product-history-axis-line" x1={padding.left} x2={width - padding.right} y1={padding.top + plotHeight} y2={padding.top + plotHeight} />
          <text className="product-history-axis-label" x={padding.left} y={height - 8}>วันที่</text>
          <text className="product-history-axis-label" x={padding.left - 38} y={padding.top - 8}>ยอดขาย (บาท)</text>
          {chartRows.map((row, index) => {
            const point = pointFor(row.totalSalesSatang, index)
            const barHeight = padding.top + plotHeight - point.y
            const x = point.x - (barWidth / 2)
            const label = row.date.slice(5)
            const isActive = activeIndex === index

            return (
              <g key={row.date}>
                <rect
                  className={isActive ? 'product-history-bar active' : 'product-history-bar'}
                  height={Math.max(2, barHeight)}
                  rx="5"
                  width={barWidth}
                  x={x}
                  y={point.y}
                >
                  <title>{`${row.date} ยอดขาย ${bahtFromSatang(row.totalSalesSatang)} บาท ${formatNumber(row.quantity)} ชิ้น`}</title>
                </rect>
                <text className="product-history-axis-text" x={point.x} y={height - 26} textAnchor="middle">
                  {label}
                </text>
              </g>
            )
          })}
          <polyline className="product-history-ema-line" fill="none" points={emaLine} />
          {emaPoints.map((point, index) => {
            const isActive = activeIndex === index
            return (
              <circle
                className={isActive ? 'product-history-ema-point active' : 'product-history-ema-point'}
                cx={point.x}
                cy={point.y}
                key={chartRows[index].date}
                r="4"
              >
                <title>{`${chartRows[index].date} EMA ${bahtFromSatang(chartRows[index].emaSalesSatang)} บาท`}</title>
              </circle>
            )
          })}
        </svg>
        <div className="product-history-hit-area-layer">
          {chartRows.map((row, index) => (
            <button
              aria-describedby={activeIndex === index ? tooltipId : undefined}
              aria-label={`ดูรายละเอียดวันที่ ${row.date} ยอดขาย ${bahtFromSatang(row.totalSalesSatang)} บาท ${formatNumber(row.quantity)} ชิ้น ค่าเฉลี่ย EMA ${bahtFromSatang(row.emaSalesSatang)} บาท`}
              className={activeIndex === index ? 'product-history-hit-area active' : 'product-history-hit-area'}
              key={row.date}
              style={{
                left: `${((padding.left + (barSlot * index)) / width) * 100}%`,
                top: `${(padding.top / height) * 100}%`,
                width: `${(barSlot / width) * 100}%`,
                height: `${(plotHeight / height) * 100}%`,
              }}
              type="button"
              onBlur={() => setActiveIndex((currentIndex) => (currentIndex === index ? null : currentIndex))}
              onFocus={() => setActiveIndex(index)}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex((currentIndex) => (currentIndex === index ? null : currentIndex))}
            />
          ))}
        </div>
        {activeRow && activeAnchorPoint ? (
          <div
            className="product-history-tooltip"
            id={tooltipId}
            role="tooltip"
            style={{
              left: `${clamp((activeAnchorPoint.x / width) * 100, 18, 82)}%`,
              top: `${((activeAnchorPoint.y < 96 ? activeAnchorPoint.y + 18 : activeAnchorPoint.y - 82) / height) * 100}%`,
            }}
          >
            <strong>{activeRow.date}</strong>
            <span>ยอดขาย {bahtFromSatang(activeRow.totalSalesSatang)} บาท</span>
            <span>{formatNumber(activeRow.quantity)} ชิ้น</span>
            <span>ค่าเฉลี่ย EMA {bahtFromSatang(activeRow.emaSalesSatang)} บาท</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function ProductListPage() {
  const session = readSession()
  const productFilterRef = useRef<HTMLInputElement>(null)
  const canCreateProduct = session ? canAccessRoute(session.user.role, 'product-create') : false
  const canManageProductStatus = session ? canAccessRoute(session.user.role, 'product-edit') : false
  const [products, setProducts] = useState<Product[]>([])
  const [productFilter, setProductFilter] = useState('')
  const [productSort, setProductSort] = useState<ProductSort | null>(() => readStoredProductSort())
  const [isLowStockModalOpen, setIsLowStockModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [drafts, setDrafts] = useState<ProductDraft[]>([emptyDraft()])
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editDraft, setEditDraft] = useState<ProductEditDraft | null>(null)
  const [historyProductId, setHistoryProductId] = useState<string | null>(null)
  const [historyFilter, setHistoryFilter] = useState<ProductSalesHistoryFilter>(() => readProductSalesHistoryFilter())
  const [historyRows, setHistoryRows] = useState<ProductSalesHistoryRow[]>([])
  const [historyMessage, setHistoryMessage] = useState('')
  const [message, setMessage] = useState('กำลังโหลดสินค้า')

  function focusProductFilter() {
    window.setTimeout(() => productFilterRef.current?.focus(), 0)
  }

  useEffect(() => {
    let active = true

    apiGet<Product[]>('/products')
      .then((apiProducts) => {
        if (active) {
          setProducts(apiProducts)
          setMessage(apiProducts.length > 0 ? '' : 'ยังไม่มีสินค้าในฐานข้อมูล')
          focusProductFilter()
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'โหลดสินค้าไม่สำเร็จ')
        }
      })

    return () => {
      active = false
    }
  }, [])

  const normalizedFilter = productFilter.trim().toLowerCase()
  const filteredProducts = normalizedFilter
    ? products.filter((product) =>
      [
        product.name,
        product.barcode,
        product.unit ?? '',
        product.status,
        stockStatus(product),
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedFilter),
    )
    : products
  const productOriginalIndex = new Map(products.map((product, index) => [product.id, index]))
  const sortedProducts = productSort
    ? [...filteredProducts].sort((leftProduct, rightProduct) => {
      let comparison: number

      if (productSort.key === 'rank') {
        comparison =
          (productOriginalIndex.get(leftProduct.id) ?? 0) - (productOriginalIndex.get(rightProduct.id) ?? 0)
      } else if (productSort.key === 'name') {
        comparison = compareText(leftProduct.name, rightProduct.name)
      } else if (productSort.key === 'barcode') {
        comparison = compareText(leftProduct.barcode, rightProduct.barcode)
      } else if (productSort.key === 'unit') {
        comparison = compareText(leftProduct.unit ?? '', rightProduct.unit ?? '')
      } else if (productSort.key === 'costPriceSatang') {
        comparison = leftProduct.costPriceSatang - rightProduct.costPriceSatang
      } else if (productSort.key === 'salePriceSatang') {
        comparison = leftProduct.salePriceSatang - rightProduct.salePriceSatang
      } else if (productSort.key === 'profitMargin') {
        comparison = productProfitMargin(leftProduct) - productProfitMargin(rightProduct)
      } else if (productSort.key === 'averageMonthlySalesQuantity') {
        comparison =
          (leftProduct.averageMonthlySalesQuantity ?? 0) - (rightProduct.averageMonthlySalesQuantity ?? 0)
      } else if (productSort.key === 'stockQuantity') {
        comparison = leftProduct.stockQuantity - rightProduct.stockQuantity
      } else if (productSort.key === 'stockStatus') {
        comparison = compareText(stockStatus(leftProduct), stockStatus(rightProduct))
      } else {
        comparison = compareText(productStatusLabel(leftProduct), productStatusLabel(rightProduct))
      }

      if (comparison === 0) {
        return (productOriginalIndex.get(leftProduct.id) ?? 0) - (productOriginalIndex.get(rightProduct.id) ?? 0)
      }

      return productSort.direction === 'ascending' ? comparison : comparison * -1
    })
    : filteredProducts
  const historyProductIndex = historyProductId
    ? sortedProducts.findIndex((product) => product.id === historyProductId)
    : -1
  const historyProduct = historyProductIndex >= 0 ? sortedProducts[historyProductIndex] : null
  const historyProductIdForLoad = historyProduct?.id
  const productInventorySummary = products.reduce(
    (summary, product) => {
      const stockValueCostSatang = product.costPriceSatang * product.stockQuantity
      const stockValueSaleSatang = product.salePriceSatang * product.stockQuantity

      return {
        productCount: summary.productCount + 1,
        stockQuantity: summary.stockQuantity + product.stockQuantity,
        totalCostSatang: summary.totalCostSatang + stockValueCostSatang,
        totalExpectedSalesSatang: summary.totalExpectedSalesSatang + stockValueSaleSatang,
        totalExpectedProfitSatang: summary.totalExpectedProfitSatang + (stockValueSaleSatang - stockValueCostSatang),
      }
    },
    {
      productCount: 0,
      stockQuantity: 0,
      totalCostSatang: 0,
      totalExpectedSalesSatang: 0,
      totalExpectedProfitSatang: 0,
    },
  )
  const expectedProfitPercent =
    productInventorySummary.totalCostSatang > 0
      ? (productInventorySummary.totalExpectedProfitSatang / productInventorySummary.totalCostSatang) * 100
      : 0
  const expectedProfitPercentLabel = formatPercent(expectedProfitPercent, 1)
  const lowStockProducts = [...products]
    .filter((product) => product.stockQuantity < 5)
    .sort((leftProduct, rightProduct) => {
      const quantityComparison = leftProduct.stockQuantity - rightProduct.stockQuantity
      if (quantityComparison !== 0) {
        return quantityComparison
      }

      return compareText(leftProduct.name, rightProduct.name)
    })

  useEffect(() => {
    if (!historyProductIdForLoad) {
      return
    }

    let active = true
    saveProductSalesHistoryFilter(historyFilter)

    apiGet<ProductSalesHistoryResponse>(productSalesHistoryPath(historyProductIdForLoad, historyFilter))
      .then((response) => {
        if (active) {
          setHistoryRows(response.rows)
          setHistoryMessage(response.rows.length > 0 ? '' : 'ยังไม่มีประวัติการขายในช่วงวันที่เลือก')
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setHistoryRows([])
          setHistoryMessage(error instanceof Error ? error.message : 'โหลดประวัติการขายไม่สำเร็จ')
        }
      })

    return () => {
      active = false
    }
  }, [historyFilter, historyProductIdForLoad])

  function changeProductSort(key: ProductSortKey) {
    setProductSort((current) => {
      const nextSort: ProductSort = current?.key === key
        ? { key, direction: current.direction === 'ascending' ? 'descending' : 'ascending' }
        : { key, direction: 'ascending' }

      saveProductSort(nextSort)

      return nextSort
    })
  }

  function productSortLabel(key: ProductSortKey, label: string) {
    if (productSort?.key !== key) {
      return `เรียงตาม${label}`
    }

    return `${label} เรียงจาก${productSort.direction === 'ascending' ? 'น้อยไปมาก' : 'มากไปน้อย'}`
  }

  function productSortIndicator(key: ProductSortKey) {
    if (productSort?.key !== key) {
      return '↕'
    }

    return productSort.direction === 'ascending' ? '↑' : '↓'
  }

  function sortableHeader(key: ProductSortKey, label: string) {
    return (
      <th aria-sort={productSort?.key === key ? productSort.direction : 'none'}>
        <button
          aria-label={productSortLabel(key, label)}
          className="table-sort-button"
          onClick={() => changeProductSort(key)}
          type="button"
        >
          <span>{label}</span>
          <span aria-hidden="true">{productSortIndicator(key)}</span>
        </button>
      </th>
    )
  }

  function openProductHistory(product: Product) {
    setHistoryProductId(product.id)
    setHistoryRows([])
    setHistoryMessage('กำลังโหลดประวัติการขาย')
  }

  function closeProductHistory() {
    setHistoryProductId(null)
    setHistoryRows([])
    setHistoryMessage('')
  }

  function openLowStockModal() {
    setIsLowStockModalOpen(true)
  }

  function closeLowStockModal() {
    setIsLowStockModalOpen(false)
  }

  function moveProductHistory(direction: -1 | 1) {
    if (historyProductIndex < 0 || sortedProducts.length === 0) {
      return
    }

    const nextIndex = (historyProductIndex + direction + sortedProducts.length) % sortedProducts.length
    setHistoryProductId(sortedProducts[nextIndex].id)
    setHistoryRows([])
    setHistoryMessage('กำลังโหลดประวัติการขาย')
  }

  function updateDraft(id: string, field: keyof Omit<ProductDraft, 'id' | 'imageFile'>, value: string) {
    setDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, [field]: value } : draft)),
    )
  }

  function updateDraftImage(id: string, imageFile: File | null) {
    setDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, imageFile } : draft)),
    )
  }

  async function removeDraftRow(draftId: string) {
    const draft = drafts.find((row) => row.id === draftId)
    const { isConfirmed } = await confirmDeleteAction({
      title: 'ลบแถวสินค้า?',
      text: draft?.name
        ? `แถวของ "${draft.name}" จะถูกลบออกจากแบบฟอร์มสร้างสินค้า`
        : 'แถวนี้จะถูกลบออกจากแบบฟอร์มสร้างสินค้า',
    })
    if (!isConfirmed) {
      return
    }
    setDrafts((current) => current.filter((row) => row.id !== draftId))
  }

  function resetCreateModal() {
    setDrafts([emptyDraft()])
    setIsCreateModalOpen(false)
  }

  function openEditModal(product: Product) {
    setEditingProduct(product)
    setEditDraft(editDraftFromProduct(product))
  }

  function closeEditModal() {
    setEditingProduct(null)
    setEditDraft(null)
  }

  function updateEditDraft(
    field: keyof Omit<ProductEditDraft, 'imageFile' | 'imageFileName' | 'imagePreviewUrl'>,
    value: string,
  ) {
    setEditDraft((current) => (current ? { ...current, [field]: value } : current))
  }

  async function updateEditImage(imageFile: File | null) {
    if (!imageFile) {
      setEditDraft((current) =>
        current && editingProduct
          ? {
            ...current,
            imageFile: null,
            imageFileName: '',
            imagePreviewUrl: productImageUrl(editingProduct) ?? '',
          }
          : current,
      )
      return
    }

    const compressedImage = await compressImageFile(imageFile, productImageCompression)
    setEditDraft((current) =>
      current
        ? {
          ...current,
          imageFile,
          imageFileName: compressedImage.fileName,
          imagePreviewUrl: compressedImage.dataUri,
        }
        : current,
    )
  }

  async function createProducts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validDrafts = drafts.filter(
      (draft) =>
        draft.name.trim() &&
        draft.barcode.trim() &&
        draft.unit.trim() &&
        draft.costPrice.trim() &&
        draft.salePrice.trim(),
    )

    if (validDrafts.length === 0) {
      setMessage('กรอกสินค้าอย่างน้อย 1 รายการ')
      return
    }

    try {
      const createdProducts = await Promise.all(
        validDrafts.map(async (draft) => {
          const savedProduct = await apiPost<Product>('/products', {
            name: draft.name.trim(),
            barcode: draft.barcode.trim(),
            unit: draft.unit.trim(),
            costPriceSatang: satangFromBaht(draft.costPrice),
            salePriceSatang: satangFromBaht(draft.salePrice),
            status: 'active',
          })

          if (draft.imageFile) {
            const compressedImage = await compressImageFile(draft.imageFile, productImageCompression)
            await apiPost(`/products/${savedProduct.id}/images`, {
              fileName: compressedImage.fileName,
              dataUri: compressedImage.dataUri,
              altText: savedProduct.name,
            })
          }

          return savedProduct
        }),
      )
      setProducts((current) => [...createdProducts, ...current])
      setMessage('')
      resetCreateModal()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'เพิ่มสินค้าไม่สำเร็จ')
    }
  }

  async function toggleProductStatus(product: Product) {
    const nextStatus = product.status === 'inactive' ? 'active' : 'inactive'
    const isDeactivate = nextStatus === 'inactive'
    const { isConfirmed } = await confirmAction({
      confirmText: isDeactivate ? 'ปิดขาย' : 'เปิดขาย',
      icon: isDeactivate ? 'warning' : 'question',
      text: isDeactivate
        ? `สินค้า ${product.name} จะไม่แสดงให้ขายในหน้า POS แต่ยังเก็บข้อมูลและประวัติเดิมไว้`
        : `สินค้า ${product.name} จะกลับไปเลือกขายในหน้า POS ได้อีกครั้ง`,
      title: isDeactivate ? 'ยืนยันปิดขายสินค้า' : 'ยืนยันเปิดขายสินค้า',
      tone: isDeactivate ? 'danger' : 'success',
    })

    if (!isConfirmed) {
      return
    }

    try {
      const updatedProduct = await apiPatch<Product>(`/products/${product.id}`, { status: nextStatus })
      setProducts((current) =>
        current.map((currentProduct) =>
          currentProduct.id === updatedProduct.id ? updatedProduct : currentProduct,
        ),
      )
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'เปลี่ยนสถานะสินค้าไม่สำเร็จ')
    }
  }

  async function saveEditedProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!editingProduct || !editDraft) {
      return
    }

    const payload = {
      name: editDraft.name.trim(),
      barcode: editDraft.barcode.trim(),
      unit: editDraft.unit.trim(),
      costPriceSatang: satangFromBaht(editDraft.costPrice),
      salePriceSatang: satangFromBaht(editDraft.salePrice),
      status: editDraft.status,
    }

    try {
      const updatedProduct = await apiPatch<Product>(`/products/${editingProduct.id}`, payload)
      let nextProduct = updatedProduct

      if (editDraft.imageFile) {
        const uploadedImage = await apiPost<{ thumbnailUrl?: string; secureUrl?: string }>(
          `/products/${editingProduct.id}/images`,
          {
            fileName: editDraft.imageFileName,
            dataUri: editDraft.imagePreviewUrl,
            altText: payload.name,
          },
        )
        nextProduct = {
          ...updatedProduct,
          images: [
            uploadedImage.thumbnailUrl || uploadedImage.secureUrl
              ? uploadedImage
              : { thumbnailUrl: editDraft.imagePreviewUrl },
            ...(updatedProduct.images ?? []),
          ],
        }
      }

      setProducts((current) =>
        current.map((currentProduct) =>
          currentProduct.id === editingProduct.id ? nextProduct : currentProduct,
        ),
      )
      setMessage('')
      closeEditModal()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'แก้ไขสินค้าไม่สำเร็จ')
    }
  }

  return (
    <section className="route-page" aria-labelledby="products-title">
      <section className="product-top-panel">
        <div className="page-header product-page-header">
          <div>
            <p className="eyebrow">Catalog</p>
            <h1 id="products-title">สินค้า</h1>
          </div>
          <div className="page-actions">
            <button
              className="export-link compact"
              onClick={() => void apiDownload('/inventory/export.xlsx', 'inventory.xlsx')}
              type="button"
            >
              Export Excel
            </button>
            {canCreateProduct ? (
              <button
                className="success-button compact page-action-button"
                onClick={() => setIsCreateModalOpen(true)}
                type="button"
              >
                เพิ่มสินค้า
              </button>
            ) : null}
          </div>
        </div>
        <section className="product-summary-cards" aria-label="สรุปสินค้าคงคลัง">
          <article className="product-summary-card product-summary-card-blue">
            <span>จำนวนรายการสินค้าทั้งหมด</span>
            <strong>{formatNumber(productInventorySummary.productCount)} รายการ</strong>
            <small>รายการสินค้าในระบบ</small>
          </article>
          <article className="product-summary-card product-summary-card-green">
            <span>จำนวนชิ้นสินค้าทั้งหมด</span>
            <strong>{formatNumber(productInventorySummary.stockQuantity)} ชิ้น</strong>
            <small>รวมจำนวนคงเหลือทุกสินค้า</small>
          </article>
          <button
            className="product-summary-card product-summary-card-amber product-summary-card-button"
            type="button"
            onClick={openLowStockModal}
          >
            <span>สินค้าเหลือต่ำกว่า 5 ชิ้น</span>
            <strong>{formatNumber(lowStockProducts.length)} รายการ</strong>
            <small>คลิกเพื่อดูรายการสินค้า</small>
          </button>
          <article className="product-summary-card product-summary-card-orange">
            <span>ต้นทุนคงคลังทั้งหมด</span>
            <strong>{bahtFromSatang(productInventorySummary.totalCostSatang)} บาท</strong>
            <small>ต้นทุน x จำนวนคงเหลือ</small>
          </article>
          <article className="product-summary-card product-summary-card-purple">
            <span>ราคาที่คาดว่าจะขายได้</span>
            <strong>{bahtFromSatang(productInventorySummary.totalExpectedSalesSatang)} บาท</strong>
            <small>ราคาขาย x จำนวนคงเหลือ</small>
          </article>
          <article className="product-summary-card product-summary-card-red">
            <span>กำไรที่คาดว่าจะได้</span>
            <strong>{bahtFromSatang(productInventorySummary.totalExpectedProfitSatang)} บาท</strong>
            <small>กำไรจาก stock ปัจจุบัน</small>
          </article>
          <article className="product-summary-card product-summary-card-teal">
            <span>กำไรที่คาดว่าจะได้ %</span>
            <strong>{expectedProfitPercentLabel}</strong>
            <small>กำไรคาดหวัง ÷ ราคาขายคาดหวัง</small>
          </article>
        </section>
      </section>
      {isCreateModalOpen ? (
        <div className="modal-backdrop">
          <section
            aria-labelledby="create-products-title"
            aria-modal="true"
            className="modal-panel product-bulk-modal"
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <h2 id="create-products-title">เพิ่มสินค้าหลายรายการ</h2>
                <p>เพิ่มสินค้าได้หลายแถว แล้วบันทึกเข้าฐานข้อมูลพร้อมกัน</p>
              </div>
              <button className="ghost-button compact" onClick={resetCreateModal} type="button">
                ปิด
              </button>
            </div>
            <form className="modal-form product-bulk-form" onSubmit={(event) => void createProducts(event)}>
              <div className="product-bulk-list">
                {drafts.map((draft, index) => (
                  <fieldset className="product-bulk-row" key={draft.id}>
                    <legend>รายการที่ {index + 1}</legend>
                    <label className="field">
                      <span>ชื่อสินค้า</span>
                      <input
                        aria-label="ชื่อสินค้า"
                        required
                        value={draft.name}
                        onChange={(event) => updateDraft(draft.id, 'name', event.target.value)}
                      />
                    </label>
                    <label className="field product-bulk-image-field">
                      <span>รูปสินค้า</span>
                      <input
                        accept="image/*"
                        aria-label="รูปสินค้า"
                        type="file"
                        onChange={(event) => updateDraftImage(draft.id, event.target.files?.[0] ?? null)}
                      />
                      {draft.imageFile ? <small>{draft.imageFile.name}</small> : null}
                    </label>
                    <label className="field">
                      <span>Barcode</span>
                      <input
                        aria-label="Barcode"
                        required
                        value={draft.barcode}
                        onChange={(event) => updateDraft(draft.id, 'barcode', event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>หน่วย</span>
                      <input
                        aria-label="หน่วย"
                        required
                        value={draft.unit}
                        onChange={(event) => updateDraft(draft.id, 'unit', event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>ต้นทุน</span>
                      <input
                        aria-label="ต้นทุน"
                        min="0"
                        required
                        step="0.01"
                        type="number"
                        value={draft.costPrice}
                        onChange={(event) => updateDraft(draft.id, 'costPrice', event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>ราคาขาย</span>
                      <input
                        aria-label="ราคาขาย"
                        min="0"
                        required
                        step="0.01"
                        type="number"
                        value={draft.salePrice}
                        onChange={(event) => updateDraft(draft.id, 'salePrice', event.target.value)}
                      />
                    </label>
                    <div className="product-bulk-profit" aria-label={`กำไร ${draftProfitMarginPercent(draft)}`}>
                      <span>กำไร %</span>
                      <strong>กำไร {draftProfitMarginPercent(draft)}</strong>
                    </div>
                    {drafts.length > 1 ? (
                      <button
                        className="danger-button compact"
                        onClick={() => removeDraftRow(draft.id)}
                        type="button"
                      >
                        ลบแถว
                      </button>
                    ) : null}
                  </fieldset>
                ))}
              </div>
              <div className="modal-actions">
                <button
                  className="info-button compact"
                  onClick={() => setDrafts((current) => [...current, emptyDraft()])}
                  type="button"
                >
                  เพิ่มแถว
                </button>
                <div className="modal-actions-right">
                  <button className="ghost-button compact" onClick={resetCreateModal} type="button">
                    ยกเลิก
                  </button>
                  <button className="success-button compact" type="submit">
                    บันทึก {formatNumber(drafts.length)} รายการ
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      ) : null}
      {isLowStockModalOpen ? (
        <div className="modal-backdrop">
          <section
            aria-labelledby="low-stock-products-title"
            aria-modal="true"
            className="modal-panel product-low-stock-modal"
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Inventory alert</p>
                <h2 id="low-stock-products-title">สินค้าเหลือต่ำกว่า 5 ชิ้น</h2>
                <p>{formatNumber(lowStockProducts.length)} รายการที่ควรติดตามหรือเติมสต็อก</p>
              </div>
              <button className="ghost-button compact" onClick={closeLowStockModal} type="button">
                ปิด
              </button>
            </div>
            {lowStockProducts.length > 0 ? (
              <div className="table-wrap product-low-stock-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>สินค้า</th>
                      <th>Barcode</th>
                      <th>หน่วย</th>
                      <th>คงเหลือ</th>
                      <th>สถานะสต็อก</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockProducts.map((product) => (
                      <tr key={product.id}>
                        <td><strong>{product.name}</strong></td>
                        <td>{product.barcode}</td>
                        <td>{product.unit ?? '-'}</td>
                        <td>{formatNumber(product.stockQuantity)} ชิ้น</td>
                        <td>{stockStatus(product)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="product-low-stock-empty">ตอนนี้ยังไม่มีสินค้าที่เหลือต่ำกว่า 5 ชิ้น</p>
            )}
          </section>
        </div>
      ) : null}
      {historyProduct ? (
        <div className="modal-backdrop">
          <section
            aria-labelledby="product-history-title"
            aria-modal="true"
            className="modal-panel product-history-modal"
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Sales history</p>
                <h2 id="product-history-title">ประวัติการขาย {historyProduct.name}</h2>
                <p>{historyProduct.barcode} · {historyProduct.unit ?? '-'}</p>
              </div>
              <button className="ghost-button compact" onClick={closeProductHistory} type="button">
                ปิด
              </button>
            </div>
            <div className="product-history-toolbar">
              <button
                className="info-button compact"
                onClick={() => moveProductHistory(-1)}
                type="button"
              >
                สินค้าก่อนหน้า
              </button>
              <div className="product-history-filter">
                <label className="field">
                  <span>วันที่เริ่มต้น</span>
                  <input
                    aria-label="วันที่เริ่มต้น"
                    type="date"
                    value={historyFilter.from}
                    onChange={(event) => {
                      setHistoryMessage('กำลังโหลดประวัติการขาย')
                      setHistoryFilter((current) => ({ ...current, from: event.target.value }))
                    }}
                  />
                </label>
                <label className="field">
                  <span>วันที่สิ้นสุด</span>
                  <input
                    aria-label="วันที่สิ้นสุด"
                    type="date"
                    value={historyFilter.to}
                    onChange={(event) => {
                      setHistoryMessage('กำลังโหลดประวัติการขาย')
                      setHistoryFilter((current) => ({ ...current, to: event.target.value }))
                    }}
                  />
                </label>
              </div>
              <button
                className="success-button compact"
                onClick={() => moveProductHistory(1)}
                type="button"
              >
                สินค้าถัดไป
              </button>
            </div>
            <div className="product-history-summary-row">
              <div className="metric-card metric-card-blue">
                <span>จำนวนวันที่แสดง</span>
                <strong>{formatNumber(historyRows.length)}</strong>
              </div>
              <div className="metric-card metric-card-green">
                <span>จำนวนขายรวม</span>
                <strong>{formatNumber(historyRows.reduce((sum, row) => sum + row.quantity, 0))} ชิ้น</strong>
              </div>
              <div className="metric-card metric-card-orange">
                <span>ยอดขายรวม</span>
                <strong>{bahtFromSatang(historyRows.reduce((sum, row) => sum + row.totalSalesSatang, 0))} บาท</strong>
              </div>
              <div className="metric-card metric-card-purple">
                <span>กำไรรวม</span>
                <strong>{bahtFromSatang(historyRows.reduce((sum, row) => sum + row.profitSatang, 0))} บาท</strong>
              </div>
            </div>
            {historyMessage ? <p className="form-error">{historyMessage}</p> : null}
            <div className="product-history-main-layout">
              <section className="panel product-history-chart-panel" aria-labelledby="product-history-chart-title">
                <div className="product-history-panel-header">
                  <div>
                    <h3 id="product-history-chart-title">กราฟยอดขายรายวัน</h3>
                    <p>เลื่อนเมาส์หรือโฟกัสแต่ละวันเพื่อดู tooltip</p>
                  </div>
                </div>
                <ProductSalesHistoryChart rows={historyRows} />
              </section>
              <section className="panel product-history-data-panel" aria-labelledby="product-history-table-title">
                <div className="product-history-panel-header">
                  <div>
                    <h3 id="product-history-table-title">ตารางรายละเอียดรายวัน</h3>
                    <p>สรุปยอดขาย ต้นทุน กำไร และค่าเฉลี่ย EMA</p>
                  </div>
                  <strong>{formatNumber(historyRows.length)} วัน</strong>
                </div>
                <div className="table-wrap product-history-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>วันที่</th>
                        <th>จำนวน</th>
                        <th>ยอดขาย</th>
                        <th>ต้นทุน</th>
                        <th>กำไร</th>
                        <th>กำไร %</th>
                        <th>EMA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productSalesHistoryWithEma(historyRows).map((row) => (
                        <tr key={row.date}>
                          <td>{row.date}</td>
                          <td>{formatNumber(row.quantity)} ชิ้น</td>
                          <td>{bahtFromSatang(row.totalSalesSatang)} บาท</td>
                          <td>{bahtFromSatang(row.totalCostSatang)} บาท</td>
                          <td>{bahtFromSatang(row.profitSatang)} บาท</td>
                          <td>{formatPercent(row.profitMarginPercent)}</td>
                          <td>{bahtFromSatang(row.emaSalesSatang)} บาท</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </section>
        </div>
      ) : null}
      {editingProduct && editDraft ? (
        <div className="modal-backdrop">
          <section
            aria-labelledby="edit-product-title"
            aria-modal="true"
            className="modal-panel product-edit-modal"
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <h2 id="edit-product-title">แก้ไขสินค้า {editingProduct.name}</h2>
                <p>แสดงข้อมูลเดิมและรูปเดิมก่อนบันทึก ใช้รูปใหม่เฉพาะเมื่อเลือกไฟล์ใหม่</p>
              </div>
              <button className="ghost-button compact" onClick={closeEditModal} type="button">
                ปิด
              </button>
            </div>
            <form className="modal-form product-edit-form" onSubmit={(event) => void saveEditedProduct(event)}>
              <div className="product-edit-image-panel">
                <span className="product-edit-image-title">รูปสินค้า</span>
                {editDraft.imagePreviewUrl ? (
                  <img
                    alt={`${editDraft.imageFile ? 'รูปใหม่' : 'รูปเดิม'} ${editingProduct.name}`}
                    className="product-edit-preview"
                    src={editDraft.imagePreviewUrl}
                  />
                ) : (
                  <span className="product-edit-preview product-edit-preview-empty">ไม่มีรูปสินค้า</span>
                )}
                <label className="field product-bulk-image-field">
                  <span>เปลี่ยนรูปสินค้า</span>
                  <input
                    accept="image/*"
                    aria-label="เปลี่ยนรูปสินค้า"
                    type="file"
                    onChange={(event) => void updateEditImage(event.target.files?.[0] ?? null)}
                  />
                  <small>{editDraft.imageFileName || 'ยังใช้รูปเดิมอยู่'}</small>
                </label>
              </div>
              <label className="field">
                <span>ชื่อสินค้า</span>
                <input
                  aria-label="ชื่อสินค้า"
                  required
                  value={editDraft.name}
                  onChange={(event) => updateEditDraft('name', event.target.value)}
                />
              </label>
              <label className="field">
                <span>Barcode</span>
                <input
                  aria-label="Barcode"
                  required
                  value={editDraft.barcode}
                  onChange={(event) => updateEditDraft('barcode', event.target.value)}
                />
              </label>
              <label className="field">
                <span>หน่วย</span>
                <input
                  aria-label="หน่วย"
                  required
                  value={editDraft.unit}
                  onChange={(event) => updateEditDraft('unit', event.target.value)}
                />
              </label>
              <label className="field">
                <span>ต้นทุน</span>
                <input
                  aria-label="ต้นทุน"
                  min="0"
                  required
                  step="0.01"
                  type="number"
                  value={editDraft.costPrice}
                  onChange={(event) => updateEditDraft('costPrice', event.target.value)}
                />
              </label>
              <label className="field">
                <span>ราคาขาย</span>
                <input
                  aria-label="ราคาขาย"
                  min="0"
                  required
                  step="0.01"
                  type="number"
                  value={editDraft.salePrice}
                  onChange={(event) => updateEditDraft('salePrice', event.target.value)}
                />
              </label>
              <label className="field">
                <span>สถานะสินค้า</span>
                <select
                  aria-label="สถานะสินค้า"
                  value={editDraft.status}
                  onChange={(event) => updateEditDraft('status', event.target.value as Product['status'])}
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </label>
              <div className="product-bulk-profit product-edit-profit">
                <span>กำไร %</span>
                <strong>กำไร {draftProfitMarginPercent(editDraft)}</strong>
              </div>
              <div className="modal-actions product-edit-actions">
                <button className="ghost-button compact" onClick={closeEditModal} type="button">
                  ยกเลิก
                </button>
                <button className="success-button compact" type="submit">
                  บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
      <section className="panel product-filter-panel" aria-label="ตัวกรองสินค้า">
        <label className="field product-filter-field" htmlFor="product-filter">
          <span>ค้นหา/กรองสินค้า</span>
          <input
            autoComplete="off"
            id="product-filter"
            list="product-filter-options"
            placeholder="พิมพ์ชื่อสินค้า, barcode, สถานะ active/inactive"
            ref={productFilterRef}
            value={productFilter}
            onChange={(event) => {
              setProductFilter(event.target.value)
            }}
          />
        </label>
        <datalist id="product-filter-options">
          {products.map((product) => (
            <option
              key={product.id}
              value={product.name}
            >{`${product.name} - ${product.barcode}`}</option>
          ))}
        </datalist>
        <button
          className="ghost-button compact product-filter-clear product-filter-clear-centered"
          onClick={() => {
            setProductFilter('')
            focusProductFilter()
          }}
          type="button"
        >
          ล้างตัวกรอง
        </button>
        {canManageProductStatus ? (
          <div className="product-action-legend" aria-label="คำอธิบายไอคอนปุ่มจัดการสินค้า">
            <span className="product-action-legend-title">สัญลักษณ์ปุ่มจัดการ:</span>
            <span className="product-action-legend-item">
              <svg aria-hidden="true" className="product-action-icon-svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              แก้ไข
            </span>
            <span className="product-action-legend-item">
              <svg aria-hidden="true" className="product-action-icon-svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <path d="M7 14l4-4 4 4 5-6" />
              </svg>
              ประวัติขาย
            </span>
            <span className="product-action-legend-item">
              <svg aria-hidden="true" className="product-action-icon-svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M5 5l14 14" />
              </svg>
              ปิดขาย
            </span>
            <span className="product-action-legend-item">
              <svg aria-hidden="true" className="product-action-icon-svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              เปิดขาย
            </span>
          </div>
        ) : null}
      </section>
      <div className="table-wrap panel">
        <table className="product-inventory-table">
          <thead>
            <tr>
              {sortableHeader('rank', 'อันดับ')}
              <th>รูป</th>
              {sortableHeader('name', 'สินค้า')}
              {sortableHeader('barcode', 'Barcode')}
              {sortableHeader('unit', 'หน่วย')}
              {sortableHeader('costPriceSatang', 'ต้นทุน')}
              {sortableHeader('salePriceSatang', 'ราคาขาย')}
              {sortableHeader('profitMargin', 'กำไร %')}
              {sortableHeader('averageMonthlySalesQuantity', 'ยอดขายเฉลี่ย/เดือน')}
              {sortableHeader('stockQuantity', 'คงเหลือ')}
              {sortableHeader('stockStatus', 'สถานะสต็อก')}
              {sortableHeader('status', 'สถานะสินค้า')}
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {sortedProducts.length > 0 ? sortedProducts.map((product, index) => (
              <tr key={product.id}>
                <td>{index + 1}</td>
                <td>
                  {productImageUrl(product) ? (
                    <img className="product-thumb" src={productImageUrl(product)} alt={product.name} />
                  ) : (
                    <span className="product-thumb product-thumb-empty" aria-label="ไม่มีรูป" />
                  )}
                </td>
                <td><strong>{product.name}</strong></td>
                <td>{product.barcode}</td>
                <td>{product.unit ?? '-'}</td>
                <td>{bahtFromSatang(product.costPriceSatang)}</td>
                <td>{bahtFromSatang(product.salePriceSatang)}</td>
                <td><span className="profit-margin-pill">{profitMarginPercent(product)}</span></td>
                <td>{monthlySalesLabel(product)}</td>
                <td>{formatNumber(product.stockQuantity)}</td>
                <td>{stockStatus(product)}</td>
                <td>{productStatusLabel(product)}</td>
                <td>
                  {canManageProductStatus ? (
                    <div className="table-action-row">
                      <button
                        aria-label={`แก้ไข ${product.name}`}
                        className="table-action-link product-action-icon"
                        onClick={() => openEditModal(product)}
                        type="button"
                      >
                        <svg aria-hidden="true" className="product-action-icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                        </svg>
                        <span className="product-action-icon-label">แก้ไข</span>
                      </button>
                      <button
                        aria-label={`ประวัติขาย ${product.name}`}
                        className="history-button compact product-action-icon"
                        onClick={() => openProductHistory(product)}
                        type="button"
                      >
                        <svg aria-hidden="true" className="product-action-icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 3v18h18" />
                          <path d="M7 14l4-4 4 4 5-6" />
                        </svg>
                        <span className="product-action-icon-label">ประวัติขาย</span>
                      </button>
                      <button
                        aria-label={`${product.status === 'inactive' ? 'เปิดขาย' : 'ปิดขาย'} ${product.name}`}
                        className={`${product.status === 'inactive' ? 'success-button compact' : 'danger-button compact'} product-action-icon`}
                        onClick={() => void toggleProductStatus(product)}
                        type="button"
                      >
                        {product.status === 'inactive' ? (
                          <svg aria-hidden="true" className="product-action-icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        ) : (
                          <svg aria-hidden="true" className="product-action-icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M5 5l14 14" />
                          </svg>
                        )}
                        <span className="product-action-icon-label">{product.status === 'inactive' ? 'เปิดขาย' : 'ปิดขาย'}</span>
                      </button>
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={13}>{products.length > 0 ? 'ไม่พบสินค้าที่ตรงกับตัวกรอง' : message}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
