import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiGet, apiPost } from '../../lib/api/client'
import { InventoryListPage } from './InventoryListPage'
import { InventoryReceivingPage } from './InventoryReceivingPage'
import { StockCountingPage } from './StockCountingPage'

vi.mock('../../lib/api/client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))

const mockedApiGet = vi.mocked(apiGet)
const mockedApiPost = vi.mocked(apiPost)

const apiProducts = [
  {
    id: 'sql-inventory-product',
    name: 'SQL Inventory Product',
    barcode: 'SQL-INV-001',
    sku: 'INV-SKU',
    unit: 'box',
    images: [],
    costPriceSatang: 725,
    salePriceSatang: 999,
    stockQuantity: 12,
    status: 'active',
  },
]

beforeEach(() => {
  mockedApiGet.mockResolvedValue(apiProducts)
  mockedApiPost.mockResolvedValue({})
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
    expect(screen.getByText('INV-SKU')).toBeInTheDocument()
    expect(screen.getByText('box')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('พร้อมขาย')).toBeInTheDocument()
  })

  it('receives stock by posting the selected SQL product to the backend', async () => {
    render(<InventoryReceivingPage />)

    expect(screen.getByText('สินค้าในคลัง')).toBeInTheDocument()
    expect(screen.getByText('จำนวนที่รับเข้า')).toBeInTheDocument()
    expect(screen.getByText('ต้นทุนต่อหน่วย (บาท)')).toBeInTheDocument()
    expect(screen.getByText('เลือกสินค้าที่ต้องการเพิ่มสต็อก')).toBeInTheDocument()
    expect(await screen.findByRole('option', { name: 'SQL Inventory Product' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('จำนวนรับเข้า'), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText('ราคาต้นทุนต่อหน่วย'), { target: { value: '7.25' } })
    fireEvent.submit(screen.getByRole('button', { name: 'บันทึกรับของ' }).closest('form')!)

    await waitFor(() => {
      expect(mockedApiPost).toHaveBeenCalledWith('/inventory/receive', {
        productId: 'sql-inventory-product',
        quantity: 5,
        unitCostSatang: 725,
      })
    })
  })

  it('shows product loading errors outside the product dropdown', async () => {
    mockedApiGet.mockRejectedValueOnce(new Error('Unexpected server error.'))

    render(<InventoryReceivingPage />)

    expect(await screen.findByText('Unexpected server error.')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'เลือกสินค้า' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Unexpected server error.' })).not.toBeInTheDocument()
  })

  it('posts stock counts for SQL products to the backend', async () => {
    render(<StockCountingPage />)

    expect(await screen.findByText('SQL Inventory Product')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('จำนวนที่นับได้ SQL Inventory Product'), { target: { value: '14' } })
    fireEvent.click(screen.getByRole('button', { name: 'ปรับยอด' }))

    await waitFor(() => {
      expect(mockedApiPost).toHaveBeenCalledWith('/inventory/count', {
        productId: 'sql-inventory-product',
        countedQuantity: 14,
      })
    })
  })
})
