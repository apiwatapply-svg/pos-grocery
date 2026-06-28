import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { saveSession, type Session } from '../../lib/auth/session'
import { ProductListPage } from './ProductListPage'

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

afterEach(() => {
  localStorage.clear()
})

describe('ProductListPage', () => {
  it('shows the create product action for owners', () => {
    renderPage(ownerSession)

    expect(screen.getByRole('link', { name: 'เพิ่มสินค้า' })).toBeInTheDocument()
  })

  it('hides the create product action for stock users', () => {
    renderPage(stockSession)

    expect(screen.queryByRole('link', { name: 'เพิ่มสินค้า' })).not.toBeInTheDocument()
  })
})
