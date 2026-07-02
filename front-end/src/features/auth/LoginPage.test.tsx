import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Swal from 'sweetalert2'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiPost } from '../../lib/api/client'
import { readSession, saveSession } from '../../lib/auth/session'
import { LoginPage } from './LoginPage'

vi.mock('../../lib/api/client', () => ({
  apiPost: vi.fn(),
}))

vi.mock('sweetalert2', () => ({
  default: {
    fire: vi.fn().mockResolvedValue({}),
  },
}))

const mockedApiPost = vi.mocked(apiPost)
const mockedSwal = vi.mocked(Swal)

function loginResponse(role: 'owner' | 'admin' | 'cashier' | 'stock') {
  return {
    token: `token-${role}`,
    user: {
      id: `user-${role}`,
      username: role,
      displayName: `${role} user`,
      role,
    },
  }
}

function renderLogin() {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<h1>Dashboard</h1>} />
        <Route path="/pos" element={<h1>POS Checkout</h1>} />
        <Route path="/inventory" element={<h1>Inventory</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function submitLogin() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /login/i }))
  })
}

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('LoginPage', () => {
  it('renders username, password, and submit controls', () => {
    renderLogin()

    expect(screen.getByRole('textbox', { name: /username/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
  })

  it.each([
    ['owner', 'Dashboard'],
    ['admin', 'POS Checkout'],
    ['cashier', 'POS Checkout'],
    ['stock', 'Inventory'],
  ] as const)('redirects %s to the correct starting page', async (role, heading) => {
    mockedApiPost.mockResolvedValueOnce(loginResponse(role))

    renderLogin()
    await submitLogin()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    })
    expect(readSession()).toMatchObject({
      token: `token-${role}`,
      user: {
        role,
      },
    })
    expect(mockedSwal.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        icon: 'success',
        timer: 800,
      }),
    )
  })

  it.each([
    ['owner', 'Dashboard'],
    ['admin', 'POS Checkout'],
    ['cashier', 'POS Checkout'],
    ['stock', 'Inventory'],
  ] as const)('redirects already authenticated %s users away from login', async (role, heading) => {
    saveSession(loginResponse(role))

    renderLogin()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /login/i })).not.toBeInTheDocument()
    expect(mockedApiPost).not.toHaveBeenCalled()
  })
})
