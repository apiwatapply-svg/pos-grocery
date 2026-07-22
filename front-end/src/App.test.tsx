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
    renderApp('/settings/users', sessionForRole('cashier'))

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

  it('keeps every other role out of the management pages', () => {
    const forbiddenRoles = roles.filter((role) => role !== 'super_admin')

    forbiddenRoles.forEach((role) => {
      cleanup()
      localStorage.clear()
      renderApp('/settings/store', sessionForRole(role))

      expect(screen.getByRole('heading', { name: 'ไม่มีสิทธิ์เข้าหน้านี้' })).toBeInTheDocument()
    })
  })
})
