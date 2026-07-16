import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Swal from 'sweetalert2'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiGet, apiPost } from '../../lib/api/client'
import { InventoryListPage } from './InventoryListPage'
import { InventoryReceivingPage } from './InventoryReceivingPage'
import { StockCountingPage } from './StockCountingPage'

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

const apiProducts = [
  {
    id: 'sql-inventory-product',
    name: 'SQL Inventory Product',
    barcode: 'SQL-INV-001',
    unit: 'box',
    images: [],
    costPriceSatang: 725,
    salePriceSatang: 999,
    stockQuantity: 12,
    status: 'active',
  },
]

const apiInventoryTransactions = [
  {
    id: 'receive-history-1',
    productId: 'sql-inventory-product',
    productName: 'SQL Inventory Product',
    barcode: 'SQL-INV-001',
    type: 'receive',
    quantityChange: 5,
    balanceAfterChange: 17,
    createdAt: '2026-06-29T08:05:00.000Z',
    createdBy: 'Owner',
  },
]

beforeEach(() => {
  mockedApiGet.mockImplementation(async (path) => {
    if (path === '/products?view=inventory') {
      return apiProducts
    }

    if (path.startsWith('/inventory/transactions')) {
      return apiInventoryTransactions
    }

    return apiProducts
  })
  mockedApiPost.mockResolvedValue({})
  mockedSwal.fire.mockResolvedValue({ isConfirmed: true, isDenied: false, isDismissed: false })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('Inventory pages', () => {
  it('loads inventory rows from the backend instead of rendering hardcoded products', async () => {
    render(<InventoryListPage />)

    expect(screen.queryByText('Drinking Water')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'สินค้า' })).toBeInTheDocument()
    expect(await screen.findByText('SQL Inventory Product')).toBeInTheDocument()
    expect(screen.getByText('SQL-INV-001')).toBeInTheDocument()
    expect(screen.getByText('box')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('พร้อมขาย')).toBeInTheDocument()
  })

  it('receives stock by posting the selected SQL product to the backend', async () => {
    render(<InventoryReceivingPage />)

    const scanInput = await screen.findByLabelText('สแกนหรือค้นหาสินค้า')
    expect(scanInput).toHaveFocus()
    expect(
      screen.getByText((content) => content.includes('คิวรับของเข้า')),
    ).toBeInTheDocument()
    expect(scanInput).toHaveAttribute('placeholder', 'สแกน barcode หรือพิมพ์ชื่อสินค้า')
    expect(screen.queryByRole('button', { name: 'เพิ่มเข้าคิว' })).not.toBeInTheDocument()
    // Open the dropdown to inspect the available suggestions.
    fireEvent.focus(scanInput)
    fireEvent.change(scanInput, { target: { value: 'SQL' } })
    const receivingListbox = await screen.findByRole('listbox')
    const receivingOptions = Array.from(within(receivingListbox).getAllByRole('option'))
    expect(receivingOptions).toHaveLength(1)
    expect(receivingOptions[0]).toHaveTextContent('SQL Inventory Product')
    expect(receivingOptions[0]).toHaveTextContent('SQL-INV-001')
    expect(receivingOptions.some((option) => option.textContent?.includes('SKU'))).toBe(false)

    fireEvent.change(scanInput, { target: { value: 'SQL-INV-001' } })
    fireEvent.change(scanInput, { target: { value: 'SQL-INV-001' } })

    expect(screen.getByRole('columnheader', { name: 'คงเหลือเดิม' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'หลังรับเข้า' })).toBeInTheDocument()
    const receivingRows = screen.getAllByRole('row')
    const targetRow = receivingRows.find((row) =>
      row.textContent?.includes('SQL Inventory Product'),
    )
    expect(targetRow).toBeDefined()
    expect(targetRow?.textContent).toMatch(/1.*SQL Inventory Product.*12.*14.*14\.50/)
    expect(screen.getByText((content) => content.includes('รวม 2 ชิ้น'))).toBeInTheDocument()
    expect(screen.getByText((content) => content.includes('มูลค่ารับเข้า 14.50 บาท'))).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'บันทึกรับของ 1 รายการ' }))

    await waitFor(() => {
      expect(mockedSwal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          confirmButtonText: 'ยืนยันบันทึก',
          icon: 'question',
          showCancelButton: true,
          title: 'ยืนยันบันทึกรับของเข้า',
        }),
      )
      expect(mockedApiPost).toHaveBeenCalledWith('/inventory/receive', {
        productId: 'sql-inventory-product',
        quantity: 2,
        unitCostSatang: 725,
      })
    })
  })

  it('does not save receiving rows when staff cancels the confirmation', async () => {
    mockedSwal.fire.mockResolvedValueOnce({ isConfirmed: false, isDenied: false, isDismissed: true })
    render(<InventoryReceivingPage />)

    const scanInput = await screen.findByLabelText('สแกนหรือค้นหาสินค้า')
    // Use a partial query so the change handler does not auto-add the
    // product (which would set the scan-enter flag), and Enter still
    // reaches the keydown handler like a user-typed Enter.
    fireEvent.change(scanInput, { target: { value: 'SQL' } })
    fireEvent.keyDown(scanInput, { key: 'Enter' })

    fireEvent.click(screen.getByRole('button', { name: 'บันทึกรับของ 1 รายการ' }))

    await waitFor(() => {
      expect(mockedSwal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'ยืนยันบันทึกรับของเข้า',
        }),
      )
    })
    expect(mockedApiPost).not.toHaveBeenCalled()
    expect(scanInput).toHaveFocus()
  })

  it('renders the receiving queue as a full-page table workspace', async () => {
    render(<InventoryReceivingPage />)

    expect(await screen.findByLabelText('สแกนหรือค้นหาสินค้า')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'พื้นที่รับของเข้าแบบเต็มหน้า' })).toHaveClass(
      'receiving-workspace-full',
    )
    expect(screen.getByRole('region', { name: 'ตารางคิวรับของเข้าแบบเต็มหน้า' })).toHaveClass(
      'receiving-queue-panel-full',
      'receiving-queue-panel-compact',
    )
    expect(screen.getByLabelText('ตารางรับของเข้าแบบเต็มหน้า')).toHaveClass('receiving-table-wrap-full')
    // The history table is hidden by default (Tab panel is not active until
    // the receiver switches to it), so we click the trigger first.
    const historyTab = await screen.findByRole('tab', { name: /ประวัติรับของเข้า/ })
    fireEvent.click(historyTab)
    expect(screen.getByRole('region', { name: 'ประวัติรับของเข้าล่าสุด' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'ประวัติรับของเข้า 100 รายการล่าสุด' })).toBeInTheDocument()
    expect(
      screen.getByRole('row', { name: /1 SQL Inventory Product SQL-INV-001 12 \+5 17 29\/06\/2026 15:05/ }),
    ).toBeInTheDocument()
    expect(mockedApiGet).toHaveBeenCalledWith('/inventory/transactions?limit=100')
  })

  it('lets staff search a product name and edit queued receiving quantity before saving', async () => {
    render(<InventoryReceivingPage />)

    const scanInput = await screen.findByLabelText('สแกนหรือค้นหาสินค้า')
    // Use a partial query so the change handler does not auto-add the
    // product (which would set the scan-enter flag), and Enter still
    // reaches the keydown handler like a user-typed Enter.
    fireEvent.change(scanInput, { target: { value: 'SQL' } })
    fireEvent.keyDown(scanInput, { key: 'Enter' })

    fireEvent.change(screen.getByLabelText('จำนวนรับเข้า SQL Inventory Product'), {
      target: { value: '5' },
    })
    fireEvent.change(screen.getByLabelText('ต้นทุนต่อหน่วย SQL Inventory Product'), {
      target: { value: '8.5' },
    })

    const receivingRows = screen.getAllByRole('row')
    const targetRow = receivingRows.find((row) =>
      row.textContent?.includes('SQL Inventory Product'),
    )
    expect(targetRow).toBeDefined()
    expect(targetRow?.textContent).toMatch(/1.*SQL Inventory Product.*12.*17.*42\.50/)

    fireEvent.click(screen.getByRole('button', { name: 'บันทึกรับของ 1 รายการ' }))

    await waitFor(() => {
      expect(mockedApiPost).toHaveBeenCalledWith('/inventory/receive', {
        productId: 'sql-inventory-product',
        quantity: 5,
        unitCostSatang: 850,
      })
    })
  })

  it('does not duplicate a receiving queue line when a barcode scanner appends Enter to a successful scan', async () => {
    render(<InventoryReceivingPage />)

    const scanInput = await screen.findByLabelText('สแกนหรือค้นหาสินค้า')

    // Simulate a barcode scanner: streams the barcode into the input and
    // then fires a single Enter key as a terminator.
    fireEvent.change(scanInput, { target: { value: 'SQL-INV-001' } })
    fireEvent.keyDown(scanInput, { key: 'Enter' })

    const receivingRows = screen.getAllByRole('row')
    const targetRow = receivingRows.find((row) =>
      row.textContent?.includes('SQL Inventory Product'),
    )
    expect(targetRow).toBeDefined()
    // Quantity must stay at 1, not 2, even though the scanner sent Enter.
    expect(targetRow?.textContent).toMatch(/1.*SQL Inventory Product.*12.*13/)
    expect(screen.getByText((content) => content.includes('รวม 1 ชิ้น'))).toBeInTheDocument()
    expect(scanInput).toHaveValue('')
    expect(scanInput).toHaveFocus()
  })

  it('shows product loading errors outside the product dropdown', async () => {
    mockedApiGet.mockRejectedValueOnce(new Error('Unexpected server error.'))

    render(<InventoryReceivingPage />)

    expect(await screen.findByText('Unexpected server error.')).toBeInTheDocument()
    expect(screen.getByLabelText('สแกนหรือค้นหาสินค้า')).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Unexpected server error.' })).not.toBeInTheDocument()
  })

  it('counts stock by scanning product barcode into a counting queue', async () => {
    mockedApiGet.mockImplementation(async (path) => {
      if (path === '/products?view=inventory') {
        return apiProducts
      }

      if (path.startsWith('/inventory/transactions')) {
        return [
          {
            id: 'inv-history-1',
            productId: 'sql-inventory-product',
            productName: 'SQL Inventory Product',
            barcode: 'SQL-INV-001',
            type: 'count',
            quantityChange: 2,
            balanceAfterChange: 14,
            createdAt: '2026-06-29T08:00:00.000Z',
            createdBy: 'Owner',
          },
        ]
      }

      return []
    })
    render(<StockCountingPage />)

    const scanInput = await screen.findByLabelText('สแกนหรือค้นหาสินค้าเพื่อตรวจนับ')
    expect(scanInput).toHaveFocus()
    expect(scanInput).toHaveAttribute('placeholder', 'สแกน barcode หรือพิมพ์ชื่อสินค้า')
    expect(screen.queryByRole('button', { name: 'เพิ่มเข้าคิว' })).not.toBeInTheDocument()
    expect(
      screen.getByText((content) => content.includes('คิวตรวจนับ stock')),
    ).toBeInTheDocument()
    // Open the dropdown to inspect the available suggestions.
    fireEvent.focus(scanInput)
    fireEvent.change(scanInput, { target: { value: 'SQL' } })
    const countingListbox = await screen.findByRole('listbox')
    const countingOptions = Array.from(within(countingListbox).getAllByRole('option'))
    expect(countingOptions).toHaveLength(1)
    expect(countingOptions[0]).toHaveTextContent('SQL Inventory Product')
    expect(countingOptions[0]).toHaveTextContent('SQL-INV-001')
    // The queue/history surfaces are now separate Tabs. The history table
    // is hidden until the user activates the "ประวัติการปรับ stock" tab.
    expect(screen.getByRole('tab', { name: /คิวตรวจนับ stock/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /ประวัติการปรับ stock/ })).toHaveAttribute('aria-selected', 'false')
    expect(screen.queryByRole('table', { name: 'ประวัติการปรับ stock' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /ประวัติการปรับ stock/ }))
    expect(screen.getByRole('tab', { name: /คิวตรวจนับ stock/ })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: /ประวัติการปรับ stock/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('table', { name: 'ประวัติการปรับ stock' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'ยอดจริงปัจจุบัน' })).toBeInTheDocument()
    expect(
      screen.getByRole('row', { name: /1 29\/06\/2026 15:00 SQL Inventory Product SQL-INV-001 ตรวจนับ \+2 14 Owner/ }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /คิวตรวจนับ stock/ }))

    fireEvent.change(scanInput, { target: { value: 'SQL-INV-001' } })
    fireEvent.change(scanInput, { target: { value: 'SQL-INV-001' } })

    expect(screen.getByRole('columnheader', { name: 'คงเหลือในระบบ' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'นับได้' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'ผลต่าง' })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /1 SQL Inventory Product SQL-INV-001 box 12 13 1/ })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('จำนวนที่นับได้ SQL Inventory Product'), { target: { value: '14' } })
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกตรวจนับ 1 รายการ' }))

    await waitFor(() => {
      expect(mockedApiPost).toHaveBeenCalledWith('/inventory/count', {
        productId: 'sql-inventory-product',
        countedQuantity: 14,
      })
    })
  })

  it('does not duplicate a counting queue line when a barcode scanner appends Enter to a successful scan', async () => {
    render(<StockCountingPage />)

    const scanInput = await screen.findByLabelText('สแกนหรือค้นหาสินค้าเพื่อตรวจนับ')

    // Simulate a barcode scanner: streams the barcode into the input and
    // then fires a single Enter key as a terminator. The second change is
    // what the cashier would actually type to scan (and matches the
    // existing single-press scanner test below).
    fireEvent.change(scanInput, { target: { value: 'SQL-INV-001' } })
    fireEvent.keyDown(scanInput, { key: 'Enter' })

    await waitFor(() => {
      expect(
        screen.getByRole('row', {
          name: /1 SQL Inventory Product SQL-INV-001 box 12 12 0/,
        }),
      ).toBeInTheDocument()
    })
    expect(scanInput).toHaveValue('')
    expect(scanInput).toHaveFocus()
  })

  it('exposes the receiving tabs with proper ARIA state and supports keyboard navigation', async () => {
    render(<InventoryReceivingPage />)

    const queueTab = await screen.findByRole('tab', { name: /คิวรับของเข้า/ })
    const historyTab = screen.getByRole('tab', { name: /ประวัติรับของเข้า/ })
    const tablist = screen.getByRole('tablist', { name: 'สลับระหว่างคิวรับของเข้าและประวัติรับของเข้า' })

    expect(queueTab).toHaveAttribute('aria-selected', 'true')
    expect(historyTab).toHaveAttribute('aria-selected', 'false')
    expect(queueTab).toHaveAttribute('tabindex', '0')
    expect(historyTab).toHaveAttribute('tabindex', '-1')
    expect(queueTab).toHaveAttribute('aria-controls')
    expect(historyTab).toHaveAttribute('aria-controls')

    // Tab list captures ArrowRight, moves focus, and flips aria-selected.
    queueTab.focus()
    fireEvent.keyDown(tablist, { key: 'ArrowRight' })
    await waitFor(() => {
      expect(historyTab).toHaveAttribute('aria-selected', 'true')
    })
    await waitFor(() => {
      expect(historyTab).toHaveFocus()
    })
    expect(queueTab).toHaveAttribute('aria-selected', 'false')

    // ArrowLeft wraps to the previous tab and brings the queue back.
    fireEvent.keyDown(tablist, { key: 'ArrowLeft' })
    await waitFor(() => {
      expect(queueTab).toHaveAttribute('aria-selected', 'true')
    })
    await waitFor(() => {
      expect(queueTab).toHaveFocus()
    })
  })

  it('exposes the stock-counting tabs with proper ARIA state and supports keyboard navigation', async () => {
    render(<StockCountingPage />)

    const queueTab = await screen.findByRole('tab', { name: /คิวตรวจนับ stock/ })
    const historyTab = screen.getByRole('tab', { name: /ประวัติการปรับ stock/ })
    const tablist = screen.getByRole('tablist', {
      name: 'สลับระหว่างคิวตรวจนับ stock และประวัติการปรับ stock',
    })

    expect(queueTab).toHaveAttribute('aria-selected', 'true')
    expect(historyTab).toHaveAttribute('aria-selected', 'false')
    expect(queueTab).toHaveAttribute('tabindex', '0')
    expect(historyTab).toHaveAttribute('tabindex', '-1')

    // Home jumps to the first tab.
    historyTab.focus()
    fireEvent.keyDown(tablist, { key: 'Home' })
    await waitFor(() => {
      expect(queueTab).toHaveAttribute('aria-selected', 'true')
    })
    await waitFor(() => {
      expect(queueTab).toHaveFocus()
    })

    // End jumps to the last tab.
    fireEvent.keyDown(tablist, { key: 'End' })
    await waitFor(() => {
      expect(historyTab).toHaveAttribute('aria-selected', 'true')
    })
    await waitFor(() => {
      expect(historyTab).toHaveFocus()
    })
  })

  it('does not render the duplicate counting hint under the scan field', async () => {
    render(<StockCountingPage />)

    await screen.findByLabelText('สแกนหรือค้นหาสินค้าเพื่อตรวจนับ')
    expect(
      screen.getByText('สแกนสินค้าซ้ำเพื่อเพิ่มจำนวนที่นับได้ทีละ 1 ชิ้น'),
    ).toBeInTheDocument()
    expect(
      screen.getAllByText('สแกนสินค้าซ้ำเพื่อเพิ่มจำนวนที่นับได้ทีละ 1 ชิ้น'),
    ).toHaveLength(1)
  })
})
