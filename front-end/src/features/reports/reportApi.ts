export type ApiSale = {
  id: string
  receiptNumber: string
  totalSatang: number
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
    totalSatang: number
  }>
}

export type SalesReport = {
  summary: {
    orderCount: number
    totalSalesSatang: number
    itemsSold: number
  }
  sales: ApiSale[]
}

export type DashboardReport = {
  summary: SalesReport['summary']
  bestSellers: Array<{
    productId: string
    productName: string
    quantity: number
    totalSalesSatang: number
  }>
  bestTimeSlots: Array<{
    hour: number
    orderCount: number
    totalSalesSatang: number
  }>
}

export function bahtFromSatang(value: number) {
  return (value / 100).toFixed(2)
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
