import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiGet } from '../../lib/api/client'
import { saveSession, type Session } from '../../lib/auth/session'
import { ProductListPage } from './ProductListPage'

vi.mock('../../lib/api/client', () => ({
  apiGet: vi.fn(),
}))

const mockedApiGet = vi.mocked(apiGet)

const apiProducts = [
  {
    id: 'sql-product-1',
    name: 'SQL Product',
    barcode: 'SQL-001',
    sku: 'SQL-SKU',
    costPriceSatang: 123,
    salePriceSatang: 456,
    stockQuantity: 9,
    status: 'active',
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
})

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('ProductListPage', () => {
  it('shows the create product action for owners', async () => {
    renderPage(ownerSession)

    expect(screen.getByRole('link', { name: 'เพิ่มสินค้า' })).toBeInTheDocument()
    expect(await screen.findByText('SQL Product')).toBeInTheDocument()
  })

  it('hides the create product action for stock users', async () => {
    renderPage(stockSession)

    expect(screen.queryByRole('link', { name: 'เพิ่มสินค้า' })).not.toBeInTheDocument()
    expect(await screen.findByText('SQL Product')).toBeInTheDocument()
  })

  it('loads products from the backend instead of rendering hardcoded products', async () => {
    renderPage(ownerSession)

    expect(screen.queryByText('Drinking Water')).not.toBeInTheDocument()
    expect(await screen.findByText('SQL Product')).toBeInTheDocument()
    expect(screen.getByText('SQL-001')).toBeInTheDocument()
  })
})
