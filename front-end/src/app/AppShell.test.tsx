import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Swal from 'sweetalert2'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readSession, saveSession, type Session } from '../lib/auth/session'
import { AppShell } from './AppShell'

vi.mock('sweetalert2', () => ({
  default: {
    fire: vi.fn(),
  },
}))

const mockedSwal = vi.mocked(Swal)

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
  vi.clearAllMocks()
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
    expect(screen.getByRole('link', { name: 'ไปหน้า POS' })).toHaveClass('navbar-pos-button')
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Page Content' })).toBeInTheDocument()
  })

  it('hides the POS shortcut for roles that cannot use checkout', () => {
    renderShell(stockSession)

    expect(screen.queryByRole('link', { name: 'ไปหน้า POS' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument()
  })

  it('keeps the session when logout confirmation is cancelled', async () => {
    mockedSwal.fire.mockResolvedValueOnce({ isConfirmed: false, isDenied: false, isDismissed: true })
    renderShell()

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))

    await waitFor(() => {
      expect(mockedSwal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: 'warning',
          showCancelButton: true,
        }),
      )
    })
    expect(readSession()).toMatchObject({ token: cashierSession.token })
  })

  it('clears the session when logout confirmation is accepted', async () => {
    mockedSwal.fire.mockResolvedValueOnce({ isConfirmed: true, isDenied: false, isDismissed: false })
    renderShell()

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))

    await waitFor(() => {
      expect(readSession()).toBeNull()
    })
  })

  it('uses the products page as the single product and inventory list in the sidebar', () => {
    renderShell(stockSession)

    expect(screen.getByRole('link', { name: 'สินค้า' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'สินค้าคงคลัง' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'เพิ่มสินค้า' })).not.toBeInTheDocument()
  })

  it('keeps best-seller insights inside Dashboard instead of a separate sidebar page', () => {
    renderShell({
      token: 'token-owner',
      user: {
        id: 'owner-1',
        username: 'owner',
        displayName: 'Owner One',
        role: 'owner',
      },
    })

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'สินค้าขายดี' })).not.toBeInTheDocument()
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
