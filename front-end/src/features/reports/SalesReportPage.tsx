import { useEffect, useState } from 'react'
import { apiDownload, apiGet } from '../../lib/api/client'
import { formatNumber, formatPercent } from '../../lib/format/number'
import {
  bahtFromSatang,
  dateRangeQuery,
  todayDateInputValue,
  type ProductSalesReportRow,
  type SalesReport,
} from './reportApi'

type SortDirection = 'ascending' | 'descending'
type SalesReportSortKey =
  | 'rank'
  | 'productName'
  | 'barcode'
  | 'billCount'
  | 'quantity'
  | 'totalSalesSatang'
  | 'totalCostSatang'
  | 'profitSatang'
  | 'profitMarginPercent'

type SalesReportSort = {
  key: SalesReportSortKey
  direction: SortDirection
}

type ProductSalesRow = {
  productKey: string
  productName: string
  barcode: string
  billCount: number
  quantity: number
  totalSalesSatang: number
  totalCostSatang: number
  profitSatang: number
  profitMarginPercent: number
}

type ProductSalesAccumulator = ProductSalesRow & {
  billIds: Set<string>
}

const salesReportDateFilterStorageKey = 'pos-grocery:sales-report-date-filter'
type SalesReportDateFilter = {
  from: string
  to: string
}

function productSalesRows(sales: NonNullable<SalesReport['sales']>) {
  const products = new Map<string, ProductSalesAccumulator>()

  sales.forEach((sale) => {
    if (sale.status !== 'completed') {
      return
    }

    sale.items.forEach((item) => {
      const productKey = item.productId || item.barcode || item.productName
      const itemCostSatang = item.totalCostSatang ?? (item.unitCostSatang ?? 0) * item.quantity
      const current = products.get(productKey) ?? {
        productKey,
        productName: item.productName,
        barcode: item.barcode ?? '-',
        billCount: 0,
        quantity: 0,
        totalSalesSatang: 0,
        totalCostSatang: 0,
        profitSatang: 0,
        profitMarginPercent: 0,
        billIds: new Set<string>(),
      }

      current.billIds.add(sale.id)
      current.quantity += item.quantity
      current.totalSalesSatang += item.totalSatang
      current.totalCostSatang += itemCostSatang
      products.set(productKey, current)
    })
  })

  return Array.from(products.values())
    .map(({ billIds, ...product }) => {
      const profitSatang = product.totalSalesSatang - product.totalCostSatang
      const profitMarginPercent = product.totalCostSatang > 0 ? (profitSatang / product.totalCostSatang) * 100 : 0

      return {
        ...product,
        billCount: billIds.size,
        profitSatang,
        profitMarginPercent,
      }
    })
    .sort((left, right) => {
      if (right.totalSalesSatang !== left.totalSalesSatang) {
        return right.totalSalesSatang - left.totalSalesSatang
      }

      if (right.quantity !== left.quantity) {
        return right.quantity - left.quantity
      }

      return left.productName.localeCompare(right.productName)
    })
}

function productRowsFromReport(rows: ProductSalesReportRow[] = []): ProductSalesRow[] {
  return rows.map((row) => ({
    productKey: row.productId ?? row.productKey ?? row.barcode ?? row.productName,
    productName: row.productName,
    barcode: row.barcode,
    billCount: row.billCount,
    quantity: row.quantity,
    totalSalesSatang: row.totalSalesSatang,
    totalCostSatang: row.totalCostSatang,
    profitSatang: row.profitSatang,
    profitMarginPercent: row.profitMarginPercent,
  }))
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, 'th', { numeric: true, sensitivity: 'base' })
}

function readSalesReportDateFilter(): SalesReportDateFilter {
  const today = todayDateInputValue()

  try {
    const storedValue = localStorage.getItem(salesReportDateFilterStorageKey)
    if (!storedValue) {
      return { from: today, to: today }
    }

    const parsed = JSON.parse(storedValue) as Partial<SalesReportDateFilter>
    return {
      from: typeof parsed.from === 'string' && parsed.from ? parsed.from : today,
      to: typeof parsed.to === 'string' && parsed.to ? parsed.to : today,
    }
  } catch {
    return { from: today, to: today }
  }
}

export function SalesReportPage() {
  const initialDateFilter = readSalesReportDateFilter()
  const [from, setFrom] = useState(initialDateFilter.from)
  const [to, setTo] = useState(initialDateFilter.to)
  const [report, setReport] = useState<SalesReport | null>(null)
  const [message, setMessage] = useState('กำลังโหลดรายงาน')
  const [salesReportSort, setSalesReportSort] = useState<SalesReportSort>({
    key: 'totalSalesSatang',
    direction: 'descending',
  })
  const query = dateRangeQuery(from, to)
  const sales = report?.sales ?? []
  const productRows = report?.productSales
    ? productRowsFromReport(report.productSales)
    : productSalesRows(sales)
  const productOriginalIndex = new Map(productRows.map((product, index) => [product.productKey, index]))
  const sortedProductRows = [...productRows].sort((leftProduct, rightProduct) => {
    let comparison: number

    if (salesReportSort.key === 'rank') {
      comparison =
        (productOriginalIndex.get(leftProduct.productKey) ?? 0) -
        (productOriginalIndex.get(rightProduct.productKey) ?? 0)
    } else if (salesReportSort.key === 'productName') {
      comparison = compareText(leftProduct.productName, rightProduct.productName)
    } else if (salesReportSort.key === 'barcode') {
      comparison = compareText(leftProduct.barcode, rightProduct.barcode)
    } else {
      comparison = leftProduct[salesReportSort.key] - rightProduct[salesReportSort.key]
    }

    if (comparison === 0) {
      return (
        (productOriginalIndex.get(leftProduct.productKey) ?? 0) -
        (productOriginalIndex.get(rightProduct.productKey) ?? 0)
      )
    }

    return salesReportSort.direction === 'ascending' ? comparison : comparison * -1
  })

  useEffect(() => {
    localStorage.setItem(salesReportDateFilterStorageKey, JSON.stringify({ from, to }))
  }, [from, to])

  useEffect(() => {
    let active = true

    apiGet<SalesReport>(`/reports/sales${query}`)
      .then((nextReport) => {
        if (active) {
          setReport(nextReport)
          setMessage('')
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'โหลดรายงานไม่สำเร็จ')
        }
      })

    return () => {
      active = false
    }
  }, [query])

  function changeSalesReportSort(key: SalesReportSortKey) {
    setSalesReportSort((current) => (
      current.key === key
        ? { key, direction: current.direction === 'ascending' ? 'descending' : 'ascending' }
        : { key, direction: 'ascending' }
    ))
  }

  function salesReportSortLabel(key: SalesReportSortKey, label: string) {
    if (salesReportSort.key !== key) {
      return `เรียงตาม${label}`
    }

    return `${label} เรียงจาก${salesReportSort.direction === 'ascending' ? 'น้อยไปมาก' : 'มากไปน้อย'}`
  }

  function salesReportSortIndicator(key: SalesReportSortKey) {
    if (salesReportSort.key !== key) {
      return '↕'
    }

    return salesReportSort.direction === 'ascending' ? '↑' : '↓'
  }

  function sortableHeader(key: SalesReportSortKey, label: string) {
    return (
      <th aria-sort={salesReportSort.key === key ? salesReportSort.direction : 'none'}>
        <button
          aria-label={salesReportSortLabel(key, label)}
          className="table-sort-button"
          onClick={() => changeSalesReportSort(key)}
          type="button"
        >
          <span>{label}</span>
          <span aria-hidden="true">{salesReportSortIndicator(key)}</span>
        </button>
      </th>
    )
  }

  function exportReport() {
    void apiDownload(`/reports/export.xlsx${query}`, 'sales-report.xlsx')
  }

  return (
    <section className="route-page" aria-labelledby="sales-report-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Reports</p>
          <h1 id="sales-report-title">รายงานยอดขาย</h1>
        </div>
        <button className="export-link" onClick={exportReport} type="button">
          Export report Excel
        </button>
      </div>
      <div className="panel">
        <div className="date-row">
          <input aria-label="วันที่เริ่ม" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <input aria-label="วันที่สิ้นสุด" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <dl className="summary-list sales-summary-cards" aria-label="การ์ดสรุปรายงานยอดขาย">
          <div className="sales-summary-card-blue">
            <dt>จำนวนบิล</dt>
            <dd>{formatNumber(report?.summary.orderCount ?? 0)}</dd>
          </div>
          <div className="sales-summary-card-green">
            <dt>ยอดขาย</dt>
            <dd>{bahtFromSatang(report?.summary.totalSalesSatang ?? 0)} บาท</dd>
          </div>
          <div className="sales-summary-card-orange">
            <dt>จำนวนชิ้น</dt>
            <dd>{formatNumber(report?.summary.itemsSold ?? 0)}</dd>
          </div>
          <div className="sales-summary-card-slate">
            <dt>ต้นทุน</dt>
            <dd>{bahtFromSatang(report?.summary.totalCostSatang ?? 0)} บาท</dd>
          </div>
          <div className="sales-summary-card-purple">
            <dt>กำไร</dt>
            <dd>{bahtFromSatang(report?.summary.profitSatang ?? 0)} บาท</dd>
          </div>
          <div className="sales-summary-card-teal">
            <dt>กำไร%</dt>
            <dd>{formatPercent(report?.summary.profitMarginPercent ?? 0)}</dd>
          </div>
        </dl>
        {productRows.length ? (
          <div className="table-wrap sales-report-table-wrap">
            <table className="sales-report-table" aria-label="ตารางยอดขายรายสินค้า">
              <thead>
                <tr>
                  {sortableHeader('rank', 'NO')}
                  {sortableHeader('productName', 'สินค้า')}
                  {sortableHeader('barcode', 'BARCODE')}
                  {sortableHeader('billCount', 'จำนวนบิล')}
                  {sortableHeader('quantity', 'จำนวนชิ้น')}
                  {sortableHeader('totalSalesSatang', 'ยอดขาย')}
                  {sortableHeader('totalCostSatang', 'ต้นทุน')}
                  {sortableHeader('profitSatang', 'กำไร')}
                  {sortableHeader('profitMarginPercent', 'กำไร%')}
                </tr>
              </thead>
              <tbody>
                {sortedProductRows.map((product, index) => (
                  <tr key={product.productKey}>
                    <td>{formatNumber(index + 1)}</td>
                    <td>{product.productName}</td>
                    <td>{product.barcode}</td>
                    <td>{formatNumber(product.billCount)} บิล</td>
                    <td>{formatNumber(product.quantity)} ชิ้น</td>
                    <td>{bahtFromSatang(product.totalSalesSatang)} บาท</td>
                    <td>{bahtFromSatang(product.totalCostSatang)} บาท</td>
                    <td>{bahtFromSatang(product.profitSatang)} บาท</td>
                    <td>{formatPercent(product.profitMarginPercent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>{message || 'ยังไม่มียอดขายรายสินค้าในช่วงเวลานี้'}</p>
        )}
      </div>
    </section>
  )
}
