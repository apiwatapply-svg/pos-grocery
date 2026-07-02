import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Swal from 'sweetalert2'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiDownload, apiGet, apiPatch, apiPost } from '../../lib/api/client'
import { saveSession, type Session } from '../../lib/auth/session'
import { compressImageFile } from '../../lib/images/imageCompression'
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

vi.mock('../../lib/images/imageCompression', async () => {
  const actual = await vi.importActual<typeof import('../../lib/images/imageCompression')>(
    '../../lib/images/imageCompression',
  )

  return {
    ...actual,
    compressImageFile: vi.fn(async (file: File) => ({
      dataUri: `data:image/webp;base64,compressed-${file.name}`,
      fileName: file.name.replace(/\.[^.]+$/, '.webp'),
      height: 800,
      width: 800,
    })),
  }
})

const mockedApiDownload = vi.mocked(apiDownload)
const mockedApiGet = vi.mocked(apiGet)
const mockedApiPatch = vi.mocked(apiPatch)
const mockedApiPost = vi.mocked(apiPost)
const mockedCompressImageFile = vi.mocked(compressImageFile)
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

const productHistoryResponse = {
  productId: 'sql-product-1',
  rows: [
    {
      date: '2026-06-27',
      quantity: 0,
      totalSalesSatang: 0,
      totalCostSatang: 0,
      profitSatang: 0,
      profitMarginPercent: 0,
    },
    {
      date: '2026-06-28',
      quantity: 3,
      totalSalesSatang: 1200,
      totalCostSatang: 369,
      profitSatang: 831,
      profitMarginPercent: 225.2,
    },
  ],
}

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
    expect(screen.getByRole('button', { name: 'แก้ไข SQL Product' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'แก้ไข SQL Product' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ประวัติขาย SQL Product' })).toBeInTheDocument()
    expect(
      screen.getByRole('row', { name: /1 SQL Product SQL Product SQL-001 box 1\.23 4\.56 270.7% 12\.5 ชิ้น 9 พร้อมขาย active แก้ไข ประวัติขาย ปิดขาย/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('row', { name: /2 ไม่มีรูป Filtered Product SQL-002 pack 10\.00 15\.00 50.0% 0 ชิ้น 0 หมดสต็อก inactive แก้ไข ประวัติขาย เปิดขาย/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('พร้อมขาย')).toBeInTheDocument()
    expect(screen.getByText('หมดสต็อก')).toBeInTheDocument()
  })

  it('summarizes product inventory value in clear top cards', async () => {
    renderPage(ownerSession)

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
    renderPage(ownerSession)

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

  it('edits products in a modal with existing data and image preview before uploading a new image', async () => {
    renderPage(ownerSession)
    expect(await screen.findByText('SQL Product')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'แก้ไข SQL Product' }))

    const dialog = screen.getByRole('dialog', { name: 'แก้ไขสินค้า SQL Product' })
    expect(within(dialog).getByDisplayValue('SQL Product')).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('SQL-001')).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('box')).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('1.23')).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('4.56')).toBeInTheDocument()
    expect(within(dialog).getByRole('img', { name: 'รูปเดิม SQL Product' })).toHaveAttribute(
      'src',
      'https://example.com/sql-product.jpg',
    )
    expect(within(dialog).getByText('กำไร 270.7%')).toBeInTheDocument()

    const newImage = new File(['new-image'], 'new-sql-product.png', { type: 'image/png' })
    fireEvent.change(within(dialog).getByLabelText('เปลี่ยนรูปสินค้า'), {
      target: { files: [newImage] },
    })

    await waitFor(() => {
      expect(within(dialog).getByRole('img', { name: 'รูปใหม่ SQL Product' })).toHaveAttribute(
        'src',
        'data:image/webp;base64,compressed-new-sql-product.png',
      )
    })
    expect(within(dialog).getByText('new-sql-product.webp')).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText('ชื่อสินค้า'), {
      target: { value: 'Updated SQL Product' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึกการแก้ไข' }))

    await waitFor(() => {
      expect(mockedApiPatch).toHaveBeenCalledWith('/products/sql-product-1', {
        name: 'Updated SQL Product',
        barcode: 'SQL-001',
        unit: 'box',
        costPriceSatang: 123,
        salePriceSatang: 456,
        status: 'active',
      })
      expect(mockedApiPost).toHaveBeenCalledWith('/products/sql-product-1/images', {
        fileName: 'new-sql-product.webp',
        dataUri: 'data:image/webp;base64,compressed-new-sql-product.png',
        altText: 'Updated SQL Product',
      })
    })
    expect(mockedCompressImageFile).toHaveBeenCalledWith(
      newImage,
      expect.objectContaining({ maxHeight: 800, maxWidth: 800, mimeType: 'image/webp', quality: 0.78 }),
    )
    expect(screen.queryByRole('dialog', { name: 'แก้ไขสินค้า SQL Product' })).not.toBeInTheDocument()
    expect(screen.getByText('Updated SQL Product')).toBeInTheDocument()
  })

  it('toggles products between active and inactive through the backend after confirmation', async () => {
    renderPage(ownerSession)
    expect(await screen.findByText('SQL Product')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'ปิดขาย SQL Product' }))

    await waitFor(() => {
      expect(mockedSwal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          confirmButtonText: 'ปิดขาย',
          icon: 'warning',
          showCancelButton: true,
          title: 'ยืนยันปิดขายสินค้า',
        }),
      )
      expect(mockedApiPatch).toHaveBeenCalledWith('/products/sql-product-1', { status: 'inactive' })
    })

    expect(
      screen.getByRole('row', { name: /SQL Product SQL-001 box 1\.23 4\.56 270.7% 12\.5 ชิ้น 9 พร้อมขาย inactive แก้ไข ประวัติขาย เปิดขาย/ }),
    ).toBeInTheDocument()

    mockedApiPatch.mockResolvedValueOnce({
      ...apiProducts[0],
      status: 'active',
    })
    fireEvent.click(screen.getByRole('button', { name: 'เปิดขาย SQL Product' }))

    await waitFor(() => {
      expect(mockedApiPatch).toHaveBeenLastCalledWith('/products/sql-product-1', { status: 'active' })
      expect(
        screen.getByRole('row', { name: /SQL Product SQL-001 box 1\.23 4\.56 270.7% 12\.5 ชิ้น 9 พร้อมขาย active แก้ไข ประวัติขาย ปิดขาย/ }),
      ).toBeInTheDocument()
    })
  })

  it('sorts the product table by stock quantity in both directions', async () => {
    renderPage(ownerSession)
    expect(await screen.findByText('SQL Product')).toBeInTheDocument()

    const stockHeader = screen.getByRole('columnheader', { name: /คงเหลือ/ })
    fireEvent.click(within(stockHeader).getByRole('button', { name: 'เรียงตามคงเหลือ' }))

    expect(stockHeader).toHaveAttribute('aria-sort', 'ascending')
    expect(localStorage.getItem('pos-grocery:product-table-sort')).toBe(
      JSON.stringify({ key: 'stockQuantity', direction: 'ascending' }),
    )
    expect(
      screen.getByRole('row', { name: /1 ไม่มีรูป Filtered Product SQL-002 pack 10\.00 15\.00 50.0% 0 ชิ้น 0 หมดสต็อก inactive แก้ไข ประวัติขาย เปิดขาย/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('row', { name: /2 SQL Product SQL Product SQL-001 box 1\.23 4\.56 270.7% 12\.5 ชิ้น 9 พร้อมขาย active แก้ไข ประวัติขาย ปิดขาย/ }),
    ).toBeInTheDocument()

    fireEvent.click(within(stockHeader).getByRole('button', { name: 'คงเหลือ เรียงจากน้อยไปมาก' }))

    expect(stockHeader).toHaveAttribute('aria-sort', 'descending')
    expect(localStorage.getItem('pos-grocery:product-table-sort')).toBe(
      JSON.stringify({ key: 'stockQuantity', direction: 'descending' }),
    )
    expect(
      screen.getByRole('row', { name: /1 SQL Product SQL Product SQL-001 box 1\.23 4\.56 270.7% 12\.5 ชิ้น 9 พร้อมขาย active แก้ไข ประวัติขาย ปิดขาย/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('row', { name: /2 ไม่มีรูป Filtered Product SQL-002 pack 10\.00 15\.00 50.0% 0 ชิ้น 0 หมดสต็อก inactive แก้ไข ประวัติขาย เปิดขาย/ }),
    ).toBeInTheDocument()
  })

  it('restores the saved product table sort from localStorage', async () => {
    localStorage.setItem(
      'pos-grocery:product-table-sort',
      JSON.stringify({ key: 'stockQuantity', direction: 'ascending' }),
    )
    renderPage(ownerSession)
    expect(await screen.findByText('SQL Product')).toBeInTheDocument()

    const stockHeader = screen.getByRole('columnheader', { name: /คงเหลือ/ })
    expect(stockHeader).toHaveAttribute('aria-sort', 'ascending')
    expect(
      screen.getByRole('row', { name: /1 ไม่มีรูป Filtered Product SQL-002 pack 10\.00 15\.00 50.0% 0 ชิ้น 0 หมดสต็อก inactive แก้ไข ประวัติขาย เปิดขาย/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('row', { name: /2 SQL Product SQL Product SQL-001 box 1\.23 4\.56 270.7% 12\.5 ชิ้น 9 พร้อมขาย active แก้ไข ประวัติขาย ปิดขาย/ }),
    ).toBeInTheDocument()
  })

  it('opens product sales history in a modal with saved date filters and product navigation', async () => {
    localStorage.setItem(
      'pos-grocery:product-sales-history-filter',
      JSON.stringify({ from: '2026-06-27', to: '2026-06-28' }),
    )
    mockedApiGet.mockImplementation(async (path) => {
      if (String(path).startsWith('/reports/products/sql-product-1/sales-history')) {
        return productHistoryResponse
      }

      if (String(path).startsWith('/reports/products/sql-product-2/sales-history')) {
        return { productId: 'sql-product-2', rows: [] }
      }

      return apiProducts
    })

    renderPage(ownerSession)
    expect(await screen.findByText('SQL Product')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'ประวัติขาย SQL Product' }))

    const dialog = await screen.findByRole('dialog', { name: 'ประวัติการขาย SQL Product' })
    expect(within(dialog).getByLabelText('วันที่เริ่มต้น')).toHaveValue('2026-06-27')
    expect(within(dialog).getByLabelText('วันที่สิ้นสุด')).toHaveValue('2026-06-28')
    expect(within(dialog).getByText('ยอดขายรายวัน')).toBeInTheDocument()
    expect(within(dialog).getByText('ค่าเฉลี่ย EMA')).toBeInTheDocument()
    const historyLayout = within(dialog).getByText('กราฟยอดขายรายวัน').closest('.product-history-main-layout')
    expect(historyLayout?.children[0]).toHaveClass('product-history-chart-panel')
    expect(historyLayout?.children[1]).toHaveClass('product-history-data-panel')
    const chartTooltipTrigger = within(dialog).getByRole('button', {
      name: 'ดูรายละเอียดวันที่ 2026-06-28 ยอดขาย 12.00 บาท 3 ชิ้น ค่าเฉลี่ย EMA 4.20 บาท',
    })
    fireEvent.focus(chartTooltipTrigger)
    expect(within(dialog).getByRole('tooltip', {
      name: '2026-06-28 ยอดขาย 12.00 บาท 3 ชิ้น ค่าเฉลี่ย EMA 4.20 บาท',
    })).toBeInTheDocument()
    expect(
      within(dialog).getByRole('row', {
        name: /2026-06-28 3 ชิ้น 12\.00 บาท 3\.69 บาท 8\.31 บาท 225\.20% 4\.20 บาท/,
      }),
    ).toBeInTheDocument()
    expect(mockedApiGet).toHaveBeenCalledWith(
      '/reports/products/sql-product-1/sales-history?from=2026-06-27T00%3A00%3A00.000Z&to=2026-06-28T23%3A59%3A59.999Z',
    )

    fireEvent.change(within(dialog).getByLabelText('วันที่สิ้นสุด'), {
      target: { value: '2026-06-29' },
    })

    await waitFor(() => {
      expect(localStorage.getItem('pos-grocery:product-sales-history-filter')).toBe(
        JSON.stringify({ from: '2026-06-27', to: '2026-06-29' }),
      )
    })

    fireEvent.click(within(dialog).getByRole('button', { name: 'สินค้าถัดไป' }))

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'ประวัติการขาย Filtered Product' })).toBeInTheDocument()
    })
    expect(mockedApiGet).toHaveBeenCalledWith(
      '/reports/products/sql-product-2/sales-history?from=2026-06-27T00%3A00%3A00.000Z&to=2026-06-29T23%3A59%3A59.999Z',
    )
  })

  it('exports inventory Excel through the authenticated API client', async () => {
    renderPage(ownerSession)
    expect(await screen.findByText('SQL Product')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Export Excel' }))

    await waitFor(() => {
      expect(mockedApiDownload).toHaveBeenCalledWith('/inventory/export.xlsx', 'inventory.xlsx')
    })
  })

  it('filters the combined product table from a searchable dropdown input', async () => {
    renderPage(ownerSession)
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
    const filterOptions = Array.from(document.querySelectorAll('#product-filter-options option'))
    expect(filterOptions.map((option) => [option.getAttribute('value'), option.textContent])).toEqual([
      ['SQL Product', 'SQL Product - SQL-001'],
      ['Filtered Product', 'Filtered Product - SQL-002'],
    ])
    expect(filterOptions.some((option) => option.textContent?.includes('SKU'))).toBe(false)

    fireEvent.change(screen.getByLabelText('ค้นหา/กรองสินค้า'), {
      target: { value: 'SQL-002' },
    })

    expect(screen.queryByText('SQL Product')).not.toBeInTheDocument()
    expect(screen.getByText('Filtered Product')).toBeInTheDocument()
    expect(screen.getByText('SQL-002')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'ล้างตัวกรอง' }))
    expect(filterInput).toHaveFocus()
  })

  it('shows long product and inventory tables without pagination', async () => {
    mockedApiGet.mockResolvedValueOnce(manyApiProducts)
    renderPage(ownerSession)

    expect(await screen.findByText('SQL Product 1')).toBeInTheDocument()
    expect(screen.getByText('SQL Product 10')).toBeInTheDocument()
    expect(screen.getByText('SQL Product 11')).toBeInTheDocument()
    expect(screen.getByText('SQL Product 12')).toBeInTheDocument()
    expect(screen.queryByText('แสดง 1-10 จาก 12 รายการ')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'หน้าถัดไป' })).not.toBeInTheDocument()
  })

  it('creates multiple products from one modal instead of navigating to a new page', async () => {
    renderPage(ownerSession)
    expect(await screen.findByText('SQL Product')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มสินค้า' }))
    const dialog = screen.getByRole('dialog', { name: 'เพิ่มสินค้าหลายรายการ' })
    const appleImage = new File(['apple-image'], 'apple-juice.png', { type: 'image/png' })

    expect(within(dialog).queryByText('เลือกรูปสินค้า')).not.toBeInTheDocument()

    fireEvent.change(within(dialog).getAllByLabelText('ชื่อสินค้า')[0], {
      target: { value: 'Apple Juice' },
    })
    fireEvent.change(within(dialog).getAllByLabelText('รูปสินค้า')[0], {
      target: { files: [appleImage] },
    })
    fireEvent.change(within(dialog).getAllByLabelText('Barcode')[0], {
      target: { value: '8851110000011' },
    })
    expect(within(dialog).queryByLabelText('SKU')).not.toBeInTheDocument()
    fireEvent.change(within(dialog).getAllByLabelText('หน่วย')[0], {
      target: { value: 'bottle' },
    })
    fireEvent.change(within(dialog).getAllByLabelText('ต้นทุน')[0], {
      target: { value: '10.50' },
    })
    fireEvent.change(within(dialog).getAllByLabelText('ราคาขาย')[0], {
      target: { value: '18.00' },
    })
    expect(within(dialog).getByText('กำไร 71.4%')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'เพิ่มแถว' }))

    fireEvent.change(within(dialog).getAllByLabelText('ชื่อสินค้า')[1], {
      target: { value: 'Banana Cake' },
    })
    fireEvent.change(within(dialog).getAllByLabelText('Barcode')[1], {
      target: { value: '8851110000012' },
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
      expect(mockedApiPost).toHaveBeenCalledTimes(3)
      expect(mockedApiPost).toHaveBeenNthCalledWith(1, '/products', {
        name: 'Apple Juice',
        barcode: '8851110000011',
        unit: 'bottle',
        costPriceSatang: 1050,
        salePriceSatang: 1800,
        status: 'active',
      })
      expect(mockedApiPost).toHaveBeenNthCalledWith(2, '/products', {
        name: 'Banana Cake',
        barcode: '8851110000012',
        unit: 'piece',
        costPriceSatang: 700,
        salePriceSatang: 1200,
        status: 'active',
      })
      expect(mockedApiPost).toHaveBeenCalledWith('/products/created-8851110000011/images', {
        fileName: 'apple-juice.webp',
        dataUri: 'data:image/webp;base64,compressed-apple-juice.png',
        altText: 'Apple Juice',
      })
    })
    expect(mockedCompressImageFile).toHaveBeenCalledWith(
      appleImage,
      expect.objectContaining({ maxHeight: 800, maxWidth: 800, mimeType: 'image/webp', quality: 0.78 }),
    )
    expect(screen.queryByRole('dialog', { name: 'เพิ่มสินค้าหลายรายการ' })).not.toBeInTheDocument()
    expect(screen.getByText('Apple Juice')).toBeInTheDocument()
    expect(screen.getByText('Banana Cake')).toBeInTheDocument()
  })
})
