import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiGet, apiPost } from '../../lib/api/client'
import { saveSession, type Session } from '../../lib/auth/session'
import { ProductListPage } from './ProductListPage'

vi.mock('../../lib/api/client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))

const mockedApiGet = vi.mocked(apiGet)
const mockedApiPost = vi.mocked(apiPost)

const apiProducts = [
  {
    id: 'sql-product-1',
    name: 'SQL Product',
    barcode: 'SQL-001',
    sku: 'SQL-SKU',
    unit: 'box',
    images: [{ thumbnailUrl: 'https://example.com/sql-product.jpg' }],
    costPriceSatang: 123,
    salePriceSatang: 456,
    stockQuantity: 9,
    status: 'active',
  },
  {
    id: 'sql-product-2',
    name: 'Filtered Product',
    barcode: 'SQL-002',
    sku: 'FILTER-SKU',
    unit: 'pack',
    images: [],
    costPriceSatang: 1000,
    salePriceSatang: 1500,
    stockQuantity: 0,
    status: 'inactive',
  },
]

const ownerSession: Session = {
  token: 'token-owner',
  user: {
    id: 'owner-1',
    username: 'admin',
    displayName: 'Admin',
    role: 'owner',
  },
}

const stockSession: Session = {
  token: 'token-stock',
  user: {
    id: 'stock-1',
    username: 'stock',
    displayName: 'Stock One',
    role: 'stock',
  },
}

function renderPage(session: Session) {
  saveSession(session)
  render(
    <MemoryRouter>
      <ProductListPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockedApiGet.mockResolvedValue(apiProducts)
  mockedApiPost.mockImplementation(async (_path, body) => ({
    id: `created-${String((body as { barcode: string }).barcode)}`,
    ...(body as object),
    stockQuantity: 0,
  }))
})

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('ProductListPage', () => {
  it('shows the create product action for owners', async () => {
    renderPage(ownerSession)

    expect(screen.getByRole('button', { name: 'เพิ่มสินค้า' })).toBeInTheDocument()
    expect(await screen.findByText('SQL Product')).toBeInTheDocument()
  })

  it('hides the create product action for stock users', async () => {
    renderPage(stockSession)

    expect(screen.queryByRole('button', { name: 'เพิ่มสินค้า' })).not.toBeInTheDocument()
    expect(await screen.findByText('SQL Product')).toBeInTheDocument()
  })

  it('loads products from the backend instead of rendering hardcoded products', async () => {
    renderPage(ownerSession)

    expect(screen.queryByText('Drinking Water')).not.toBeInTheDocument()
    expect(await screen.findByText('SQL Product')).toBeInTheDocument()
    expect(screen.getByText('SQL-001')).toBeInTheDocument()
  })

  it('shows product and inventory data in one complete table', async () => {
    renderPage(ownerSession)

    expect(await screen.findByText('SQL Product')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'รูป' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'SKU' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'หน่วย' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'คงเหลือ' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'สถานะสต็อก' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'SQL Product' })).toBeInTheDocument()
    expect(screen.getByText('SQL-SKU')).toBeInTheDocument()
    expect(screen.getByText('box')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.getByText('พร้อมขาย')).toBeInTheDocument()
    expect(screen.getByText('หมดสต็อก')).toBeInTheDocument()
  })

  it('filters the combined product table from a searchable dropdown input', async () => {
    renderPage(ownerSession)
    expect(await screen.findByText('SQL Product')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'ล้างตัวกรอง' })).toHaveClass('product-filter-clear')

    fireEvent.change(screen.getByLabelText('ค้นหา/กรองสินค้า'), {
      target: { value: 'FILTER-SKU' },
    })

    expect(screen.queryByText('SQL Product')).not.toBeInTheDocument()
    expect(screen.getByText('Filtered Product')).toBeInTheDocument()
    expect(screen.getByText('SQL-002')).toBeInTheDocument()
  })

  it('creates multiple products from one modal instead of navigating to a new page', async () => {
    renderPage(ownerSession)
    expect(await screen.findByText('SQL Product')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มสินค้า' }))
    const dialog = screen.getByRole('dialog', { name: 'เพิ่มสินค้าหลายรายการ' })

    fireEvent.change(within(dialog).getAllByLabelText('ชื่อสินค้า')[0], {
      target: { value: 'Apple Juice' },
    })
    fireEvent.change(within(dialog).getAllByLabelText('Barcode')[0], {
      target: { value: '8851110000011' },
    })
    fireEvent.change(within(dialog).getAllByLabelText('SKU')[0], {
      target: { value: 'JUICE-APPLE' },
    })
    fireEvent.change(within(dialog).getAllByLabelText('หน่วย')[0], {
      target: { value: 'bottle' },
    })
    fireEvent.change(within(dialog).getAllByLabelText('ต้นทุน')[0], {
      target: { value: '10.50' },
    })
    fireEvent.change(within(dialog).getAllByLabelText('ราคาขาย')[0], {
      target: { value: '18.00' },
    })

    fireEvent.click(within(dialog).getByRole('button', { name: 'เพิ่มแถว' }))

    fireEvent.change(within(dialog).getAllByLabelText('ชื่อสินค้า')[1], {
      target: { value: 'Banana Cake' },
    })
    fireEvent.change(within(dialog).getAllByLabelText('Barcode')[1], {
      target: { value: '8851110000012' },
    })
    fireEvent.change(within(dialog).getAllByLabelText('SKU')[1], {
      target: { value: 'CAKE-BANANA' },
    })
    fireEvent.change(within(dialog).getAllByLabelText('หน่วย')[1], {
      target: { value: 'piece' },
    })
    fireEvent.change(within(dialog).getAllByLabelText('ต้นทุน')[1], {
      target: { value: '7.00' },
    })
    fireEvent.change(within(dialog).getAllByLabelText('ราคาขาย')[1], {
      target: { value: '12.00' },
    })

    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก 2 รายการ' }))

    await waitFor(() => {
      expect(mockedApiPost).toHaveBeenCalledTimes(2)
      expect(mockedApiPost).toHaveBeenNthCalledWith(1, '/products', {
        name: 'Apple Juice',
        barcode: '8851110000011',
        sku: 'JUICE-APPLE',
        unit: 'bottle',
        costPriceSatang: 1050,
        salePriceSatang: 1800,
        status: 'active',
      })
      expect(mockedApiPost).toHaveBeenNthCalledWith(2, '/products', {
        name: 'Banana Cake',
        barcode: '8851110000012',
        sku: 'CAKE-BANANA',
        unit: 'piece',
        costPriceSatang: 700,
        salePriceSatang: 1200,
        status: 'active',
      })
    })
    expect(screen.queryByRole('dialog', { name: 'เพิ่มสินค้าหลายรายการ' })).not.toBeInTheDocument()
    expect(screen.getByText('Apple Juice')).toBeInTheDocument()
    expect(screen.getByText('Banana Cake')).toBeInTheDocument()
  })
})
