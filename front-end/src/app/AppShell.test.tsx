import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { saveSession, type Session } from '../lib/auth/session'
import { AppShell } from './AppShell'

const cashierSession: Session = {
  token: 'token-cashier',
  user: {
    id: 'cashier-1',
    username: 'cashier',
    displayName: 'Cashier One',
    role: 'cashier',
  },
}

afterEach(() => {
  localStorage.clear()
})

function renderShell(session = cashierSession) {
  saveSession(session)
  render(
    <MemoryRouter>
      <AppShell>
        <h1>Page Content</h1>
      </AppShell>
    </MemoryRouter>,
  )
}

describe('AppShell', () => {
  it('shows only sidebar links allowed for the current role', () => {
    renderShell()

    expect(screen.getByRole('link', { name: 'ขายสินค้า' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'จอลูกค้า' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ใบเสร็จ' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'รายงานยอดขาย' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'ผู้ใช้ระบบ' })).not.toBeInTheDocument()
  })

  it('shows store name, user name, role, POS shortcut, logout, and page content', () => {
    renderShell()

    expect(screen.getAllByText('POS Grocery').length).toBeGreaterThan(0)
    expect(screen.getByText('Cashier One')).toBeInTheDocument()
    expect(screen.getByText('cashier')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ไปหน้า POS' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Page Content' })).toBeInTheDocument()
  })

  it('toggles the mobile sidebar', () => {
    renderShell()

    const navigation = screen.getByRole('navigation', { name: 'เมนูหลัก' })
    expect(navigation).toHaveAttribute('data-open', 'false')

    fireEvent.click(screen.getByRole('button', { name: 'เปิดเมนู' }))
    expect(navigation).toHaveAttribute('data-open', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'ปิดเมนู' }))
    expect(navigation).toHaveAttribute('data-open', 'false')
  })
})
