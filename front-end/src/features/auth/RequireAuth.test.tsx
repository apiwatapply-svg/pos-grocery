import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { saveSession, type Session } from '../../lib/auth/session'
import { RequireAuth } from './RequireAuth'

const ownerSession: Session = {
  token: 'token-owner',
  user: {
    id: 'owner-1',
    username: 'admin',
    displayName: 'Admin',
    role: 'owner',
  },
}

function renderGuardedRoute(initialPath = '/reports/sales') {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<h1>Login Page</h1>} />
        <Route
          path="/reports/sales"
          element={
            <RequireAuth routeId="sales-report">
              <h1>Sales Report</h1>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  localStorage.clear()
})

describe('RequireAuth', () => {
  it('redirects unauthenticated users to login', () => {
    renderGuardedRoute()

    expect(screen.getByRole('heading', { name: 'Login Page' })).toBeInTheDocument()
  })

  it('renders access denied for users without route permission', () => {
    saveSession({
      ...ownerSession,
      user: {
        ...ownerSession.user,
        role: 'cashier',
      },
    })

    renderGuardedRoute()

    expect(screen.getByRole('heading', { name: 'ไม่มีสิทธิ์เข้าหน้านี้' })).toBeInTheDocument()
  })

  it('renders the route content for users with permission', () => {
    saveSession(ownerSession)

    renderGuardedRoute()

    expect(screen.getByRole('heading', { name: 'Sales Report' })).toBeInTheDocument()
  })
})
