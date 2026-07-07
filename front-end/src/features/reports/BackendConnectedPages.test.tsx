import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Swal from 'sweetalert2'
import { apiDownload, apiGet, apiPost } from '../../lib/api/client'
import { saveSession } from '../../lib/auth/session'
import { DashboardPage } from '../dashboard/DashboardPage'
import { ReceiptDetailPage } from '../receipts/ReceiptDetailPage'
import { ReceiptListPage } from '../receipts/ReceiptListPage'
import { SalesReportPage } from './SalesReportPage'

vi.mock('../../lib/api/client', () => ({
  apiDownload: vi.fn(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))

vi.mock('sweetalert2', () => ({
  default: {
    fire: vi.fn(),
  },
}))

const mockedApiDownload = vi.mocked(apiDownload)
const mockedApiGet = vi.mocked(apiGet)
const mockedApiPost = vi.mocked(apiPost)
const mockedSwal = vi.mocked(Swal)

const sqlSale = {
  id: 'sale-sql-1',
  receiptNumber: 'RC-SQL-001',
  totalSatang: 2700,
  cashReceivedSatang: 3000,
  changeDueSatang: 300,
  status: 'completed' as const,
  soldAt: '2026-06-29T01:35:00.000Z',
  items: [
    {
      productId: 'sql-product-1',
      productName: 'SQL Sale Product',
      barcode: 'SQL-001',
      quantity: 3,
      unitPriceSatang: 900,
      unitCostSatang: 600,
      totalSatang: 2700,
      totalCostSatang: 1800,
    },
  ],
}

const salesReport = {
  summary: {
    orderCount: 1,
    totalSalesSatang: 2700,
    itemsSold: 3,
    totalCostSatang: 1800,
    profitSatang: 900,
    profitMarginPercent: 50,
  },
  sales: [
    {
      ...sqlSale,
      billNumber: 1,
      orderCount: 1,
      itemCount: 3,
      totalCostSatang: 1800,
      profitSatang: 900,
      profitMarginPercent: 50,
    },
  ],
}

type TestSale = Omit<(typeof salesReport.sales)[number], 'status'> & {
  status: 'completed' | 'void'
}

const currentStore = {
  id: 'store-sql-1',
  name: 'SQL Grocery Store',
  phone: '0800000000',
  address: 'Bangkok',
  ownerName: 'SQL Owner',
  logoUrl: 'https://example.com/sql-store-logo.png',
  status: 'active',
}

function makeSalesReport(count: number) {
  return {
    ...salesReport,
    summary: {
      ...salesReport.summary,
      orderCount: count,
    },
    sales: Array.from({ length: count }, (_, index) => ({
      ...sqlSale,
      id: `sale-sql-${index + 1}`,
      receiptNumber: `RC-SQL-${String(index + 1).padStart(3, '0')}`,
      billNumber: index + 1,
      orderCount: 1,
      itemCount: 3,
      totalCostSatang: 1800,
      profitSatang: 900,
      profitMarginPercent: 50,
    })),
  }
}

function makeSalesPage(sales: TestSale[] = salesReport.sales, page = 1, pageSize = 10) {
  const start = (page - 1) * pageSize
  const items = sales.slice(start, start + pageSize).map((sale) => ({
    ...sale,
    items: undefined,
    lineItemCount: sale.status === 'completed' ? sale.items.length : 0,
  }))

  return {
    items,
    total: sales.length,
    page,
    pageSize,
  }
}

const dashboardReport = {
  summary: salesReport.summary,
  bestSellers: [
    {
      productId: 'sql-product-1',
      productName: 'SQL Sale Product',
      quantity: 3,
      totalSalesSatang: 2700,
    },
  ],
  bestProfitProducts: [
    {
      productId: 'sql-product-1',
      productName: 'SQL Sale Product',
      quantity: 3,
      totalSalesSatang: 2700,
      totalCostSatang: 1800,
      profitSatang: 900,
      profitMarginPercent: 50,
    },
  ],
  bestTimeSlots: [
    {
      hour: 9,
      orderCount: 1,
      totalSalesSatang: 2700,
    },
  ],
  hourlySales: [
    {
      hour: 9,
      orderCount: 1,
      totalSalesSatang: 2700,
      items: [
        {
          productId: 'sql-product-1',
          productName: 'SQL Sale Product',
          quantity: 3,
          totalSalesSatang: 2700,
        },
      ],
    },
  ],
}

beforeEach(() => {
  saveSession({
    token: 'test-token',
    user: {
      id: 'owner-sql-1',
      username: 'owner',
      displayName: 'SQL Owner',
      role: 'owner',
    },
  })
  mockedSwal.fire.mockResolvedValue({ isConfirmed: true, isDenied: false, isDismissed: false })
  mockedApiDownload.mockResolvedValue()
  mockedApiGet.mockImplementation(async (path: string) => {
    if (path === '/store/current' || path === '/store/current?includeLogo=true') {
      return currentStore
    }

    if (path.startsWith('/reports/sales')) {
      return salesReport
    }

    if (path.startsWith('/reports/dashboard')) {
      return dashboardReport
    }

    if (path.startsWith('/sales?')) {
      return makeSalesPage()
    }

    if (path.startsWith('/sales/')) {
      const saleId = path.split('/')[2]
      return salesReport.sales.find((sale) => sale.id === saleId) ?? salesReport.sales[0]
    }

    throw new Error(`Unexpected GET ${path}`)
  })
  mockedApiPost.mockImplementation(async (path: string) => {
    if (path === '/sales/sale-sql-1/cancel') {
      return { ...salesReport.sales[0], status: 'void' }
    }

    if (path === '/sales/sale-sql-void/activate') {
      return { ...salesReport.sales[0], id: 'sale-sql-void', status: 'completed' }
    }

    throw new Error(`Unexpected POST ${path}`)
  })
})

afterEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('backend connected report pages', () => {
  it('renders dashboard metrics and charts from the reports API', async () => {
    render(<DashboardPage />)

    const summaryRow = await screen.findByLabelText('การ์ดสรุป Dashboard แบบบรรทัดเดียว')
    expect(summaryRow).toHaveClass('dashboard-summary-row')
    expect(summaryRow).toHaveClass('dashboard-summary-row-top')
    expect(summaryRow.querySelectorAll('.dashboard-summary-card')).toHaveLength(7)
    expect(within(summaryRow).getAllByText('SQL Sale Product')).toHaveLength(2)
    expect(within(summaryRow).getAllByText('27.00 บาท')).toHaveLength(2)
    expect(within(summaryRow).getByText('09:00')).toBeInTheDocument()
    expect(screen.getByText('สินค้าท็อปช่วงนี้')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'สินค้าขายดีที่สุดในช่วงเวลาที่เลือก' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'สินค้าได้กำไรสูงสุดในช่วงเวลาที่เลือก' })).toBeInTheDocument()
    const productInsightRow = screen.getByLabelText('สินค้าขายดีซ้ายและกำไรสูงสุดขวา')
    expect(productInsightRow).toHaveClass('dashboard-product-insight-row')
    expect(within(productInsightRow).getByRole('heading', { name: 'สินค้าขายดีที่สุดในช่วงเวลาที่เลือก' })).toBeInTheDocument()
    expect(within(productInsightRow).getByRole('heading', { name: 'สินค้าได้กำไรสูงสุดในช่วงเวลาที่เลือก' })).toBeInTheDocument()
    expect(within(summaryRow).getByText('3 ชิ้น / 27.00 บาท')).toBeInTheDocument()
    expect(screen.getByText('ช่วงที่ขายดีที่สุด')).toBeInTheDocument()
    expect(screen.getByText('ค่าเฉลี่ยต่อบิล')).toBeInTheDocument()
    expect(screen.getByText('กำไรสูงสุด')).toBeInTheDocument()
    expect(screen.getAllByText('กำไร 9.00 บาท / 50.00%')).toHaveLength(2)
  })

  it('orders dashboard summary cards above the best seller and profit panels', async () => {
    render(<DashboardPage />)

    const layout = await screen.findByLabelText('ลำดับ Dashboard: การ์ดสรุปอยู่บน สินค้าขายดีอยู่ซ้าย กำไรสูงสุดอยู่ขวา')
    const summaryRow = within(layout).getByLabelText('การ์ดสรุป Dashboard แบบบรรทัดเดียว')
    const productInsightRow = within(layout).getByLabelText('สินค้าขายดีซ้ายและกำไรสูงสุดขวา')
    const layoutChildren = Array.from(layout.children)

    expect(layoutChildren[0]).toBe(summaryRow)
    expect(layoutChildren[1]).toBe(productInsightRow)
    expect(productInsightRow).toHaveClass('dashboard-product-insight-row')
    expect(productInsightRow.children[0]).toHaveClass('dashboard-best-sellers-column')
    expect(productInsightRow.children[1]).toHaveClass('dashboard-profit-column')
    expect(within(productInsightRow.children[0] as HTMLElement).getByRole('heading', {
      name: 'สินค้าขายดีที่สุดในช่วงเวลาที่เลือก',
    })).toBeInTheDocument()
    expect(within(productInsightRow.children[1] as HTMLElement).getByRole('heading', {
      name: 'สินค้าได้กำไรสูงสุดในช่วงเวลาที่เลือก',
    })).toBeInTheDocument()
  })

  it('filters dashboard by date range, remembers chart item limit, and drills into hourly sales', async () => {
    localStorage.setItem('pos-grocery:dashboard-item-limit', '3')
    localStorage.setItem('pos-grocery:dashboard-date-filter', JSON.stringify({
      from: '2026-06-10',
      to: '2026-06-20',
    }))
    render(<DashboardPage />)

    expect(await screen.findByLabelText('วันที่เริ่มต้น')).toBeInTheDocument()
    expect(screen.getByLabelText('วันที่สิ้นสุด')).toBeInTheDocument()
    expect(screen.getByLabelText('วันที่เริ่มต้น')).toHaveValue('2026-06-10')
    expect(screen.getByLabelText('วันที่สิ้นสุด')).toHaveValue('2026-06-20')
    // The custom select renders the current label inside the button.
    const chartLimitButton = screen.getByLabelText('จำนวนอันดับที่แสดงในกราฟ')
    expect(chartLimitButton).toHaveTextContent('3 รายการ')
    // Open the dropdown to verify the available options.
    fireEvent.click(chartLimitButton)
    expect(screen.getByRole('option', { name: 'ทั้งหมด' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'สินค้าขายดีที่สุดในช่วงเวลาที่เลือก' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'สินค้าได้กำไรสูงสุดในช่วงเวลาที่เลือก' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ยอดขายรายชั่วโมงของช่วงเวลาที่เลือก' })).toBeInTheDocument()
    expect(screen.getByText('แกน X: เวลา (ชั่วโมง)')).toBeInTheDocument()
    expect(screen.getByText('แกน Y: ยอดขาย (บาท)')).toBeInTheDocument()
    const metricToggle = screen.getByRole('group', { name: 'เลือกข้อมูลที่แสดงในกราฟรายชั่วโมง' })
    expect(within(metricToggle).getByRole('button', { name: 'ยอดขาย' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(metricToggle).getByRole('button', { name: 'จำนวนบิล' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(metricToggle).getByRole('button', { name: 'จำนวนชิ้น' })).toHaveAttribute('aria-pressed', 'false')
    const hourlyChart = screen.getByRole('group', { name: 'กราฟแท่งยอดขายรายชั่วโมงพร้อมแกน X และ Y' })
    expect(within(hourlyChart).getByText('27.00')).toBeInTheDocument()
    expect(within(hourlyChart).getByText('13.50')).toBeInTheDocument()
    expect(within(hourlyChart).getByText('0.00')).toBeInTheDocument()
    expect(within(hourlyChart).getByText('09:00')).toBeInTheDocument()
    expect(within(hourlyChart).getByRole('tooltip', {
      name: '09:00 ยอดขาย 27.00 บาท | ยอดขาย 27.00 บาท | 1 บิล | 3 ชิ้น',
    })).toBeInTheDocument()

    fireEvent.click(within(metricToggle).getByRole('button', { name: 'จำนวนบิล' }))
    expect(localStorage.getItem('pos-grocery:dashboard-hourly-metric')).toBe('orders')
    expect(screen.getByText('แกน Y: จำนวนบิล')).toBeInTheDocument()
    expect(within(hourlyChart).getByRole('button', {
      name: 'ดูรายละเอียดช่วง 09:00 จำนวนบิล 1',
    })).toBeInTheDocument()
    expect(within(hourlyChart).getByRole('tooltip', {
      name: '09:00 จำนวนบิล 1 | ยอดขาย 27.00 บาท | 1 บิล | 3 ชิ้น',
    })).toBeInTheDocument()

    fireEvent.click(within(metricToggle).getByRole('button', { name: 'จำนวนชิ้น' }))
    expect(localStorage.getItem('pos-grocery:dashboard-hourly-metric')).toBe('items')
    expect(screen.getByText('แกน Y: จำนวนชิ้น')).toBeInTheDocument()
    expect(within(hourlyChart).getByRole('button', {
      name: 'ดูรายละเอียดช่วง 09:00 จำนวนชิ้น 3',
    })).toBeInTheDocument()
    expect(within(hourlyChart).getByRole('tooltip', {
      name: '09:00 จำนวนชิ้น 3 | ยอดขาย 27.00 บาท | 1 บิล | 3 ชิ้น',
    })).toBeInTheDocument()

    fireEvent.click(within(metricToggle).getByRole('button', { name: 'ยอดขาย' }))
    expect(localStorage.getItem('pos-grocery:dashboard-hourly-metric')).toBe('sales')
    expect(screen.getByText('แกน Y: ยอดขาย (บาท)')).toBeInTheDocument()

    const bestSellerChart = screen.getByRole('list', { name: 'กราฟแท่งสินค้าขายดีที่สุด' })
    expect(within(bestSellerChart).getByText('SQL Sale Product')).toBeInTheDocument()
    expect(within(bestSellerChart).getByText('3 ชิ้น / 27.00 บาท')).toBeInTheDocument()

    const profitChart = screen.getByRole('list', { name: 'กราฟแท่งสินค้าได้กำไรสูงสุด' })
    expect(within(profitChart).getByText('SQL Sale Product')).toBeInTheDocument()
    expect(within(profitChart).getByText('กำไร 9.00 บาท / 50.00%')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'ดูรายละเอียดช่วง 09:00 ยอดขาย 27.00 บาท' }))
    const hourPanel = screen.getByRole('region', { name: 'สินค้าที่มีการขายในช่วง 09:00' })
    expect(within(hourPanel).getAllByText('SQL Sale Product')).toHaveLength(2)
    expect(within(hourPanel).getByText('ยอดขาย 27.00 บาท')).toBeInTheDocument()
    expect(within(hourPanel).getByRole('table', { name: 'ตารางรายละเอียดสินค้าที่มีการขาย' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'สินค้าขายดี' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'ช่วงเวลาขายดี' })).not.toBeInTheDocument()

    const chartLimitButtonForChange = screen.getByLabelText('จำนวนอันดับที่แสดงในกราฟ')
    await act(async () => {
      fireEvent.click(chartLimitButtonForChange)
    })
    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: '5 รายการ' }),
      ).toBeInTheDocument()
    })
    await act(async () => {
      fireEvent.mouseDown(screen.getByRole('option', { name: '5 รายการ' }))
    })
    expect(localStorage.getItem('pos-grocery:dashboard-item-limit')).toBe('5')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'จำนวนอันดับที่แสดงในกราฟ' }))
    })
    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'ทั้งหมด' }),
      ).toBeInTheDocument()
    })
    await act(async () => {
      fireEvent.mouseDown(screen.getByRole('option', { name: 'ทั้งหมด' }))
    })
    expect(localStorage.getItem('pos-grocery:dashboard-item-limit')).toBe('all')

    fireEvent.change(screen.getByLabelText('วันที่เริ่มต้น'), { target: { value: '2026-06-01' } })
    fireEvent.change(screen.getByLabelText('วันที่สิ้นสุด'), { target: { value: '2026-06-28' } })

    await waitFor(() => {
      expect(localStorage.getItem('pos-grocery:dashboard-date-filter')).toBe(
        JSON.stringify({ from: '2026-06-01', to: '2026-06-28' }),
      )
      expect(mockedApiGet).toHaveBeenCalledWith(
        '/reports/dashboard?from=2026-06-01T00%3A00%3A00.000Z&to=2026-06-28T23%3A59%3A59.999Z',
      )
    })
  })

  it('refreshes hourly sales and selected hour details when the date range changes', async () => {
    mockedApiGet.mockImplementation(async (path: string) => {
      if (path === '/store/current' || path === '/store/current?includeLogo=true') {
        return currentStore
      }

      if (path.startsWith('/reports/dashboard?from=2026-06-01')) {
        return {
          ...dashboardReport,
          summary: {
            orderCount: 1,
            totalSalesSatang: 15400,
            itemsSold: 4,
            totalCostSatang: 9000,
            profitSatang: 6400,
            profitMarginPercent: 71.11,
          },
          bestTimeSlots: [
            {
              hour: 14,
              orderCount: 1,
              totalSalesSatang: 15400,
            },
          ],
          hourlySales: [
            {
              hour: 14,
              orderCount: 1,
              totalSalesSatang: 15400,
              items: [
                {
                  productId: 'range-product-1',
                  productName: 'Range Sale Product',
                  quantity: 4,
                  totalSalesSatang: 15400,
                },
              ],
            },
          ],
        }
      }

      if (path.startsWith('/reports/dashboard')) {
        return dashboardReport
      }

      throw new Error(`Unexpected GET ${path}`)
    })

    render(<DashboardPage />)

    expect(await screen.findByRole('region', { name: 'สินค้าที่มีการขายในช่วง 09:00' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('วันที่เริ่มต้น'), { target: { value: '2026-06-01' } })
    fireEvent.change(screen.getByLabelText('วันที่สิ้นสุด'), { target: { value: '2026-06-28' } })

    const updatedHourPanel = await screen.findByRole('region', { name: 'สินค้าที่มีการขายในช่วง 14:00' })
    expect(within(updatedHourPanel).getAllByText('Range Sale Product')).toHaveLength(2)
    expect(within(updatedHourPanel).getByText('ยอดขาย 154.00 บาท')).toBeInTheDocument()

    const hourlyChart = screen.getByRole('group', { name: 'กราฟแท่งยอดขายรายชั่วโมงพร้อมแกน X และ Y' })
    expect(within(hourlyChart).getByRole('tooltip', {
      name: '09:00 ยอดขาย 0.00 บาท | ยอดขาย 0.00 บาท | 0 บิล | 0 ชิ้น',
    })).toBeInTheDocument()
    expect(within(hourlyChart).getByRole('tooltip', {
      name: '14:00 ยอดขาย 154.00 บาท | ยอดขาย 154.00 บาท | 1 บิล | 4 ชิ้น',
    })).toBeInTheDocument()
  })

  it('shows selected-hour sold products as a horizontal bar chart beside a detail table', async () => {
    mockedApiGet.mockImplementation(async (path: string) => {
      if (path.startsWith('/reports/dashboard')) {
        return {
          ...dashboardReport,
          hourlySales: [
            {
              hour: 9,
              orderCount: 2,
              totalSalesSatang: 3700,
              items: [
                {
                  productId: 'sql-product-1',
                  productName: 'SQL Sale Product',
                  quantity: 3,
                  totalSalesSatang: 2700,
                  profitSatang: 900,
                },
                {
                  productId: 'sql-product-2',
                  productName: 'SQL Second Product',
                  quantity: 1,
                  totalSalesSatang: 10000,
                  profitSatang: 2500,
                },
              ],
            },
          ],
        }
      }

      if (path === '/store/current' || path === '/store/current?includeLogo=true') {
        return currentStore
      }

      throw new Error(`Unexpected GET ${path}`)
    })

    render(<DashboardPage />)

    const hourPanel = await screen.findByRole('region', { name: 'สินค้าที่มีการขายในช่วง 09:00' })
    expect(within(hourPanel).getByRole('heading', { name: 'สินค้าที่มีการขายในช่วง 09:00' })).toBeInTheDocument()

    const layout = within(hourPanel).getByLabelText('กราฟและตารางสินค้าที่มีการขายในชั่วโมงที่เลือก')
    expect(layout.children[0]).toHaveClass('hour-product-chart-column')
    expect(layout.children[1]).toHaveClass('hour-product-table-column')

    const chart = within(layout as HTMLElement).getByRole('group', { name: 'กราฟแท่งแนวนอนสินค้าที่มีการขาย' })
    expect(within(chart).getByText('SQL Second Product')).toBeInTheDocument()
    expect(within(chart).getByText('SQL Sale Product')).toBeInTheDocument()
    expect(within(chart).getByText('ยอดขาย 100.00 บาท')).toBeInTheDocument()
    expect(within(chart).getByText('ยอดขาย 27.00 บาท')).toBeInTheDocument()
    expect(
      within(chart).getByText('SQL Second Product').closest('.hour-product-bar-row')?.querySelector('.hour-product-bar-track span'),
    ).toHaveStyle({ width: '100%' })
    expect(
      within(chart).getByText('SQL Sale Product').closest('.hour-product-bar-row')?.querySelector('.hour-product-bar-track span'),
    ).toHaveStyle({ width: `${(2700 / 10000) * 100}%` })

    const detailTable = within(layout as HTMLElement).getByRole('table', { name: 'ตารางรายละเอียดสินค้าที่มีการขาย' })
    for (const column of ['อันดับ', 'สินค้า', 'จำนวน', 'ยอดขาย', 'กำไร']) {
      expect(within(detailTable).getByRole('columnheader', { name: column })).toBeInTheDocument()
    }
    expect(within(detailTable).getByRole('row', { name: /1 SQL Second Product 1 ชิ้น 100.00 บาท 25.00 บาท/ })).toBeInTheDocument()
    expect(within(detailTable).getByRole('row', { name: /2 SQL Sale Product 3 ชิ้น 27.00 บาท 9.00 บาท/ })).toBeInTheDocument()
  })

  it('sorts the selected-hour sold products by the chosen hourly metric and shows that metric value', async () => {
    mockedApiGet.mockImplementation(async (path: string) => {
      if (path.startsWith('/reports/dashboard')) {
        return {
          ...dashboardReport,
          hourlySales: [
            {
              hour: 10,
              orderCount: 3,
              totalSalesSatang: 8000,
              items: [
                {
                  productId: 'sql-product-low-revenue',
                  productName: 'Low Revenue High Volume',
                  quantity: 9,
                  totalSalesSatang: 3000,
                  profitSatang: 600,
                },
                {
                  productId: 'sql-product-high-revenue',
                  productName: 'High Revenue Low Volume',
                  quantity: 1,
                  totalSalesSatang: 5000,
                  profitSatang: 1000,
                },
              ],
            },
          ],
        }
      }

      if (path === '/store/current' || path === '/store/current?includeLogo=true') {
        return currentStore
      }

      throw new Error(`Unexpected GET ${path}`)
    })

    render(<DashboardPage />)
    const metricToggle = await screen.findByRole('group', { name: 'เลือกข้อมูลที่แสดงในกราฟรายชั่วโมง' })
    const hourPanel = await screen.findByRole('region', { name: 'สินค้าที่มีการขายในช่วง 10:00' })
    const chart = within(hourPanel).getByRole('group', { name: 'กราฟแท่งแนวนอนสินค้าที่มีการขาย' })
    const detailTable = within(hourPanel).getByRole('table', { name: 'ตารางรายละเอียดสินค้าที่มีการขาย' })

    function chartHeadingsInOrder() {
      return Array.from(chart.querySelectorAll('.hour-product-bar-row strong')).map((node) => node.textContent)
    }

    // default metric is 'sales' — sort by totalSalesSatang DESC
    expect(chartHeadingsInOrder().slice(0, 2)).toEqual(['High Revenue Low Volume', 'Low Revenue High Volume'])
    expect(within(chart).getByText('ยอดขาย 50.00 บาท')).toBeInTheDocument()
    expect(within(detailTable).getByRole('row', { name: /1 High Revenue Low Volume/ })).toBeInTheDocument()

    fireEvent.click(within(metricToggle).getByRole('button', { name: 'จำนวนชิ้น' }))
    expect(chartHeadingsInOrder().slice(0, 2)).toEqual(['Low Revenue High Volume', 'High Revenue Low Volume'])
    expect(within(chart).getByText('จำนวนชิ้น 9')).toBeInTheDocument()
    expect(within(detailTable).getByRole('row', { name: /1 Low Revenue High Volume/ })).toBeInTheDocument()

    fireEvent.click(within(metricToggle).getByRole('button', { name: 'จำนวนบิล' }))
    const ordersLabels = within(chart).getAllByText(/จำนวนบิล \d/)
    expect(ordersLabels.length).toBeGreaterThanOrEqual(2)
    expect(ordersLabels[0].textContent).toBe('จำนวนบิล 2')
    expect(ordersLabels[1].textContent).toBe('จำนวนบิล 1')
  })

  it('keeps every hour from midnight to 23:00 on the hourly sales x axis', async () => {
    mockedApiGet.mockImplementation(async (path: string) => {
      if (path.startsWith('/reports/dashboard')) {
        return {
          ...dashboardReport,
          bestTimeSlots: [
            {
              hour: 8,
              orderCount: 1,
              totalSalesSatang: 52700,
            },
          ],
          hourlySales: [
            {
              hour: 8,
              orderCount: 4,
              totalSalesSatang: 52700,
              items: [
                {
                  productId: 'sql-product-1',
                  productName: 'SQL Sale Product',
                  quantity: 4,
                  totalSalesSatang: 52700,
                },
              ],
            },
            {
              hour: 11,
              orderCount: 1,
              totalSalesSatang: 14700,
              items: [
                {
                  productId: 'sql-product-2',
                  productName: 'SQL Second Product',
                  quantity: 1,
                  totalSalesSatang: 14700,
                },
              ],
            },
          ],
        }
      }

      if (path === '/store/current' || path === '/store/current?includeLogo=true') {
        return currentStore
      }

      throw new Error(`Unexpected GET ${path}`)
    })

    render(<DashboardPage />)

    const hourlyChart = await screen.findByRole('group', { name: 'กราฟแท่งยอดขายรายชั่วโมงพร้อมแกน X และ Y' })
    expect(within(hourlyChart).getByText('00:00')).toBeInTheDocument()
    expect(within(hourlyChart).getByText('08:00')).toBeInTheDocument()
    expect(within(hourlyChart).getByText('09:00')).toBeInTheDocument()
    expect(within(hourlyChart).getByText('10:00')).toBeInTheDocument()
    expect(within(hourlyChart).getByText('11:00')).toBeInTheDocument()
    expect(within(hourlyChart).getByText('23:00')).toBeInTheDocument()
    expect(within(hourlyChart).getByRole('button', {
      name: 'ดูรายละเอียดช่วง 09:00 ยอดขาย 0.00 บาท',
    })).toBeInTheDocument()
    expect(within(hourlyChart).getByRole('tooltip', {
      name: '09:00 ยอดขาย 0.00 บาท | ยอดขาย 0.00 บาท | 0 บิล | 0 ชิ้น',
    })).toBeInTheDocument()
  })

  it('keeps the midnight to 23:00 hourly sales x axis when there are no sales', async () => {
    mockedApiGet.mockImplementation(async (path: string) => {
      if (path.startsWith('/reports/dashboard')) {
        return {
          ...dashboardReport,
          summary: {
            orderCount: 0,
            totalSalesSatang: 0,
            itemsSold: 0,
            totalCostSatang: 0,
            profitSatang: 0,
            profitMarginPercent: 0,
          },
          bestSellers: [],
          bestProfitProducts: [],
          bestTimeSlots: [],
          hourlySales: [],
        }
      }

      if (path === '/store/current' || path === '/store/current?includeLogo=true') {
        return currentStore
      }

      throw new Error(`Unexpected GET ${path}`)
    })

    render(<DashboardPage />)

    const hourlyChart = await screen.findByRole('group', { name: 'กราฟแท่งยอดขายรายชั่วโมงพร้อมแกน X และ Y' })
    expect(within(hourlyChart).getByText('00:00')).toBeInTheDocument()
    expect(within(hourlyChart).getByText('23:00')).toBeInTheDocument()
    expect(within(hourlyChart).getByRole('button', {
      name: 'ดูรายละเอียดช่วง 00:00 ยอดขาย 0.00 บาท',
    })).toBeInTheDocument()
    expect(within(hourlyChart).getByRole('button', {
      name: 'ดูรายละเอียดช่วง 23:00 ยอดขาย 0.00 บาท',
    })).toBeInTheDocument()
  })

  it('renders product sales rows from the reports API', async () => {
    localStorage.setItem('pos-grocery:sales-report-date-filter', JSON.stringify({
      from: '2026-06-15',
      to: '2026-06-18',
    }))
    render(<SalesReportPage />)

    expect(await screen.findByLabelText('วันที่เริ่ม')).toHaveValue('2026-06-15')
    expect(screen.getByLabelText('วันที่สิ้นสุด')).toHaveValue('2026-06-18')
    const productRow = await screen.findByRole('row', {
      name: /1 SQL Sale Product SQL-001 1 บิล 3 ชิ้น 27.00 บาท 18.00 บาท 9.00 บาท 50.00%/,
    })
    expect(productRow).toBeInTheDocument()
    expect(screen.getByText('NO')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'สินค้า' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'BARCODE' })).toBeInTheDocument()
    expect(screen.getAllByText('จำนวนบิล')).toHaveLength(2)
    expect(screen.getAllByText('ยอดขาย')).toHaveLength(2)
    expect(screen.getAllByText('จำนวนชิ้น')).toHaveLength(2)
    expect(screen.getAllByText('ต้นทุน')).toHaveLength(2)
    expect(screen.getAllByText('กำไร')).toHaveLength(2)
    expect(screen.getAllByText('กำไร%')).toHaveLength(2)
    const summaryCards = screen.getByLabelText('การ์ดสรุปรายงานยอดขาย')
    expect(summaryCards).toHaveClass('sales-summary-cards')
    expect(within(summaryCards).getByText('จำนวนบิล').closest('div')).toHaveClass('sales-summary-card-blue')
    expect(within(summaryCards).getByText('ยอดขาย').closest('div')).toHaveClass('sales-summary-card-green')
    expect(within(summaryCards).getByText('จำนวนชิ้น').closest('div')).toHaveClass('sales-summary-card-orange')
    expect(within(summaryCards).getByText('ต้นทุน').closest('div')).toHaveClass('sales-summary-card-slate')
    expect(within(summaryCards).getByText('กำไร').closest('div')).toHaveClass('sales-summary-card-purple')
    expect(within(summaryCards).getByText('กำไร%').closest('div')).toHaveClass('sales-summary-card-teal')
    expect(screen.queryByText('เลขที่บิล')).not.toBeInTheDocument()
    expect(screen.queryByText('RC-SQL-001')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('วันที่สิ้นสุด'), { target: { value: '2026-06-29' } })
    expect(localStorage.getItem('pos-grocery:sales-report-date-filter')).toBe(
      JSON.stringify({ from: '2026-06-15', to: '2026-06-29' }),
    )
  })

  it('exports the sales report Excel through the authenticated API client', async () => {
    localStorage.setItem('pos-grocery:sales-report-date-filter', JSON.stringify({
      from: '2026-06-29',
      to: '2026-06-29',
    }))
    render(<SalesReportPage />)

    expect(await screen.findByRole('table', { name: 'ตารางยอดขายรายสินค้า' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Export report Excel' }))

    await waitFor(() => {
      expect(mockedApiDownload).toHaveBeenCalledWith(
        '/reports/export.xlsx?from=2026-06-29T00%3A00%3A00.000Z&to=2026-06-29T23%3A59%3A59.999Z',
        'sales-report.xlsx',
      )
    })
  })

  it('aggregates repeated product sales and excludes cancelled bills', async () => {
    mockedApiGet.mockImplementation(async (path: string) => {
      if (path === '/store/current' || path === '/store/current?includeLogo=true') {
        return currentStore
      }

      if (path.startsWith('/reports/sales')) {
        return {
          ...salesReport,
          summary: {
            orderCount: 2,
            totalSalesSatang: 5400,
            itemsSold: 6,
            totalCostSatang: 3600,
            profitSatang: 1800,
            profitMarginPercent: 50,
          },
          sales: [
            {
              ...sqlSale,
              id: 'sale-sql-1',
              receiptNumber: 'RC-SQL-001',
              billNumber: 1,
              itemCount: 3,
              totalCostSatang: 1800,
              profitSatang: 900,
              profitMarginPercent: 50,
            },
            {
              ...sqlSale,
              id: 'sale-sql-2',
              receiptNumber: 'RC-SQL-002',
              billNumber: 2,
              itemCount: 3,
              totalCostSatang: 1800,
              profitSatang: 900,
              profitMarginPercent: 50,
            },
            {
              ...sqlSale,
              id: 'sale-sql-void',
              receiptNumber: 'RC-SQL-VOID',
              billNumber: 3,
              itemCount: 0,
              status: 'void',
              totalSatang: 0,
              totalCostSatang: 0,
              profitSatang: 0,
              profitMarginPercent: 0,
            },
          ],
        }
      }

      throw new Error(`Unexpected GET ${path}`)
    })

    render(<SalesReportPage />)

    expect(await screen.findByRole('row', {
      name: /1 SQL Sale Product SQL-001 2 บิล 6 ชิ้น 54.00 บาท 36.00 บาท 18.00 บาท 50.00%/,
    })).toBeInTheDocument()
    expect(screen.queryByText('RC-SQL-VOID')).not.toBeInTheDocument()
  })

  it('shows all product sales rows without pagination and sorts the table', async () => {
    mockedApiGet.mockImplementation(async (path: string) => {
      if (path.startsWith('/reports/sales')) {
        return {
          ...salesReport,
          summary: {
            ...salesReport.summary,
            orderCount: 12,
            totalSalesSatang: 78000,
            itemsSold: 12,
            totalCostSatang: 54000,
            profitSatang: 24000,
            profitMarginPercent: 30.77,
          },
          sales: Array.from({ length: 12 }, (_, index) => ({
            ...sqlSale,
            id: `sale-product-${index + 1}`,
            receiptNumber: `RC-SQL-${String(index + 1).padStart(3, '0')}`,
            billNumber: index + 1,
            totalSatang: (index + 1) * 1000,
            itemCount: 1,
            totalCostSatang: (index + 1) * 700,
            profitSatang: (index + 1) * 300,
            profitMarginPercent: 30,
            items: [
              {
                productId: `sql-product-${index + 1}`,
                productName: `SQL Product ${index + 1}`,
                barcode: `SQL-${String(index + 1).padStart(3, '0')}`,
                quantity: 1,
                unitPriceSatang: (index + 1) * 1000,
                unitCostSatang: (index + 1) * 700,
                totalSatang: (index + 1) * 1000,
                totalCostSatang: (index + 1) * 700,
              },
            ],
          })),
        }
      }

      if (path === '/store/current' || path === '/store/current?includeLogo=true') {
        return currentStore
      }

      throw new Error(`Unexpected GET ${path}`)
    })

    render(<SalesReportPage />)

    expect(await screen.findByText('SQL Product 12')).toBeInTheDocument()
    expect(screen.getByText('SQL Product 2')).toBeInTheDocument()
    expect(screen.getByText('SQL Product 1')).toBeInTheDocument()
    expect(screen.queryByText('แสดง 1-10 จาก 12 รายการ')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'หน้าถัดไป' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'ยอดขาย เรียงจากมากไปน้อย' }))

    const table = screen.getByRole('table', { name: 'ตารางยอดขายรายสินค้า' })
    const rowsByAscendingSales = within(table).getAllByRole('row')
    expect(rowsByAscendingSales[1]).toHaveTextContent('SQL Product 1')

    fireEvent.click(screen.getByRole('button', { name: 'ยอดขาย เรียงจากน้อยไปมาก' }))

    const rowsByDescendingSales = within(table).getAllByRole('row')
    expect(rowsByDescendingSales[1]).toHaveTextContent('SQL Product 12')
  })

  it('renders receipt history from the sales API', async () => {
    render(
      <MemoryRouter>
        <ReceiptListPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('RC-SQL-001')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'ลำดับ' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'วันที่' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'เวลา' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'จำนวนรายการ' })).toBeInTheDocument()
    const receiptRow = screen.getByRole('row', { name: /1 RC-SQL-001 29\/06\/2026 08:35 1 รายการ/ })
    expect(receiptRow).toBeInTheDocument()
    expect(screen.getByText('ขายสำเร็จ')).toBeInTheDocument()
    expect(mockedApiGet).toHaveBeenCalledWith('/sales?page=1&pageSize=10')
    expect(mockedApiGet).not.toHaveBeenCalledWith('/store/current')
    expect(mockedApiGet).not.toHaveBeenCalledWith('/store/current?includeLogo=true')
  })

  it('opens receipt details in a modal and manages cancel or active states with confirmation', async () => {
    const voidSale = {
      ...salesReport.sales[0],
      id: 'sale-sql-void',
      receiptNumber: 'RC-SQL-VOID',
      status: 'void' as const,
    }
    mockedApiGet.mockImplementation(async (path: string) => {
      if (path === '/store/current' || path === '/store/current?includeLogo=true') {
        return currentStore
      }

      if (path.startsWith('/reports/sales')) {
        return {
          ...salesReport,
          sales: [salesReport.sales[0], voidSale],
        }
      }

      if (path.startsWith('/sales?')) {
        return makeSalesPage([salesReport.sales[0], voidSale])
      }

      if (path === '/sales/sale-sql-1') {
        return salesReport.sales[0]
      }

      if (path === '/sales/sale-sql-void') {
        return voidSale
      }

      throw new Error(`Unexpected GET ${path}`)
    })

    render(
      <MemoryRouter>
        <ReceiptListPage />
      </MemoryRouter>,
    )

    const completedRow = await screen.findByRole('row', { name: /RC-SQL-001/ })
    for (const column of ['ยอดขาย', 'จำนวนชิ้น', 'ต้นทุน', 'กำไร', 'กำไร%']) {
      expect(screen.getByRole('columnheader', { name: column })).toBeInTheDocument()
    }
    expect(within(completedRow).getByText('27.00 บาท')).toBeInTheDocument()
    expect(within(completedRow).getByText('3 ชิ้น')).toBeInTheDocument()
    expect(within(completedRow).getByText('18.00 บาท')).toBeInTheDocument()
    expect(within(completedRow).getByText('9.00 บาท')).toBeInTheDocument()
    expect(within(completedRow).getByText('50.00%')).toBeInTheDocument()

    fireEvent.click(within(completedRow).getByRole('button', { name: 'ดูรายละเอียดบิล RC-SQL-001' }))

    const completedDialog = await screen.findByRole('dialog', { name: 'รายละเอียดบิล RC-SQL-001' })
    expect(mockedApiGet).toHaveBeenCalledWith('/store/current?includeLogo=true')
    expect(within(completedDialog).getByRole('region', { name: 'ใบเสร็จมาตรฐาน 80 มม.' })).toBeInTheDocument()
    expect(within(completedDialog).getByRole('button', { name: 'ยกเลิกบิล RC-SQL-001' })).toBeInTheDocument()
    expect(within(completedDialog).queryByRole('button', { name: 'Active ใบเสร็จ RC-SQL-001' })).not.toBeInTheDocument()

    fireEvent.click(within(completedDialog).getByRole('button', { name: 'ยกเลิกบิล RC-SQL-001' }))

    await waitFor(() => {
      expect(mockedSwal.fire).toHaveBeenCalledWith(expect.objectContaining({
        title: 'ยืนยันยกเลิกบิล',
      }))
      expect(mockedApiPost).toHaveBeenCalledWith('/sales/sale-sql-1/cancel', {})
    })
    expect(within(completedDialog).getByText('ยกเลิกแล้ว')).toBeInTheDocument()

    fireEvent.click(within(completedDialog).getByRole('button', { name: 'ปิด' }))
    const voidRow = screen.getByRole('row', { name: /RC-SQL-VOID/ })
    fireEvent.click(within(voidRow).getByRole('button', { name: 'ดูรายละเอียดบิล RC-SQL-VOID' }))

    const voidDialog = await screen.findByRole('dialog', { name: 'รายละเอียดบิล RC-SQL-VOID' })
    expect(within(voidDialog).queryByRole('button', { name: 'ยกเลิกบิล RC-SQL-VOID' })).not.toBeInTheDocument()
    fireEvent.click(within(voidDialog).getByRole('button', { name: 'Active ใบเสร็จ RC-SQL-VOID' }))

    await waitFor(() => {
      expect(mockedSwal.fire).toHaveBeenCalledWith(expect.objectContaining({
        title: 'ยืนยัน Active ใบเสร็จ',
      }))
      expect(mockedApiPost).toHaveBeenCalledWith('/sales/sale-sql-void/activate', {})
    })
    expect(within(voidDialog).getByText('ขายสำเร็จ')).toBeInTheDocument()
  })

  it('paginates long receipt history lists', async () => {
    mockedApiGet.mockImplementation(async (path: string) => {
      if (path.startsWith('/sales?')) {
        const page = path.includes('page=2') ? 2 : 1
        return makeSalesPage(makeSalesReport(12).sales, page, 10)
      }

      if (path === '/store/current' || path === '/store/current?includeLogo=true') {
        return currentStore
      }

      throw new Error(`Unexpected GET ${path}`)
    })

    render(
      <MemoryRouter>
        <ReceiptListPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('RC-SQL-010')).toBeInTheDocument()
    expect(screen.queryByText('RC-SQL-011')).not.toBeInTheDocument()
    expect(screen.getByText('แสดง 1-10 จาก 12 รายการ')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'หน้าถัดไป' }))

    expect(await screen.findByText('RC-SQL-011')).toBeInTheDocument()
    expect(screen.getByText('RC-SQL-012')).toBeInTheDocument()
    expect(screen.queryByText('RC-SQL-001')).not.toBeInTheDocument()
    expect(screen.getByText('แสดง 11-12 จาก 12 รายการ')).toBeInTheDocument()
  })

  it('renders receipt details from the sales API', async () => {
    render(
      <MemoryRouter initialEntries={['/receipts/sale-sql-1']}>
        <Routes>
          <Route path="/receipts/:receiptId" element={<ReceiptDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('RC-SQL-001')).toBeInTheDocument()
    const receipt = screen.getByRole('region', { name: 'ใบเสร็จมาตรฐาน 80 มม.' })
    expect(receipt).toHaveClass('thermal-receipt')
    expect(receipt).toHaveAttribute('data-print-size', '80mm')
    expect(screen.getByText('ใบเสร็จรับเงิน')).toBeInTheDocument()
    expect(within(receipt).getByRole('img', { name: 'Logo SQL Grocery Store' })).toHaveAttribute(
      'src',
      'https://example.com/sql-store-logo.png',
    )
    expect(within(receipt).getByText('โทร 0800000000')).toBeInTheDocument()
    expect(within(receipt).getByText('Bangkok')).toBeInTheDocument()
    expect(screen.getByText('SQL Sale Product')).toBeInTheDocument()
    expect(screen.getByText('3 x 9.00')).toBeInTheDocument()
    expect(screen.getAllByText('27.00')).toHaveLength(2)
    expect(screen.getByText('รับเงินสด')).toBeInTheDocument()
    expect(screen.getByText('30.00')).toBeInTheDocument()
    expect(screen.getByText('เงินทอน')).toBeInTheDocument()
    expect(screen.getByText('3.00')).toBeInTheDocument()
  })
})
