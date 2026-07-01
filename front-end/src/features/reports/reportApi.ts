export type ApiSale = {
  id: string
  receiptNumber: string
  billNumber?: number
  orderCount?: number
  totalSatang: number
  itemCount?: number
  totalCostSatang?: number
  profitSatang?: number
  profitMarginPercent?: number
  cashReceivedSatang?: number
  changeDueSatang: number
  status: 'completed' | 'void'
  soldAt?: string
  items: Array<{
    productId: string
    productName: string
    barcode?: string
    quantity: number
    unitPriceSatang: number
    unitCostSatang?: number
    totalSatang: number
    totalCostSatang?: number
  }>
}

export type ApiSaleSummary = Omit<ApiSale, 'items'> & {
  itemCount: number
  lineItemCount?: number
  totalCostSatang: number
  profitSatang: number
  profitMarginPercent: number
  items?: ApiSale['items']
}

export type PaginatedApiResponse<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export type ProductSalesReportRow = {
  no?: number
  productKey?: string
  productId?: string
  productName: string
  barcode: string
  billCount: number
  quantity: number
  totalSalesSatang: number
  totalCostSatang: number
  profitSatang: number
  profitMarginPercent: number
}

export type SalesReport = {
  summary: {
    orderCount: number
    totalSalesSatang: number
    itemsSold: number
    totalCostSatang?: number
    profitSatang?: number
    profitMarginPercent?: number
  }
  sales?: ApiSale[]
  productSales?: ProductSalesReportRow[]
}

export type DashboardReport = {
  summary: SalesReport['summary']
  bestSellers: Array<{
    productId: string
    productName: string
    quantity: number
    totalSalesSatang: number
  }>
  bestProfitProducts?: Array<{
    productId: string
    productName: string
    quantity: number
    totalSalesSatang: number
    totalCostSatang: number
    profitSatang: number
    profitMarginPercent: number
  }>
  bestTimeSlots: Array<{
    hour: number
    orderCount: number
    totalSalesSatang: number
  }>
  hourlySales?: Array<{
    hour: number
    orderCount: number
    totalSalesSatang: number
    items: Array<{
      productId: string
      productName: string
      quantity: number
      totalSalesSatang: number
      profitSatang?: number
    }>
  }>
}

export function bahtFromSatang(value: number) {
  return formatBaht(value / 100)
}

export function todayDateInputValue() {
  return new Date().toISOString().slice(0, 10)
}

export function dateRangeQuery(from: string, to: string) {
  const params = new URLSearchParams()

  if (from) {
    params.set('from', `${from}T00:00:00.000Z`)
  }

  if (to) {
    params.set('to', `${to}T23:59:59.999Z`)
  }

  const query = params.toString()
  return query ? `?${query}` : ''
}
import { formatBaht } from '../../lib/format/number'
