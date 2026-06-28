import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Swal from 'sweetalert2'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiGet, apiPost } from '../../lib/api/client'
import { saveSession, type Session } from '../../lib/auth/session'
import { PosCheckoutPage } from './PosCheckoutPage'
import { customerDisplayPayloadStorageKey } from './customerDisplay'

vi.mock('../../lib/api/client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))

vi.mock('sweetalert2', () => ({
  default: {
    fire: vi.fn(),
  },
}))

const mockedApiGet = vi.mocked(apiGet)
const mockedApiPost = vi.mocked(apiPost)
const mockedSwal = vi.mocked(Swal)
const confirmedDialog = {
  isConfirmed: true,
  isDenied: false,
  isDismissed: false,
}

const apiProducts = [
  {
    id: 'product-water',
    storeId: 'store-1',
    name: 'Drinking Water',
    barcode: '8850002000010',
    sku: 'WATER-001',
    unit: 'bottle',
    costPriceSatang: 400,
    salePriceSatang: 700,
    stockQuantity: 24,
    status: 'active',
    images: [],
  },
  {
    id: 'product-noodle',
    storeId: 'store-1',
    name: 'Instant Noodles',
    barcode: '8850001000011',
    sku: 'NOODLE-001',
    unit: 'pack',
    costPriceSatang: 700,
    salePriceSatang: 1200,
    stockQuantity: 18,
    status: 'active',
    images: [],
  },
]

const apiWaterSale = {
  id: 'sale-1',
  receiptNumber: 'RC20260628-1',
  totalSatang: 1400,
  changeDueSatang: 8600,
  status: 'completed',
  items: [
    {
      id: 'sale-item-1',
      saleId: 'sale-1',
      productId: 'product-water',
      productName: 'Drinking Water',
      barcode: '8850002000010',
      quantity: 2,
      unitPriceSatang: 700,
      totalSatang: 1400,
    },
  ],
}

const apiProductsAfterWaterSale = [
  { ...apiProducts[0], stockQuantity: 22 },
  apiProducts[1],
]

const apiProductsAfterMixedSale = [
  { ...apiProducts[0], stockQuantity: 22 },
  { ...apiProducts[1], stockQuantity: 17 },
]

function salesReport(sales: Array<typeof apiWaterSale> = []) {
  return {
    summary: {
      orderCount: sales.filter((sale) => sale.status === 'completed').length,
      totalSalesSatang: sales
        .filter((sale) => sale.status === 'completed')
        .reduce((sum, sale) => sum + sale.totalSatang, 0),
      itemsSold: sales
        .filter((sale) => sale.status === 'completed')
        .reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0),
    },
    sales,
  }
}

function mockApiResponses(input?: {
  productResponses?: Array<typeof apiProducts>
  sales?: () => Array<typeof apiWaterSale>
}) {
  const productResponses = input?.productResponses ?? [apiProducts]
  const getSales = input?.sales ?? (() => [])
  let productCallIndex = 0

  mockedApiGet.mockImplementation(async (path: string) => {
    if (path === '/products') {
      const response = productResponses[Math.min(productCallIndex, productResponses.length - 1)]
      productCallIndex += 1
      return response
    }

    if (path.startsWith('/reports/sales')) {
      return salesReport(getSales())
    }

    throw new Error(`Unexpected GET ${path}`)
  })
}

beforeEach(() => {
  mockApiResponses()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.clearAllMocks()
})

describe('PosCheckoutPage', () => {
  function sessionForRole(role: Session['user']['role']): Session {
    return {
      token: `${role}-token`,
      user: {
        id: `${role}-user`,
        username: role,
        displayName: role,
        role,
      },
    }
  }

  function confirmNextDialog() {
    mockedSwal.fire.mockResolvedValueOnce(confirmedDialog)
  }

  async function createWaterSale() {
    confirmNextDialog()
    mockedApiPost.mockResolvedValueOnce(apiWaterSale)
    fireEvent.change(screen.getByLabelText('สแกนหรือค้นหาสินค้า'), {
      target: { value: '8850002000010' },
    })
    fireEvent.change(screen.getByLabelText('สแกนหรือค้นหาสินค้า'), {
      target: { value: 'Drinking Water' },
    })
    fireEvent.change(screen.getByLabelText('รับเงินสด'), {
      target: { value: '100' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'ชำระเงิน' }))
    await waitFor(() => {
      expect(screen.getAllByText('ขายสำเร็จ').length).toBeGreaterThan(0)
    })
  }

  function expectStockMeter(productName: string, quantity: number, initialQuantity: number) {
    expect(screen.getByRole('progressbar', {
      name: `${productName} คงเหลือ ${quantity} จาก ${initialQuantity}`,
    })).toHaveAttribute('aria-valuenow', String(quantity))
  }

  async function waitForProductsLoaded() {
    await waitFor(() => {
      expect(screen.getByText('Drinking Water')).toBeInTheDocument()
    })
  }

  it('does not render fallback mock products before SQL products load', async () => {
    mockedApiGet.mockImplementation(async (path: string) => {
      if (path === '/products') {
        return new Promise(() => undefined)
      }

      if (path === '/reports/sales') {
        return new Promise(() => undefined)
      }

      throw new Error(`Unexpected GET ${path}`)
    })

    render(<PosCheckoutPage />)

    expect(screen.queryByText('Drinking Water')).not.toBeInTheDocument()
    expect(screen.queryByText('Instant Noodles')).not.toBeInTheDocument()
    expect(screen.getByText('ยังไม่มีสินค้าในฐานข้อมูล')).toBeInTheDocument()
  })

  it('adds scanned and selected products immediately, merges duplicates, confirms checkout, and opens a receipt modal', async () => {
    mockApiResponses({ productResponses: [apiProducts, apiProductsAfterMixedSale] })
    render(<PosCheckoutPage />)
    await waitForProductsLoaded()
    confirmNextDialog()
    mockedApiPost.mockResolvedValueOnce({
      ...apiWaterSale,
      totalSatang: 2600,
      changeDueSatang: 7400,
      items: [
        ...apiWaterSale.items,
        {
          id: 'sale-item-2',
          saleId: 'sale-1',
          productId: 'product-noodle',
          productName: 'Instant Noodles',
          barcode: '8850001000011',
          quantity: 1,
          unitPriceSatang: 1200,
          totalSatang: 1200,
        },
      ],
    })

    fireEvent.change(screen.getByLabelText('สแกนหรือค้นหาสินค้า'), {
      target: { value: '8850002000010' },
    })
    fireEvent.change(screen.getByLabelText('สแกนหรือค้นหาสินค้า'), {
      target: { value: 'Drinking Water' },
    })
    fireEvent.change(screen.getByLabelText('สแกนหรือค้นหาสินค้า'), {
      target: { value: 'Instant Noodles' },
    })
    const cartTable = screen.getByRole('table', { name: 'รายการสินค้าในตะกร้า' })
    for (const column of ['ลำดับ', 'ภาพ', 'สินค้า', 'ราคา', 'จำนวน', 'ราคารวม']) {
      expect(within(cartTable).getByRole('columnheader', { name: column })).toBeInTheDocument()
    }
    const cartRows = within(cartTable).getAllByRole('row')
    expect(within(cartRows[1]).getByRole('cell', { name: '1' })).toBeInTheDocument()
    expect(within(cartRows[1]).getByRole('cell', { name: 'Drinking Water 8850002000010' })).toBeInTheDocument()
    expect(within(cartRows[1]).getByRole('cell', { name: '14.00' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('รับเงินสด'), {
      target: { value: '100' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'ชำระเงิน' }))

    await waitFor(() => {
      expect(mockedSwal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          confirmButtonText: 'ยืนยันขาย',
          icon: 'question',
          title: 'ยืนยันรับชำระเงิน',
        }),
      )
    })
    expect(screen.getByRole('button', { name: /26.00 บาท/ })).toHaveClass('receipt-row')
    await waitFor(() => {
      expectStockMeter('Drinking Water', 22, 24)
      expectStockMeter('Instant Noodles', 17, 18)
    })

    fireEvent.click(screen.getByRole('button', { name: /ดูรายละเอียดบิล/ }))

    expect(screen.getByRole('dialog', { name: /รายละเอียดบิล/ })).toBeInTheDocument()
    expect(screen.getByText(/Drinking Water x2/)).toBeInTheDocument()
    expect(screen.getByText(/Instant Noodles x1/)).toBeInTheDocument()
    expect(screen.getByText('เงินทอน 74.00 บาท')).toBeInTheDocument()
  })

  it('loads receipts from backend after refresh and renders each receipt as one list row', async () => {
    let sqlSales: Array<typeof apiWaterSale> = []
    mockApiResponses({
      productResponses: [apiProducts, apiProductsAfterWaterSale],
      sales: () => sqlSales,
    })
    const { unmount } = render(<PosCheckoutPage />)
    await waitForProductsLoaded()

    await createWaterSale()
    const receiptButton = screen.getByRole('button', { name: /ดูรายละเอียดบิล/ })
    expect(receiptButton).toHaveClass('receipt-row')
    await waitFor(() => {
      expectStockMeter('Drinking Water', 22, 24)
    })

    unmount()
    sqlSales = [apiWaterSale]
    render(<PosCheckoutPage />)

    const receiptList = screen.getByRole('list', { name: 'รายการใบเสร็จล่าสุด' })
    const receiptItems = await within(receiptList).findAllByRole('listitem')

    expect(receiptItems).toHaveLength(1)
    expect(within(receiptItems[0]).getByText(/RC/)).toBeInTheDocument()
    expect(within(receiptItems[0]).getByText('14.00 บาท')).toBeInTheDocument()
    expect(within(receiptItems[0]).getByText('ขายสำเร็จ')).toBeInTheDocument()
    await waitFor(() => {
      expectStockMeter('Drinking Water', 22, 22)
    })
    expectStockMeter('Instant Noodles', 18, 18)
  })

  it('checks out through the backend and reloads shared stock from products API', async () => {
    mockApiResponses({
      productResponses: [
        apiProducts,
        [
          { ...apiProducts[0], stockQuantity: 23 },
          apiProducts[1],
        ],
      ],
    })
    mockedApiPost.mockResolvedValueOnce({
      ...apiWaterSale,
      totalSatang: 700,
      changeDueSatang: 9300,
      items: [{ ...apiWaterSale.items[0], quantity: 1, totalSatang: 700 }],
    })

    render(<PosCheckoutPage />)
    await waitFor(() => {
      expect(mockedApiGet).toHaveBeenCalledWith('/products')
    })
    confirmNextDialog()

    fireEvent.change(screen.getByLabelText('สแกนหรือค้นหาสินค้า'), {
      target: { value: '8850002000010' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'ชำระเงิน' }))

    await waitFor(() => {
      expect(mockedApiPost).toHaveBeenCalledWith('/sales/checkout', {
        barcodeItems: [{ barcode: '8850002000010', quantity: 1 }],
        cashReceivedSatang: 10000,
        paymentMethod: 'cash',
      })
    })
    await waitFor(() => {
      expectStockMeter('Drinking Water', 23, 24)
    })
  })

  it('supports quick cash amounts, custom cash, live change, and blocks underpaid checkout confirmation', async () => {
    render(<PosCheckoutPage />)
    await waitForProductsLoaded()

    fireEvent.change(screen.getByLabelText('สแกนหรือค้นหาสินค้า'), {
      target: { value: '8850002000010' },
    })
    fireEvent.change(screen.getByLabelText('สแกนหรือค้นหาสินค้า'), {
      target: { value: 'Drinking Water' },
    })

    for (const amount of [5, 10, 20, 50, 100, 500, 1000]) {
      expect(screen.getByRole('button', { name: `${amount} บาท` })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'จ่ายพอดี' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '20 บาท' }))
    expect(screen.getByLabelText('รับเงินสด')).toHaveValue(20)
    expect(screen.getByRole('status', { name: 'เงินทอน 6.00 บาท' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'จ่ายพอดี' }))
    expect(screen.getByLabelText('รับเงินสด')).toHaveValue(14)
    expect(screen.getByRole('status', { name: 'จ่ายพอดี 0.00 บาท' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('รับเงินสด'), {
      target: { value: '10' },
    })
    expect(screen.getByRole('status', { name: 'ขาดอีก 4.00 บาท' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ชำระเงิน' })).toBeDisabled()
    expect(mockedSwal.fire).not.toHaveBeenCalled()
  })

  it('renders stock remaining as POS status cards with quantity meters', async () => {
    render(<PosCheckoutPage />)
    await waitForProductsLoaded()

    const stockList = screen.getByRole('list', { name: 'รายการสินค้าคงเหลือหลังขาย' })
    const stockItems = within(stockList).getAllByRole('listitem')

    expect(stockItems).toHaveLength(2)
    expect(within(stockItems[0]).getByText('Drinking Water')).toBeInTheDocument()
    expect(within(stockItems[0]).getByText('พร้อมขาย')).toBeInTheDocument()
    expect(within(stockItems[0]).getByRole('progressbar', {
      name: 'Drinking Water คงเหลือ 24 จาก 24',
    })).toHaveAttribute('aria-valuenow', '24')
    expect(within(stockItems[1]).getByText('Instant Noodles')).toBeInTheDocument()
    expect(within(stockItems[1]).getByText('พร้อมขาย')).toBeInTheDocument()
  })

  it('does not allow a cashier to cancel a receipt', async () => {
    saveSession(sessionForRole('cashier'))
    mockApiResponses({ productResponses: [apiProducts, apiProductsAfterWaterSale] })
    render(<PosCheckoutPage />)
    await waitForProductsLoaded()

    await createWaterSale()
    fireEvent.click(screen.getByRole('button', { name: /ดูรายละเอียดบิล/ }))

    expect(screen.getByRole('dialog', { name: /รายละเอียดบิล/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ยกเลิกบิล' })).not.toBeInTheDocument()
    await waitFor(() => {
      expectStockMeter('Drinking Water', 22, 24)
    })
  })

  it('allows an admin to cancel a receipt after SweetAlert2 confirmation and restores stock', async () => {
    saveSession(sessionForRole('admin'))
    let sqlSales: Array<typeof apiWaterSale> = []
    mockApiResponses({
      productResponses: [apiProducts, apiProductsAfterWaterSale, apiProducts],
      sales: () => sqlSales,
    })
    render(<PosCheckoutPage />)
    await waitForProductsLoaded()

    await createWaterSale()
    confirmNextDialog()
    sqlSales = [{ ...apiWaterSale, status: 'void' }]
    mockedApiPost.mockResolvedValueOnce({ ...apiWaterSale, status: 'void' })
    fireEvent.click(screen.getByRole('button', { name: /ดูรายละเอียดบิล/ }))
    fireEvent.click(screen.getByRole('button', { name: 'ยกเลิกบิล' }))

    await waitFor(() => {
      expect(mockedSwal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          confirmButtonText: 'ยืนยันยกเลิก',
          icon: 'warning',
          showCancelButton: true,
          title: 'ยืนยันยกเลิกบิล',
        }),
      )
    })
    await waitFor(() => {
      expect(screen.getAllByText('ยกเลิกแล้ว').length).toBeGreaterThan(0)
    })
    expectStockMeter('Drinking Water', 24, 24)
    expect(screen.queryByRole('button', { name: 'ยกเลิกบิล' })).not.toBeInTheDocument()
  })

  it('keeps the checkout page focused by not rendering customer display controls', async () => {
    localStorage.setItem('pos-grocery:customer-display-enabled', 'true')

    render(<PosCheckoutPage />)
    await waitForProductsLoaded()

    expect(screen.getByRole('heading', { name: 'Checkout' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'เปิดหน้าจอลูกค้า' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'เปิดหน้าต่างจอลูกค้า' })).not.toBeInTheDocument()
    expect(screen.queryByText('ยอดที่ต้องชำระ 0.00 บาท')).not.toBeInTheDocument()
  })

  it('syncs scanned cart lines to customer display storage without rendering controls', async () => {
    render(<PosCheckoutPage />)
    await waitForProductsLoaded()

    fireEvent.change(screen.getByLabelText('สแกนหรือค้นหาสินค้า'), {
      target: { value: '8850002000010' },
    })
    fireEvent.change(screen.getByLabelText('สแกนหรือค้นหาสินค้า'), {
      target: { value: 'Drinking Water' },
    })

    await waitFor(() => {
      const displayPayload = JSON.parse(
        localStorage.getItem(customerDisplayPayloadStorageKey) ?? '{}',
      )
      expect(displayPayload.cart).toEqual([
        {
          barcode: '8850002000010',
          productId: 'product-water',
          productName: 'Drinking Water',
          quantity: 2,
          unitPrice: 7,
        },
      ])
      expect(displayPayload.cartTotal).toBe(14)
      expect(displayPayload.cashReceived).toBe(100)
      expect(displayPayload.changeDue).toBe(86)
    })

    expect(screen.queryByRole('checkbox', { name: 'เปิดหน้าจอลูกค้า' })).not.toBeInTheDocument()
  })
})
