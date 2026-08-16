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

export type ApiProductBillItem = {
  saleId: string
  receiptNumber: string
  soldAt: string
  quantity: number
  unitPriceSatang: number
  totalSatang: number
}

export type ApiProductBillsResponse = {
  items: ApiProductBillItem[]
  total: number
  page: number
  pageSize: number
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

// ตัดรอบ "วัน" ที่ 00:00 ตามเวลาประเทศไทย (Asia/Bangkok)
// เพื่อให้ default filter ตรงกับ "วันนี้" ตามเวลาที่ user รับรู้
// (เดิมใช้ new Date().toISOString() ซึ่งเป็น UTC → คืน "เมื่อวาน" ตอนเช้ามืด Bangkok)
export function todayDateInputValue() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

// ส่ง date range เป็น Bangkok local datetime (offset +07:00) แทน UTC
// เพื่อให้ backend filter soldAt ตรงกับ "วัน" ตามเวลาประเทศไทย
// (เดิมใช้ .000Z ทำให้ filter window เลื่อนไป -7 ชั่วโมงจากที่ user คาดหวัง)
export function dateRangeQuery(from: string, to: string) {
  const params = new URLSearchParams()

  if (from) {
    params.set('from', `${from}T00:00:00+07:00`)
  }

  if (to) {
    params.set('to', `${to}T23:59:59+07:00`)
  }

  const query = params.toString()
  return query ? `?${query}` : ''
}
import { formatBaht } from '../../lib/format/number'
