import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    expect(screen.getByText('คิวรับของเข้า')).toBeInTheDocument()
    expect(scanInput).toHaveAttribute('placeholder', 'สแกน barcode หรือพิมพ์ชื่อสินค้า')
    expect(screen.queryByRole('button', { name: 'เพิ่มเข้าคิว' })).not.toBeInTheDocument()
    const receivingOptions = Array.from(document.querySelectorAll('#receiving-product-options option'))
    expect(receivingOptions.map((option) => [option.getAttribute('value'), option.textContent])).toEqual([
      ['SQL Inventory Product', 'SQL Inventory Product - SQL-INV-001'],
    ])
    expect(receivingOptions.some((option) => option.textContent?.includes('SKU'))).toBe(false)

    fireEvent.change(scanInput, { target: { value: 'SQL-INV-001' } })
    fireEvent.change(scanInput, { target: { value: 'SQL-INV-001' } })

    expect(screen.getByRole('columnheader', { name: 'คงเหลือเดิม' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'หลังรับเข้า' })).toBeInTheDocument()
    expect(
      screen.getByRole('row', { name: /1 SQL Inventory Product 12 2 14 7\.25 14\.50/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('รวม 2 ชิ้น')).toBeInTheDocument()
    expect(screen.getByText('มูลค่ารับเข้า 14.50 บาท')).toBeInTheDocument()

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
    fireEvent.change(scanInput, { target: { value: 'SQL-INV-001' } })
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
    expect(screen.getByRole('region', { name: 'ประวัติรับของเข้าล่าสุด' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'ประวัติรับของเข้า 100 รายการล่าสุด' })).toBeInTheDocument()
    expect(
      screen.getByRole('row', { name: /SQL Inventory Product SQL-INV-001 12 \+5 17 29\/06\/2026 15:05/ }),
    ).toBeInTheDocument()
    expect(mockedApiGet).toHaveBeenCalledWith('/inventory/transactions?limit=100')
  })

  it('lets staff search a product name and edit queued receiving quantity before saving', async () => {
    render(<InventoryReceivingPage />)

    const scanInput = await screen.findByLabelText('สแกนหรือค้นหาสินค้า')
    fireEvent.change(scanInput, { target: { value: 'SQL Inventory Product' } })
    fireEvent.keyDown(scanInput, { key: 'Enter' })

    fireEvent.change(screen.getByLabelText('จำนวนรับเข้า SQL Inventory Product'), {
      target: { value: '5' },
    })
    fireEvent.change(screen.getByLabelText('ต้นทุนต่อหน่วย SQL Inventory Product'), {
      target: { value: '8.5' },
    })

    expect(
      screen.getByRole('row', { name: /1 SQL Inventory Product 12 5 17 8\.5 42\.50/ }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'บันทึกรับของ 1 รายการ' }))

    await waitFor(() => {
      expect(mockedApiPost).toHaveBeenCalledWith('/inventory/receive', {
        productId: 'sql-inventory-product',
        quantity: 5,
        unitCostSatang: 850,
      })
    })
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
    expect(screen.getByText('คิวตรวจนับ stock')).toBeInTheDocument()
    const countingOptions = Array.from(document.querySelectorAll('#stock-counting-product-options option'))
    expect(countingOptions.map((option) => [option.getAttribute('value'), option.textContent])).toEqual([
      ['SQL Inventory Product', 'SQL Inventory Product - SQL-INV-001'],
    ])
    const countingLayout = screen.getByLabelText('คิวตรวจนับ stock ซ้าย และประวัติการปรับ stock ขวา')
    expect(countingLayout.children[0]).toHaveClass('stock-counting-queue-panel')
    expect(countingLayout.children[1]).toHaveClass('stock-counting-history-panel')
    expect(screen.getByRole('table', { name: 'ประวัติการปรับ stock' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'ยอดจริงปัจจุบัน' })).toBeInTheDocument()
    expect(
      screen.getByRole('row', { name: /1 29\/06\/2026 15:00 SQL Inventory Product SQL-INV-001 ตรวจนับ \+2 14 Owner/ }),
    ).toBeInTheDocument()

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
})
