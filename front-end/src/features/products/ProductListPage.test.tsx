import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Swal from 'sweetalert2'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiDownload, apiGet, apiPatch, apiPost } from '../../lib/api/client'
import { saveSession, type Session } from '../../lib/auth/session'
import { ProductListPage } from './ProductListPage'

vi.mock('../../lib/api/client', () => ({
  apiDownload: vi.fn(),
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
}))

vi.mock('sweetalert2', () => ({
  default: {
    fire: vi.fn(),
  },
}))

const mockedApiDownload = vi.mocked(apiDownload)
const mockedApiGet = vi.mocked(apiGet)
const mockedApiPatch = vi.mocked(apiPatch)
const mockedApiPost = vi.mocked(apiPost)
const mockedSwal = vi.mocked(Swal)

const apiProducts = [
  {
    id: 'sql-product-1',
    name: 'SQL Product',
    barcode: 'SQL-001',
    unit: 'box',
    images: [{ thumbnailUrl: 'https://example.com/sql-product.jpg' }],
    costPriceSatang: 123,
    salePriceSatang: 456,
    stockQuantity: 9,
    minimumStockQuantity: 10,
    status: 'active',
    averageMonthlySalesQuantity: 12.5,
  },
  {
    id: 'sql-product-2',
    name: 'Filtered Product',
    barcode: 'SQL-002',
    unit: 'pack',
    images: [],
    costPriceSatang: 1000,
    salePriceSatang: 1500,
    stockQuantity: 0,
    minimumStockQuantity: 5,
    status: 'inactive',
    averageMonthlySalesQuantity: 0,
  },
]

const manyApiProducts = Array.from({ length: 12 }, (_, index) => ({
  id: `sql-product-${index + 1}`,
  name: `SQL Product ${index + 1}`,
  barcode: `SQL-${String(index + 1).padStart(3, '0')}`,
  unit: 'box',
  images: [],
  costPriceSatang: 100,
  salePriceSatang: 200,
  stockQuantity: index + 1,
  minimumStockQuantity: 3,
  status: 'active',
}))

const superAdminSession: Session = {
  token: 'token-super-admin',
  user: {
    id: 'super-admin-1',
    username: 'admin',
    displayName: 'Admin',
    role: 'super_admin',
  },
}

const storeAdminSession: Session = {
  ...superAdminSession,
  user: { ...superAdminSession.user, id: 'store-admin-1', role: 'store_admin' },
}

const cashierSession: Session = {
  token: 'token-cashier',
  user: {
    id: 'cashier-1',
    username: 'cashier',
    displayName: 'Cashier One',
    role: 'cashier',
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
  mockedSwal.fire.mockResolvedValue({ isConfirmed: true, isDenied: false, isDismissed: false })
  mockedApiPatch.mockImplementation(async (_path, body) => ({
    ...apiProducts[0],
    ...(body as object),
  }))
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
  it('hides every product management action for super_admin', async () => {
    renderPage(superAdminSession)

    expect(await screen.findByText('SQL Product')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'เพิ่มสินค้า' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'แก้ไข SQL Product' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ปิดขาย SQL Product' })).not.toBeInTheDocument()
  })

  it('shows product management actions for store_admin', async () => {
    renderPage(storeAdminSession)

    expect(await screen.findByText('SQL Product')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'เพิ่มสินค้า' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'แก้ไข SQL Product' })).toBeInTheDocument()
  })

  it('also keeps product management actions hidden for cashier sessions', async () => {
    renderPage(cashierSession)

    expect(await screen.findByText('SQL Product')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'เพิ่มสินค้า' })).not.toBeInTheDocument()
  })

  it('loads products from the backend instead of rendering hardcoded products', async () => {
    renderPage(superAdminSession)

    expect(screen.queryByText('Drinking Water')).not.toBeInTheDocument()
    expect(await screen.findByText('SQL Product')).toBeInTheDocument()
    expect(screen.getByText('SQL-001')).toBeInTheDocument()
  })

  it('shows product and inventory data in one complete table', async () => {
    renderPage(superAdminSession)

    expect(await screen.findByText('SQL Product')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'อันดับ' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'No' })).not.toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'รูป' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'SKU' })).not.toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'หน่วย' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'กำไร %' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'ยอดขายเฉลี่ย/เดือน' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'คงเหลือ' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'สถานะสต็อก' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'สถานะสินค้า' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'จัดการ' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'SQL Product' })).toBeInTheDocument()
    expect(screen.queryByText('SQL-SKU')).not.toBeInTheDocument()
    expect(screen.getByText('box')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'แก้ไข SQL Product' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ประวัติขาย SQL Product' })).not.toBeInTheDocument()
    expect(
      screen.getByRole('row', { name: /1 SQL Product SQL Product SQL-001 box 1\.23 4\.56 270\.7% 12\.5 ชิ้น 9 พร้อมขาย active -/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('row', { name: /2 ไม่มีรูป Filtered Product SQL-002 pack 10\.00 15\.00 50\.0% 0 ชิ้น 0 หมดสต็อก inactive -/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('พร้อมขาย')).toBeInTheDocument()
    expect(screen.getByText('หมดสต็อก')).toBeInTheDocument()
  })

  it('summarizes product inventory value in clear top cards', async () => {
    renderPage(superAdminSession)

    expect(await screen.findByText('SQL Product')).toBeInTheDocument()
    expect(screen.getByText('จำนวนรายการสินค้าทั้งหมด')).toBeInTheDocument()
    expect(screen.getByText('2 รายการ')).toBeInTheDocument()
    expect(screen.getByText('จำนวนชิ้นสินค้าทั้งหมด')).toBeInTheDocument()
    expect(screen.getByText('9 ชิ้น')).toBeInTheDocument()
    expect(screen.getByText('ต้นทุนคงคลังทั้งหมด')).toBeInTheDocument()
    expect(screen.getByText('11.07 บาท')).toBeInTheDocument()
    expect(screen.getByText('ราคาที่คาดว่าจะขายได้')).toBeInTheDocument()
    expect(screen.getByText('41.04 บาท')).toBeInTheDocument()
    expect(screen.getByText('กำไรที่คาดว่าจะได้')).toBeInTheDocument()
    expect(screen.getByText('29.97 บาท')).toBeInTheDocument()
    const inventorySummary = screen.getByLabelText('สรุปสินค้าคงคลัง')
    expect(within(inventorySummary).getByText('กำไรที่คาดว่าจะได้ %')).toBeInTheDocument()
    expect(within(inventorySummary).getByText('270.7%')).toBeInTheDocument()
    expect(within(inventorySummary).getByText('สินค้าเหลือต่ำกว่า 5 ชิ้น')).toBeInTheDocument()
    expect(within(inventorySummary).getByText('1 รายการ')).toBeInTheDocument()
  })

  it('opens a modal listing products with stock lower than 5 items', async () => {
    renderPage(superAdminSession)

    expect(await screen.findByText('SQL Product')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /สินค้าเหลือต่ำกว่า 5 ชิ้น/ }))

    const dialog = screen.getByRole('dialog', { name: 'สินค้าเหลือต่ำกว่า 5 ชิ้น' })
    expect(within(dialog).getByRole('columnheader', { name: 'สินค้า' })).toBeInTheDocument()
    expect(within(dialog).getByRole('columnheader', { name: 'Barcode' })).toBeInTheDocument()
    expect(within(dialog).getByRole('columnheader', { name: 'หน่วย' })).toBeInTheDocument()
    expect(within(dialog).getByRole('columnheader', { name: 'คงเหลือ' })).toBeInTheDocument()
    expect(within(dialog).getByRole('columnheader', { name: 'สถานะสต็อก' })).toBeInTheDocument()
    expect(
      within(dialog).getByRole('row', { name: /Filtered Product SQL-002 pack 0 ชิ้น หมดสต็อก/ }),
    ).toBeInTheDocument()
    expect(within(dialog).queryByText('SQL Product')).not.toBeInTheDocument()
  })

  it('applies color class to stock status pill based on stock level', async () => {
    // product out (stock=0), low (stock=3), ok (stock=9)
    mockedApiGet.mockImplementation(async (path: string) => {
      if (path.startsWith('/products')) {
        return [
          {
            id: 'product-out',
            name: 'Out Of Stock Item',
            barcode: 'OUT-001',
            unit: 'box',
            images: [],
            costPriceSatang: 100,
            salePriceSatang: 200,
            stockQuantity: 0,
            minimumStockQuantity: 5,
            status: 'active',
            averageMonthlySalesQuantity: 0,
          },
          {
            id: 'product-low',
            name: 'Low Stock Item',
            barcode: 'LOW-001',
            unit: 'pack',
            images: [],
            costPriceSatang: 100,
            salePriceSatang: 200,
            stockQuantity: 3,
            minimumStockQuantity: 5,
            status: 'active',
            averageMonthlySalesQuantity: 0,
          },
          {
            id: 'product-ok',
            name: 'OK Stock Item',
            barcode: 'OK-001',
            unit: 'box',
            images: [],
            costPriceSatang: 100,
            salePriceSatang: 200,
            stockQuantity: 50,
            minimumStockQuantity: 5,
            status: 'active',
            averageMonthlySalesQuantity: 0,
          },
        ]
      }
      throw new Error(`Unexpected GET ${path}`)
    })

    renderPage(superAdminSession)
    expect(await screen.findByText('Out Of Stock Item')).toBeInTheDocument()

    const outPill = screen.getByText('หมดสต็อก').closest('.stock-status-pill')
    const lowPill = screen.getByText('เหลือน้อย').closest('.stock-status-pill')
    const okPill = screen.getByText('พร้อมขาย').closest('.stock-status-pill')

    expect(outPill).toHaveClass('stock-status-pill-out')
    expect(lowPill).toHaveClass('stock-status-pill-low')
    expect(okPill).toHaveClass('stock-status-pill-ok')
  })

  it('sorts the product table by stock status with out first, then low, then ok', async () => {
    mockedApiGet.mockImplementation(async (path: string) => {
      if (path.startsWith('/products')) {
        return [
          { ...apiProducts[0], id: 'ok-1', name: 'OK Product', stockQuantity: 20 },
          { ...apiProducts[1], id: 'low-1', name: 'Low Product', stockQuantity: 3, minimumStockQuantity: 5 },
          { ...apiProducts[1], id: 'out-1', name: 'Out Product', stockQuantity: 0, minimumStockQuantity: 5 },
        ]
      }
      throw new Error(`Unexpected GET ${path}`)
    })

    renderPage(superAdminSession)
    expect(await screen.findByText('OK Product')).toBeInTheDocument()

    // เปิด sort menu บนคอลัมน์ "สถานะสต็อก" แล้วกด ascending
    const stockStatusHeader = screen.getByRole('columnheader', { name: /สถานะสต็อก/ })
    fireEvent.click(within(stockStatusHeader).getByRole('button', { name: /สถานะสต็อก · เรียงลำดับ/ }))

    const productColumn = screen.getByRole('columnheader', { name: 'สินค้า' })
    const productColumnParent = productColumn.closest('table')!
    const rows = within(productColumnParent).getAllByRole('row')
    // ข้าม header row แล้วอ่านชื่อสินค้า
    const dataRowNames = rows.slice(1).map((row) => within(row).getAllByRole('cell')[2].textContent)
    expect(dataRowNames).toEqual(['Out Product', 'Low Product', 'OK Product'])
  })

  it('sorts the product table by stock quantity in both directions', async () => {
    renderPage(superAdminSession)
    expect(await screen.findByText('SQL Product')).toBeInTheDocument()

    const stockHeader = screen.getByRole('columnheader', { name: /คงเหลือ/ })
    fireEvent.click(within(stockHeader).getByRole('button', { name: /คงเหลือ · เรียงลำดับ/ }))

    expect(stockHeader).toHaveAttribute('aria-sort', 'ascending')
    expect(localStorage.getItem('pos-grocery:product-table-sort')).toBe(
      JSON.stringify({ key: 'stockQuantity', direction: 'ascending' }),
    )
    expect(
      screen.getByRole('row', { name: /1 ไม่มีรูป Filtered Product SQL-002 pack 10\.00 15\.00 50\.0% 0 ชิ้น 0 หมดสต็อก inactive -/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('row', { name: /2 SQL Product SQL Product SQL-001 box 1\.23 4\.56 270\.7% 12\.5 ชิ้น 9 พร้อมขาย active -/ }),
    ).toBeInTheDocument()

    fireEvent.click(within(stockHeader).getByRole('button', { name: /คงเหลือ · เรียงจากน้อยไปมาก/ }))

    expect(stockHeader).toHaveAttribute('aria-sort', 'descending')
    expect(localStorage.getItem('pos-grocery:product-table-sort')).toBe(
      JSON.stringify({ key: 'stockQuantity', direction: 'descending' }),
    )
    expect(
      screen.getByRole('row', { name: /1 SQL Product SQL Product SQL-001 box 1\.23 4\.56 270\.7% 12\.5 ชิ้น 9 พร้อมขาย active -/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('row', { name: /2 ไม่มีรูป Filtered Product SQL-002 pack 10\.00 15\.00 50\.0% 0 ชิ้น 0 หมดสต็อก inactive -/ }),
    ).toBeInTheDocument()
  })

  it('restores the saved product table sort from localStorage', async () => {
    localStorage.setItem(
      'pos-grocery:product-table-sort',
      JSON.stringify({ key: 'stockQuantity', direction: 'ascending' }),
    )
    renderPage(superAdminSession)
    expect(await screen.findByText('SQL Product')).toBeInTheDocument()

    const stockHeader = screen.getByRole('columnheader', { name: /คงเหลือ/ })
    expect(stockHeader).toHaveAttribute('aria-sort', 'ascending')
    expect(
      screen.getByRole('row', { name: /1 ไม่มีรูป Filtered Product SQL-002 pack 10\.00 15\.00 50\.0% 0 ชิ้น 0 หมดสต็อก inactive -/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('row', { name: /2 SQL Product SQL Product SQL-001 box 1\.23 4\.56 270\.7% 12\.5 ชิ้น 9 พร้อมขาย active -/ }),
    ).toBeInTheDocument()
  })

  it('keeps the product sales history action hidden in the locked-down UI', async () => {
    renderPage(superAdminSession)
    expect(await screen.findByText('SQL Product')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ประวัติขาย SQL Product' })).not.toBeInTheDocument()
  })

  it('exports inventory Excel through the authenticated API client', async () => {
    renderPage(superAdminSession)
    expect(await screen.findByText('SQL Product')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Export Excel' }))

    await waitFor(() => {
      expect(mockedApiDownload).toHaveBeenCalledWith('/inventory/export.xlsx', 'inventory.xlsx')
    })
  })

  it('filters the combined product table from a searchable dropdown input', async () => {
    renderPage(superAdminSession)
    expect(await screen.findByText('SQL Product')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'ล้างตัวกรอง' })).toHaveClass(
      'product-filter-clear',
      'product-filter-clear-centered',
    )

    expect(screen.getByLabelText('ค้นหา/กรองสินค้า')).toHaveAttribute(
      'placeholder',
      'พิมพ์ชื่อสินค้า, barcode, สถานะ active/inactive',
    )
    const filterInput = screen.getByLabelText('ค้นหา/กรองสินค้า')
    expect(filterInput).toHaveFocus()

    // Open the dropdown to inspect the available suggestions.
    fireEvent.focus(filterInput)
    fireEvent.change(filterInput, { target: { value: 'SQL' } })
    const listbox = await screen.findByRole('listbox')
    const filterOptions = Array.from(within(listbox).getAllByRole('option'))
    expect(filterOptions).toHaveLength(2)
    expect(filterOptions[0]).toHaveAttribute('data-option-index', '0')
    expect(filterOptions[0]).toHaveTextContent('SQL Product')
    expect(filterOptions[0]).toHaveTextContent('SQL-001')
    expect(filterOptions[0]).toHaveTextContent('สถานะ active')
    expect(filterOptions[1]).toHaveAttribute('data-option-index', '1')
    expect(filterOptions[1]).toHaveTextContent('Filtered Product')
    expect(filterOptions[1]).toHaveTextContent('SQL-002')
    expect(filterOptions.some((option) => option.textContent?.includes('SKU'))).toBe(false)

    fireEvent.change(filterInput, { target: { value: 'SQL-002' } })

    // The search input may still have a matching option in the dropdown,
    // so look inside the product table specifically.
    const productTable = screen.getByRole('table')
    expect(within(productTable).queryByText('SQL Product')).not.toBeInTheDocument()
    expect(within(productTable).getByText('Filtered Product')).toBeInTheDocument()
    expect(within(productTable).getByText('SQL-002')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'ล้างตัวกรอง' }))
    expect(filterInput).toHaveFocus()
  })

  it('shows long product and inventory tables without pagination', async () => {
    mockedApiGet.mockResolvedValueOnce(manyApiProducts)
    renderPage(superAdminSession)

    expect(await screen.findByText('SQL Product 1')).toBeInTheDocument()
    expect(screen.getByText('SQL Product 10')).toBeInTheDocument()
    expect(screen.getByText('SQL Product 11')).toBeInTheDocument()
    expect(screen.getByText('SQL Product 12')).toBeInTheDocument()
    expect(screen.queryByText('แสดง 1-10 จาก 12 รายการ')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'หน้าถัดไป' })).not.toBeInTheDocument()
  })
})
