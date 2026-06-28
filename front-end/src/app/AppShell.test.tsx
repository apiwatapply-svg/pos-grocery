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

const stockSession: Session = {
  token: 'token-stock',
  user: {
    id: 'stock-1',
    username: 'stock',
    displayName: 'Stock One',
    role: 'stock',
  },
}

afterEach(() => {
  localStorage.clear()
})

function renderShell(session = cashierSession) {
  saveSession(session)
  return render(
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

  it('hides the POS shortcut for roles that cannot use checkout', () => {
    renderShell(stockSession)

    expect(screen.queryByRole('link', { name: 'ไปหน้า POS' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument()
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

  it('collapses the desktop sidebar and remembers the preference', () => {
    const { unmount } = renderShell()

    const layout = screen.getByRole('navigation', { name: 'เมนูหลัก' }).closest('.app-layout')
    expect(layout).toHaveAttribute('data-sidebar-collapsed', 'false')

    fireEvent.click(screen.getByRole('button', { name: 'หุบ sidebar' }))
    expect(layout).toHaveAttribute('data-sidebar-collapsed', 'true')
    expect(localStorage.getItem('pos-grocery:sidebar-collapsed')).toBe('true')

    unmount()
    renderShell()

    expect(screen.getByRole('navigation', { name: 'เมนูหลัก' }).closest('.app-layout')).toHaveAttribute(
      'data-sidebar-collapsed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'ขยาย sidebar' })).toBeInTheDocument()
  })
})
