import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiGet, apiPatch, apiPost } from '../../lib/api/client'
import { compressImageFile } from '../../lib/images/imageCompression'
import { ProductFormPage } from './ProductFormPage'

vi.mock('../../lib/api/client', () => ({
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
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

const mockedApiGet = vi.mocked(apiGet)
const mockedApiPatch = vi.mocked(apiPatch)
const mockedApiPost = vi.mocked(apiPost)
const mockedCompressImageFile = vi.mocked(compressImageFile)

const sqlProducts = [
  {
    id: 'sql-product-1',
    name: 'SQL Product',
    barcode: 'SQL-001',
    unit: 'pack',
    costPriceSatang: 1200,
    salePriceSatang: 1800,
    status: 'active',
  },
]

beforeEach(() => {
  mockedApiGet.mockResolvedValue(sqlProducts)
  mockedApiPost.mockResolvedValue({ ...sqlProducts[0], id: 'new-product', name: 'New SQL Product' })
  mockedApiPatch.mockResolvedValue({ ...sqlProducts[0], name: 'Updated SQL Product' })
})

afterEach(() => {
  vi.clearAllMocks()
})

function renderRoute(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/products/new" element={<ProductFormPage />} />
        <Route path="/products/:productId/edit" element={<ProductFormPage />} />
        <Route path="/products" element={<div>Product list</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProductFormPage', () => {
  it('creates a product through the backend', async () => {
    renderRoute('/products/new')

    fireEvent.change(screen.getByPlaceholderText('ชื่อสินค้า'), { target: { value: 'New SQL Product' } })
    fireEvent.change(screen.getByPlaceholderText('barcode'), { target: { value: 'SQL-NEW-001' } })
    expect(screen.queryByPlaceholderText('SKU')).not.toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('หน่วย'), { target: { value: 'pack' } })
    fireEvent.change(screen.getByPlaceholderText('ต้นทุน'), { target: { value: '12.50' } })
    fireEvent.change(screen.getByPlaceholderText('ราคาขาย'), { target: { value: '19.75' } })
    const productImage = new File(['new-product-image'], 'new-product.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Upload รูปสินค้าไป Cloudinary'), {
      target: { files: [productImage] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มสินค้า' }))

    await waitFor(() => {
      expect(mockedApiPost).toHaveBeenCalledWith('/products', {
        name: 'New SQL Product',
        barcode: 'SQL-NEW-001',
        unit: 'pack',
        costPriceSatang: 1250,
        salePriceSatang: 1975,
        status: 'active',
      })
      expect(mockedApiPost).toHaveBeenCalledWith('/products/new-product/images', {
        fileName: 'new-product.webp',
        dataUri: 'data:image/webp;base64,compressed-new-product.png',
        altText: 'New SQL Product',
      })
    })
    expect(mockedCompressImageFile).toHaveBeenCalledWith(
      productImage,
      expect.objectContaining({ maxHeight: 800, maxWidth: 800, mimeType: 'image/webp', quality: 0.78 }),
    )
    expect(await screen.findByText('Product list')).toBeInTheDocument()
  })

  it('loads SQL product data for editing and patches changes through the backend', async () => {
    renderRoute('/products/sql-product-1/edit')

    expect(await screen.findByDisplayValue('SQL Product')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('ชื่อสินค้า'), { target: { value: 'Updated SQL Product' } })
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกสินค้า' }))

    await waitFor(() => {
      expect(mockedApiGet).toHaveBeenCalledWith('/products')
      expect(mockedApiPatch).toHaveBeenCalledWith('/products/sql-product-1', expect.objectContaining({
        name: 'Updated SQL Product',
        costPriceSatang: 1200,
        salePriceSatang: 1800,
      }))
    })
  })
})
