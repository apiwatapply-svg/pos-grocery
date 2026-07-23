import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import type { Role } from './lib/auth/permissions'
import { saveSession, type Session } from './lib/auth/session'
import { App } from './App'

const superAdminSession: Session = {
  token: 'token-super-admin',
  user: {
    id: 'super-admin-1',
    username: 'admin',
    displayName: 'Admin',
    role: 'super_admin',
  },
}

function renderApp(path: string, session: Session | null = superAdminSession) {
  if (session) {
    saveSession(session)
  }

  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

function sessionForRole(role: Role): Session {
  return {
    ...superAdminSession,
    user: {
      ...superAdminSession.user,
      id: `${role}-1`,
      role,
    },
  }
}

const superAdminOnlyRoutes: Array<{ path: string; heading: string }> = [
  { path: '/settings/store', heading: 'จัดการร้านค้า' },
]

const userManagementRoutes: Array<{ path: string; heading: string }> = [
  { path: '/settings/users', heading: 'ผู้ใช้ระบบ' },
]

const roles: Role[] = ['super_admin', 'store_admin', 'cashier', 'stock']

afterEach(() => {
  localStorage.clear()
})

describe('App routes', () => {
  it('redirects unauthenticated users to login', () => {
    renderApp('/dashboard', null)

    expect(screen.getByRole('heading', { name: 'เข้าสู่ระบบร้านค้า' })).toBeInTheDocument()
  })

  it('blocks forbidden direct route access for non-super-admin users', () => {
    renderApp('/settings/store', sessionForRole('cashier'))

    expect(screen.getByRole('heading', { name: 'ไม่มีสิทธิ์เข้าหน้านี้' })).toBeInTheDocument()
  })

  it('shows the not-found page for unknown paths', () => {
    renderApp('/reports/best-sellers')

    expect(screen.getByRole('heading', { name: 'ไม่พบหน้านี้' })).toBeInTheDocument()
  })

  it.each(superAdminOnlyRoutes)('lets super_admin open $path', ({ path, heading }) => {
    renderApp(path)

    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
  })

  it.each(userManagementRoutes)('lets super_admin and store_admin open $path', ({ path, heading }) => {
    renderApp(path, sessionForRole('super_admin'))
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()

    cleanup()
    localStorage.clear()
    renderApp(path, sessionForRole('store_admin'))
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
  })

  it('blocks cashier and stock from the user management page', () => {
    const forbiddenRoles = ['cashier', 'stock'] as const

    forbiddenRoles.forEach((role) => {
      cleanup()
      localStorage.clear()
      renderApp('/settings/users', sessionForRole(role))

      expect(screen.getByRole('heading', { name: 'ไม่มีสิทธิ์เข้าหน้านี้' })).toBeInTheDocument()
    })
  })

  it('keeps every role except super_admin out of the store settings page', () => {
    const forbiddenRoles = roles.filter((role) => role !== 'super_admin')

    forbiddenRoles.forEach((role) => {
      cleanup()
      localStorage.clear()
      renderApp('/settings/store', sessionForRole(role))

      expect(screen.getByRole('heading', { name: 'ไม่มีสิทธิ์เข้าหน้านี้' })).toBeInTheDocument()
    })
  })

  it('lets store_admin open the store-scoped pages they own', () => {
    const storeAdminPages: Array<{ path: string; heading: string }> = [
      { path: '/dashboard', heading: 'Dashboard' },
      { path: '/pos', heading: 'Checkout' },
      { path: '/products', heading: 'สินค้า' },
      { path: '/inventory', heading: 'สินค้า' },
      { path: '/reports/sales', heading: 'รายงานยอดขาย' },
    ]

    storeAdminPages.forEach(({ path, heading }) => {
      cleanup()
      localStorage.clear()
      renderApp(path, sessionForRole('store_admin'))

      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    })
  })

  it('lets cashier open POS, products, and receipts but blocks the rest', () => {
    const allowedPages: Array<{ path: string; heading: string }> = [
      { path: '/pos', heading: 'Checkout' },
      { path: '/products', heading: 'สินค้า' },
      { path: '/receipts', heading: 'ประวัติใบเสร็จ' },
    ]

    allowedPages.forEach(({ path, heading }) => {
      cleanup()
      localStorage.clear()
      renderApp(path, sessionForRole('cashier'))

      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    })

    cleanup()
    localStorage.clear()
    renderApp('/inventory', sessionForRole('cashier'))
    expect(screen.getByRole('heading', { name: 'ไม่มีสิทธิ์เข้าหน้านี้' })).toBeInTheDocument()
  })

  it('lets stock open inventory and products but blocks the rest', () => {
    const allowedPages: Array<{ path: string; heading: string }> = [
      { path: '/inventory', heading: 'สินค้า' },
      { path: '/products', heading: 'สินค้า' },
      { path: '/dashboard', heading: 'Dashboard' },
    ]

    allowedPages.forEach(({ path, heading }) => {
      cleanup()
      localStorage.clear()
      renderApp(path, sessionForRole('stock'))

      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    })

    cleanup()
    localStorage.clear()
    renderApp('/pos', sessionForRole('stock'))
    expect(screen.getByRole('heading', { name: 'ไม่มีสิทธิ์เข้าหน้านี้' })).toBeInTheDocument()
  })
})
