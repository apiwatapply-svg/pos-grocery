import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { saveSession, type Session } from '../../lib/auth/session'
import { RequireAuth } from './RequireAuth'

const superAdminSession: Session = {
  token: 'token-super-admin',
  user: {
    id: 'super-admin-1',
    username: 'admin',
    displayName: 'Admin',
    role: 'super_admin',
  },
}

function renderGuardedRoute(
  initialPath = '/settings/store',
  routeId: 'store-settings' | 'sales-report' = 'store-settings',
) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<h1>Login Page</h1>} />
        <Route
          path={initialPath}
          element={
            <RequireAuth routeId={routeId}>
              <h1>Guarded Content</h1>
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
      ...superAdminSession,
      user: {
        ...superAdminSession.user,
        role: 'cashier',
      },
    })

    renderGuardedRoute()

    expect(screen.getByRole('heading', { name: 'ไม่มีสิทธิ์เข้าหน้านี้' })).toBeInTheDocument()
  })

  it('renders the route content for users with permission', () => {
    saveSession(superAdminSession)

    renderGuardedRoute()

    expect(screen.getByRole('heading', { name: 'Guarded Content' })).toBeInTheDocument()
  })
})
