import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiGet } from '../../lib/api/client'
import { DashboardPage } from '../dashboard/DashboardPage'
import { ReceiptDetailPage } from '../receipts/ReceiptDetailPage'
import { ReceiptListPage } from '../receipts/ReceiptListPage'
import { BestSellersReportPage } from './BestSellersReportPage'
import { SalesReportPage } from './SalesReportPage'

vi.mock('../../lib/api/client', () => ({
  apiGet: vi.fn(),
}))

const mockedApiGet = vi.mocked(apiGet)

const sqlSale = {
  id: 'sale-sql-1',
  receiptNumber: 'RC-SQL-001',
  totalSatang: 2700,
  cashReceivedSatang: 3000,
  changeDueSatang: 300,
  status: 'completed' as const,
  items: [
    {
      productId: 'sql-product-1',
      productName: 'SQL Sale Product',
      barcode: 'SQL-001',
      quantity: 3,
      unitPriceSatang: 900,
      totalSatang: 2700,
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
    profitMarginPercent: 33.33,
  },
  sales: [
    {
      ...sqlSale,
      billNumber: 1,
      orderCount: 1,
      itemCount: 3,
      totalCostSatang: 1800,
      profitSatang: 900,
      profitMarginPercent: 33.33,
    },
  ],
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
  bestTimeSlots: [
    {
      hour: 9,
      orderCount: 1,
      totalSalesSatang: 2700,
    },
  ],
}

beforeEach(() => {
  mockedApiGet.mockImplementation(async (path: string) => {
    if (path.startsWith('/reports/sales')) {
      return salesReport
    }

    if (path === '/reports/dashboard') {
      return dashboardReport
    }

    throw new Error(`Unexpected GET ${path}`)
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('backend connected report pages', () => {
  it('renders dashboard metrics and charts from the reports API', async () => {
    render(<DashboardPage />)

    expect(await screen.findAllByText('SQL Sale Product')).toHaveLength(2)
    expect(screen.getAllByText('27.00 บาท')).toHaveLength(2)
    expect(screen.getAllByText('09:00')).toHaveLength(2)
    expect(screen.getByText('สินค้าท็อปวันนี้')).toBeInTheDocument()
    expect(screen.getByText('ช่วงที่ขายดีที่สุด')).toBeInTheDocument()
    expect(screen.getByText('ค่าเฉลี่ยต่อบิล')).toBeInTheDocument()
    expect(screen.getByText('สถานะวันนี้')).toBeInTheDocument()
    expect(screen.getByText('มีการขายแล้ว 1 บิล')).toBeInTheDocument()
  })

  it('renders sales report rows from the reports API', async () => {
    render(<SalesReportPage />)

    expect(await screen.findByText('RC-SQL-001')).toBeInTheDocument()
    expect(screen.getByText(/SQL Sale Product x3/)).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
    expect(screen.getAllByText('จำนวนบิล')).toHaveLength(2)
    expect(screen.getAllByText('ยอดขาย')).toHaveLength(2)
    expect(screen.getAllByText('จำนวนชิ้น')).toHaveLength(2)
    expect(screen.getAllByText('ต้นทุน')).toHaveLength(2)
    expect(screen.getAllByText('กำไร')).toHaveLength(2)
    expect(screen.getAllByText('กำไร%')).toHaveLength(2)
    expect(screen.getAllByText('18.00 บาท')).toHaveLength(2)
    expect(screen.getAllByText('9.00 บาท')).toHaveLength(2)
    expect(screen.getAllByText('33.33%')).toHaveLength(2)
  })

  it('renders best sellers from the dashboard API', async () => {
    render(<BestSellersReportPage />)

    expect(await screen.findByText('SQL Sale Product')).toBeInTheDocument()
    expect(screen.getByText('3 ชิ้น')).toBeInTheDocument()
  })

  it('renders receipt history from the sales API', async () => {
    render(
      <MemoryRouter>
        <ReceiptListPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('RC-SQL-001')).toBeInTheDocument()
    expect(screen.getByText('ขายสำเร็จ')).toBeInTheDocument()
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
    expect(screen.getByText(/SQL Sale Product x3 = 27.00 บาท/)).toBeInTheDocument()
  })
})
