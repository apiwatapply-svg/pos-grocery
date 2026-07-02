import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Swal from 'sweetalert2'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiGet, apiPost } from '../../lib/api/client'
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

function cashButtonLabel(amount: number) {
  return `${new Intl.NumberFormat('th-TH').format(amount)} บาท`
}

const apiProducts = [
  {
    id: 'product-water',
    storeId: 'store-1',
    name: 'Drinking Water',
    barcode: '8850002000010',
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
  soldAt: '2026-06-29T01:35:00.000Z',
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

const apiProductsAfterMixedSale = [
  { ...apiProducts[0], stockQuantity: 22 },
  { ...apiProducts[1], stockQuantity: 17 },
]

const currentStore = {
  id: 'store-1',
  name: 'POS Grocery',
  phone: '0800000000',
  address: 'Bangkok',
  ownerName: 'Owner',
  logoUrl: 'https://example.com/pos-logo.png',
  status: 'active',
}

function mockApiResponses(input?: {
  productResponses?: Array<typeof apiProducts>
}) {
  const productResponses = input?.productResponses ?? [apiProducts]
  let productCallIndex = 0

  mockedApiGet.mockImplementation(async (path: string) => {
    if (path === '/store/current') {
      return currentStore
    }

    if (path === '/products?view=operation') {
      const response = productResponses[Math.min(productCallIndex, productResponses.length - 1)]
      productCallIndex += 1
      return response
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
  function confirmNextDialog() {
    mockedSwal.fire.mockResolvedValueOnce(confirmedDialog)
  }

  async function waitForProductsLoaded() {
    await waitFor(() => {
      expect(document.querySelector('#pos-product-options option[value="Drinking Water"]')).not.toBeNull()
    })
  }

  it('does not render fallback mock products before SQL products load', async () => {
    mockedApiGet.mockImplementation(async (path: string) => {
      if (path === '/store/current') {
        return new Promise(() => undefined)
      }

      if (path === '/products?view=operation') {
        return new Promise(() => undefined)
      }

      throw new Error(`Unexpected GET ${path}`)
    })

    render(<PosCheckoutPage />)

    expect(screen.queryByText('Drinking Water')).not.toBeInTheDocument()
    expect(screen.queryByText('Instant Noodles')).not.toBeInTheDocument()
    expect(screen.getByText('สแกนหรือเลือกสินค้าจากช่องค้นหา')).toBeInTheDocument()
  })

  it('keeps checkout full page and does not preload receipts or stock side panels', async () => {
    render(<PosCheckoutPage />)
    await waitForProductsLoaded()

    expect(screen.getByRole('heading', { name: 'Checkout' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'ใบเสร็จ' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Stock หลังขาย' })).not.toBeInTheDocument()
    expect(mockedApiGet).not.toHaveBeenCalledWith(expect.stringMatching(/^\/sales\?/))
  })

  it('disables cash controls and checkout while the cart is empty', async () => {
    render(<PosCheckoutPage />)
    await waitForProductsLoaded()

    expect(screen.getByLabelText('จำนวนเงินที่รับ')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'จ่ายพอดี' })).toBeDisabled()
    for (const amount of [5, 10, 20, 50, 100, 500, 1000]) {
      expect(screen.getByRole('button', { name: cashButtonLabel(amount) })).toBeDisabled()
    }
    expect(screen.getByRole('status', { name: 'รอสินค้า 0.00 บาท' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ชำระเงิน' })).toBeDisabled()
  })

  it('keeps cash input and payment status in one horizontal row', async () => {
    render(<PosCheckoutPage />)
    await waitForProductsLoaded()

    const cashInputRow = screen.getByLabelText('จำนวนเงินที่รับ').closest('.payment-input-row')
    const paymentStatusRow = screen
      .getByRole('status', { name: 'รอสินค้า 0.00 บาท' })
      .closest('.payment-input-row')

    expect(cashInputRow).not.toBeNull()
    expect(paymentStatusRow).toBe(cashInputRow)
  })

  it('keeps the scan field focused for barcode scanner input', async () => {
    render(<PosCheckoutPage />)
    await waitForProductsLoaded()

    const scanInput = screen.getByLabelText('สแกนหรือค้นหาสินค้า')
    expect(scanInput).toHaveFocus()
    expect(scanInput).toHaveAttribute('placeholder', 'สแกน barcode / QR หรือพิมพ์ชื่อสินค้า')
    const productOptions = Array.from(document.querySelectorAll('#pos-product-options option'))
    expect(productOptions.map((option) => [option.getAttribute('value'), option.textContent])).toEqual([
      ['Drinking Water', 'Drinking Water - 8850002000010 - 7.00 บาท'],
      ['Instant Noodles', 'Instant Noodles - 8850001000011 - 12.00 บาท'],
    ])
    expect(productOptions.some((option) => option.textContent?.includes('SKU'))).toBe(false)

    fireEvent.change(scanInput, {
      target: { value: '8850002000010' },
    })

    expect(scanInput).toHaveFocus()
    expect(screen.getByRole('table', { name: 'รายการสินค้าในตะกร้า' })).toBeInTheDocument()
  })

  it('keeps inactive products out of the searchable POS dropdown', async () => {
    mockApiResponses({
      productResponses: [[
        ...apiProducts,
        {
          ...apiProducts[0],
          id: 'product-archived',
          name: 'Archived Product',
          barcode: 'ARCHIVED-001',
          status: 'inactive',
        },
      ]],
    })
    render(<PosCheckoutPage />)
    await waitForProductsLoaded()

    const productOptions = Array.from(document.querySelectorAll('#pos-product-options option'))
    expect(productOptions.map((option) => option.textContent)).not.toContain(
      'Archived Product - ARCHIVED-001 - 7.00 บาท',
    )
  })

  it('adds scanned and selected products immediately, merges duplicates, confirms checkout, and syncs the latest sale to customer display', async () => {
    mockApiResponses({
      productResponses: [apiProducts, apiProductsAfterMixedSale],
    })
    render(<PosCheckoutPage />)
    await waitForProductsLoaded()
    confirmNextDialog()
    const mixedSale = {
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
    }
    mockedApiPost.mockImplementationOnce(async () => {
      return mixedSale
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
    for (const column of ['No', 'ภาพ', 'สินค้า', 'ราคา', 'จำนวน', 'ราคารวม', 'จัดการ']) {
      expect(within(cartTable).getByRole('columnheader', { name: column })).toBeInTheDocument()
    }
    const cartRows = within(cartTable).getAllByRole('row')
    // Row 1 = newest scan (Instant Noodles, unshift order)
    expect(within(cartRows[1]).getByRole('cell', { name: '1' })).toBeInTheDocument()
    expect(within(cartRows[1]).getByRole('cell', { name: 'Instant Noodles 8850001000011' })).toBeInTheDocument()
    expect(within(cartRows[1]).getAllByText('12.00').length).toBeGreaterThanOrEqual(1)
    // Row 2 = older scan (Drinking Water, merged to q2)
    expect(within(cartRows[2]).getByRole('cell', { name: '2' })).toBeInTheDocument()
    expect(within(cartRows[2]).getByRole('cell', { name: 'Drinking Water 8850002000010' })).toBeInTheDocument()
    expect(within(cartRows[2]).getByText('7.00')).toBeInTheDocument()
    expect(within(cartRows[2]).getByText('14.00')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('จำนวนเงินที่รับ'), {
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
    await waitFor(() => {
      expect(screen.getByText('สแกนหรือเลือกสินค้าจากช่องค้นหา')).toBeInTheDocument()
    })
    await waitFor(() => {
      const displayPayload = JSON.parse(
        localStorage.getItem(customerDisplayPayloadStorageKey) ?? '{}',
      )
      expect(displayPayload.cart).toEqual([])
      expect(displayPayload.lastSale).toEqual(
        expect.objectContaining({
          receiptNumber: mixedSale.receiptNumber,
          total: 26,
          cashReceived: 100,
          changeDue: 74,
        }),
      )
    })
  })

  it('removes a scanned product line from the cart and recalculates totals before checkout', async () => {
    mockedSwal.fire.mockResolvedValue(confirmedDialog)
    render(<PosCheckoutPage />)
    await waitForProductsLoaded()

    fireEvent.change(screen.getByLabelText('สแกนหรือค้นหาสินค้า'), {
      target: { value: '8850002000010' },
    })
    fireEvent.change(screen.getByLabelText('สแกนหรือค้นหาสินค้า'), {
      target: { value: 'Instant Noodles' },
    })

    expect(screen.getByText(/ยอดรวม 19\.00 บาท/)).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'เอา Drinking Water ออกจากตะกร้า' }))
    })

    const cartTable = screen.getByRole('table', { name: 'รายการสินค้าในตะกร้า' })
    expect(within(cartTable).queryByText('Drinking Water')).not.toBeInTheDocument()
    expect(within(cartTable).getByText('Instant Noodles')).toBeInTheDocument()
    expect(screen.getByText(/ยอดรวม 12\.00 บาท/)).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'เงินทอน 88.00 บาท' })).toBeInTheDocument()

    await waitFor(() => {
      const displayPayload = JSON.parse(
        localStorage.getItem(customerDisplayPayloadStorageKey) ?? '{}',
      )
      expect(displayPayload.cart).toEqual([
        {
          barcode: '8850001000011',
          productId: 'product-noodle',
          productName: 'Instant Noodles',
          quantity: 1,
          unitPrice: 12,
        },
      ])
      expect(displayPayload.cartTotal).toBe(12)
      expect(displayPayload.changeDue).toBe(88)
    })
  })

  it('adjusts cart item quantities with plus and minus buttons', async () => {
    render(<PosCheckoutPage />)
    await waitForProductsLoaded()

    fireEvent.change(screen.getByLabelText('สแกนหรือค้นหาสินค้า'), {
      target: { value: '8850002000010' },
    })

    const decreaseButton = screen.getByRole('button', { name: 'ลดจำนวน Drinking Water' })
    const increaseButton = screen.getByRole('button', { name: 'เพิ่มจำนวน Drinking Water' })

    expect(screen.getByLabelText('จำนวน Drinking Water')).toHaveTextContent('1')
    expect(decreaseButton).toBeDisabled()
    fireEvent.click(increaseButton)

    expect(screen.getByLabelText('จำนวน Drinking Water')).toHaveTextContent('2')
    expect(screen.getByText(/ยอดรวม 14\.00 บาท/)).toBeInTheDocument()
    expect(decreaseButton).not.toBeDisabled()

    fireEvent.click(decreaseButton)

    expect(screen.getByLabelText('จำนวน Drinking Water')).toHaveTextContent('1')
    expect(screen.getByText(/ยอดรวม 7\.00 บาท/)).toBeInTheDocument()
  })

  it('checks out through the backend and reloads shared stock from products API', async () => {
    localStorage.clear()
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
      expect(mockedApiGet).toHaveBeenCalledWith('/products?view=operation')
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
      expect(screen.getByText('สแกนหรือเลือกสินค้าจากช่องค้นหา')).toBeInTheDocument()
    })
    await waitFor(() => {
      const displayPayload = JSON.parse(
        localStorage.getItem(customerDisplayPayloadStorageKey) ?? '{}',
      )
      expect(displayPayload.lastSale).toEqual(
        expect.objectContaining({
          receiptNumber: apiWaterSale.receiptNumber,
          total: 7,
          changeDue: 93,
        }),
      )
    })
  })

  it('supports quick cash amounts, custom cash, live change, and blocks underpaid checkout confirmation', async () => {
    localStorage.clear()
    render(<PosCheckoutPage />)
    await waitForProductsLoaded()

    fireEvent.change(screen.getByLabelText('สแกนหรือค้นหาสินค้า'), {
      target: { value: '8850002000010' },
    })
    fireEvent.change(screen.getByLabelText('สแกนหรือค้นหาสินค้า'), {
      target: { value: 'Drinking Water' },
    })

    for (const amount of [5, 10, 20, 50, 100, 500, 1000]) {
      expect(screen.getByRole('button', { name: cashButtonLabel(amount) })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'จ่ายพอดี' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '20 บาท' }))
    expect(screen.getByLabelText('จำนวนเงินที่รับ')).toHaveValue(20)
    expect(screen.getByRole('status', { name: 'เงินทอน 6.00 บาท' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'จ่ายพอดี' }))
    expect(screen.getByLabelText('จำนวนเงินที่รับ')).toHaveValue(14)
    expect(screen.getByRole('status', { name: 'จ่ายพอดี 0.00 บาท' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('จำนวนเงินที่รับ'), {
      target: { value: '10' },
    })
    expect(screen.getByRole('status', { name: 'ขาดอีก 4.00 บาท' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ชำระเงิน' })).toBeDisabled()
    expect(mockedSwal.fire).not.toHaveBeenCalled()
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

  it('resets customer display payment amounts to zero when the cart is empty', async () => {
    localStorage.setItem(customerDisplayPayloadStorageKey, JSON.stringify({
      store: { name: 'POS Grocery' },
      cart: [],
      cartTotal: 0,
      cashReceived: 100,
      changeDue: 0,
      lastSale: null,
    }))

    render(<PosCheckoutPage />)
    await waitForProductsLoaded()

    await waitFor(() => {
      const displayPayload = JSON.parse(
        localStorage.getItem(customerDisplayPayloadStorageKey) ?? '{}',
      )
      expect(displayPayload.cart).toEqual([])
      expect(displayPayload.cartTotal).toBe(0)
      expect(displayPayload.cashReceived).toBe(0)
      expect(displayPayload.changeDue).toBe(0)
    })
  })

  it('persists the cart under a storeId-scoped localStorage key and restores it on remount', async () => {
    localStorage.clear()
    render(<PosCheckoutPage />)
    await waitForProductsLoaded()

    fireEvent.change(screen.getByLabelText('สแกนหรือค้นหาสินค้า'), {
      target: { value: '8850002000010' },
    })

    await waitFor(() => {
      const stored = localStorage.getItem('pos-grocery:pos-cart:store-1')
      expect(stored).not.toBeNull()
      expect(JSON.parse(stored ?? '[]')).toHaveLength(1)
    })

    cleanup()
    render(<PosCheckoutPage />)
    await waitForProductsLoaded()

    expect(screen.getByText('Drinking Water')).toBeInTheDocument()
    expect(screen.getByText(/ยอดรวม 7\.00 บาท/)).toBeInTheDocument()
  })

  it('switches to the new store cart without leaking the previous store items when the current store changes', async () => {
    localStorage.clear()
    localStorage.setItem(
      'pos-grocery:pos-cart:store-other',
      JSON.stringify([{
        barcode: '8850001000011',
        productId: 'product-noodle',
        productName: 'Instant Noodles',
        quantity: 1,
        unitPrice: 12,
      }]),
    )

    let storeRequestCount = 0
    mockedApiGet.mockImplementation(async (path: string) => {
      if (path === '/store/current') {
        storeRequestCount += 1
        if (storeRequestCount === 1) {
          return { ...currentStore, id: 'store-1' }
        }
        return { ...currentStore, id: 'store-other' }
      }

      if (path === '/products?view=operation') {
        return apiProducts
      }

      throw new Error(`Unexpected GET ${path}`)
    })

    render(<PosCheckoutPage />)
    await waitForProductsLoaded()

    fireEvent.change(screen.getByLabelText('สแกนหรือค้นหาสินค้า'), {
      target: { value: '8850002000010' },
    })

    await waitFor(() => {
      const stored = localStorage.getItem('pos-grocery:pos-cart:store-1')
      expect(JSON.parse(stored ?? '[]')).toHaveLength(1)
    })

    cleanup()
    render(<PosCheckoutPage />)
    await waitForProductsLoaded()

    expect(screen.getByText(/ยอดรวม 12\.00 บาท/)).toBeInTheDocument()
    expect(screen.getByText('Instant Noodles')).toBeInTheDocument()
    expect(screen.queryByText('Drinking Water')).not.toBeInTheDocument()
  })

  it('shows SweetAlert when scanning a product with zero stock, blocks adding to cart, and refocuses scan input after OK', async () => {
    const outOfStockProduct = {
      id: 'product-out-of-stock',
      storeId: 'store-1',
      name: 'Out Of Stock Item',
      barcode: 'OUT-OF-STOCK-001',
      unit: 'pack',
      costPriceSatang: 500,
      salePriceSatang: 900,
      stockQuantity: 0,
      status: 'active',
      images: [],
    }
    mockApiResponses({
      productResponses: [[...apiProducts, outOfStockProduct]],
    })
    mockedSwal.fire.mockResolvedValueOnce(confirmedDialog)

    render(<PosCheckoutPage />)
    await waitForProductsLoaded()

    const scan = screen.getByLabelText('สแกนหรือค้นหาสินค้า')
    fireEvent.change(scan, {
      target: { value: 'OUT-OF-STOCK-001' },
    })

    await waitFor(() => {
      expect(mockedSwal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'สินค้าหมด stock',
          confirmButtonText: 'OK',
          icon: 'warning',
        }),
      )
    })
    expect(screen.queryByText('Out Of Stock Item')).not.toBeInTheDocument()
    expect(screen.getByText('สแกนหรือเลือกสินค้าจากช่องค้นหา')).toBeInTheDocument()
    await waitFor(() => {
      expect(scan).toHaveValue('')
      expect(scan).toHaveFocus()
    })
  })

  it('keeps the scan field focused when clicking outside allowed controls', async () => {
    render(<PosCheckoutPage />)
    await waitForProductsLoaded()

    const scan = screen.getByLabelText('สแกนหรือค้นหาสินค้า')
    fireEvent.change(scan, {
      target: { value: '8850002000010' },
    })
    expect(scan).toHaveFocus()

    fireEvent.mouseDown(document.body)
    await waitFor(() => {
      expect(scan).toHaveFocus()
    })
  })
})
