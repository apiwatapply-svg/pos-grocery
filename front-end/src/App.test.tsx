import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import type { Role } from './lib/auth/permissions'
import { saveSession, type Session } from './lib/auth/session'
import { App } from './App'

const ownerSession: Session = {
  token: 'token-owner',
  user: {
    id: 'owner-1',
    username: 'admin',
    displayName: 'Admin',
    role: 'owner',
  },
}

const cashierSession: Session = {
  ...ownerSession,
  user: {
    id: 'cashier-1',
    username: 'cashier',
    displayName: 'Cashier One',
    role: 'cashier',
  },
}

const stockSession: Session = {
  ...ownerSession,
  user: {
    id: 'stock-1',
    username: 'stock',
    displayName: 'Stock One',
    role: 'stock',
  },
}

function renderApp(path: string, session: Session | null = ownerSession) {
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
  if (role === 'cashier') {
    return cashierSession
  }
  if (role === 'stock') {
    return stockSession
  }
  return {
    ...ownerSession,
    user: {
      ...ownerSession.user,
      role,
    },
  }
}

const protectedRouteCases: Array<{
  path: string
  heading: string
  allowedRoles: Role[]
}> = [
  { path: '/dashboard', heading: 'Dashboard', allowedRoles: ['owner', 'admin', 'stock'] },
  { path: '/pos', heading: 'ขายสินค้า / Scan barcode', allowedRoles: ['owner', 'admin', 'cashier'] },
  { path: '/customer-display', heading: 'จอลูกค้า', allowedRoles: ['owner', 'admin', 'cashier'] },
  { path: '/receipts', heading: 'ประวัติใบเสร็จ', allowedRoles: ['owner', 'admin', 'cashier'] },
  { path: '/receipts/receipt-1', heading: 'รายละเอียดใบเสร็จ', allowedRoles: ['owner', 'admin', 'cashier'] },
  { path: '/products', heading: 'สินค้า', allowedRoles: ['owner', 'admin', 'cashier', 'stock'] },
  { path: '/products/new', heading: 'เพิ่มสินค้า', allowedRoles: ['owner', 'admin'] },
  { path: '/products/product-water/edit', heading: 'แก้ไขสินค้า', allowedRoles: ['owner', 'admin'] },
  { path: '/inventory', heading: 'สินค้า', allowedRoles: ['owner', 'admin', 'stock'] },
  { path: '/inventory/receiving', heading: 'รับของเข้า', allowedRoles: ['owner', 'admin', 'stock'] },
  { path: '/inventory/counting', heading: 'ตรวจนับ stock', allowedRoles: ['owner', 'admin', 'stock'] },
  { path: '/reports/sales', heading: 'รายงานยอดขาย', allowedRoles: ['owner', 'admin'] },
  { path: '/settings/store', heading: 'จัดการร้านค้า', allowedRoles: ['owner', 'admin'] },
  { path: '/settings/users', heading: 'ผู้ใช้ระบบ', allowedRoles: ['owner', 'admin'] },
]

const roles: Role[] = ['owner', 'admin', 'cashier', 'stock']

afterEach(() => {
  localStorage.clear()
})

describe('App routes', () => {
  it('redirects unauthenticated users to login', () => {
    renderApp('/dashboard', null)

    expect(screen.getByRole('heading', { name: 'เข้าสู่ระบบร้านค้า' })).toBeInTheDocument()
  })

  it('renders authenticated pages inside the app shell', () => {
    renderApp('/dashboard')

    expect(screen.getByRole('navigation', { name: 'เมนูหลัก' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it('blocks forbidden direct route access', () => {
    renderApp('/settings/users', cashierSession)

    expect(screen.getByRole('heading', { name: 'ไม่มีสิทธิ์เข้าหน้านี้' })).toBeInTheDocument()
  })

  it('keeps each major feature on a separate route', () => {
    renderApp('/products')
    expect(screen.getByRole('heading', { name: 'สินค้า' })).toBeInTheDocument()

    localStorage.clear()
    renderApp('/inventory/receiving')
    expect(screen.getByRole('heading', { name: 'รับของเข้า' })).toBeInTheDocument()
  })

  it('uses Dashboard as the only page for best-seller insights', () => {
    renderApp('/reports/best-sellers')

    expect(screen.getByRole('heading', { name: 'ไม่พบหน้านี้' })).toBeInTheDocument()
  })

  it.each(protectedRouteCases)('renders allowed roles for $path', ({ path, heading, allowedRoles }) => {
    allowedRoles.forEach((role) => {
      cleanup()
      localStorage.clear()
      renderApp(path, sessionForRole(role))

      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    })
  })

  it.each(protectedRouteCases)('blocks forbidden roles for $path', ({ path, allowedRoles }) => {
    const forbiddenRoles = roles.filter((role) => !allowedRoles.includes(role))

    forbiddenRoles.forEach((role) => {
      cleanup()
      localStorage.clear()
      renderApp(path, sessionForRole(role))

      expect(screen.getByRole('heading', { name: 'ไม่มีสิทธิ์เข้าหน้านี้' })).toBeInTheDocument()
    })
  })
})
