import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
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
})
