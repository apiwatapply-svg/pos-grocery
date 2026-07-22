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

const superAdminSession: Session = {
  token: 'token-super-admin',
  user: {
    id: 'super-admin-1',
    username: 'admin',
    displayName: 'Admin',
    role: 'super_admin',
  },
}

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

function renderShell(session = superAdminSession) {
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
  it('shows only the two management links for super_admin', () => {
    renderShell()

    expect(screen.getByRole('link', { name: 'ข้อมูลร้าน' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ผู้ใช้ระบบ' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'ขายสินค้า' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument()
  })

  it('shows the user info and logout in the sidebar footer and keeps page content visible', () => {
    renderShell()

    expect(screen.getByText('POS Grocery')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('super_admin')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Page Content' })).toBeInTheDocument()
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
    expect(readSession()).toMatchObject({ token: superAdminSession.token })
  })

  it('clears the session when logout confirmation is accepted', async () => {
    mockedSwal.fire.mockResolvedValueOnce({ isConfirmed: true, isDenied: false, isDismissed: false })
    renderShell()

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))

    await waitFor(() => {
      expect(readSession()).toBeNull()
    })
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
