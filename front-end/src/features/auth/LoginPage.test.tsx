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
    close: vi.fn(),
    showLoading: vi.fn(),
  },
}))

const mockedApiPost = vi.mocked(apiPost)
const mockedSwal = vi.mocked(Swal)

type LoginRole = 'super_admin' | 'store_admin' | 'cashier' | 'stock'

function loginResponse(role: LoginRole) {
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
        <Route path="/settings/store" element={<h1>จัดการร้านค้า</h1>} />
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

  it('routes super_admin to the store management page after login', async () => {
    mockedApiPost.mockResolvedValueOnce(loginResponse('super_admin'))

    renderLogin()
    await submitLogin()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'จัดการร้านค้า' })).toBeInTheDocument()
    })
    expect(readSession()).toMatchObject({
      token: 'token-super_admin',
      user: { role: 'super_admin' },
    })
    expect(mockedSwal.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        icon: 'success',
        timer: 800,
      }),
    )
  })

  it('keeps every non-super-admin role pinned to the login page after login', async () => {
    const roles: LoginRole[] = ['store_admin', 'cashier', 'stock']

    for (const role of roles) {
      mockedApiPost.mockResolvedValueOnce(loginResponse(role))

      const { unmount } = render(
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/settings/store" element={<h1>จัดการร้านค้า</h1>} />
          </Routes>
        </MemoryRouter>,
      )

      await submitLogin()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
      })
      expect(screen.queryByRole('heading', { name: 'จัดการร้านค้า' })).not.toBeInTheDocument()
      expect(readSession()).toMatchObject({ user: { role } })

      unmount()
      localStorage.clear()
    }
  })

  it.each([
    'super_admin',
    'store_admin',
    'cashier',
    'stock',
  ] as const)('redirects already authenticated %s users to their default page', async (role) => {
    saveSession(loginResponse(role))

    renderLogin()

    if (role === 'super_admin') {
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'จัดการร้านค้า' })).toBeInTheDocument()
      })
    } else {
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
      })
    }
    expect(mockedApiPost).not.toHaveBeenCalled()
  })

  it('shows a loading swal while the login request is in flight', async () => {
    let resolveLogin!: (value: ReturnType<typeof loginResponse>) => void
    mockedApiPost.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLogin = resolve
      }),
    )

    renderLogin()
    await submitLogin()

    expect(mockedSwal.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'กำลังเข้าสู่ระบบ',
        showConfirmButton: false,
      }),
    )
    expect(mockedSwal.showLoading).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /กำลังเข้าสู่ระบบ/i })).toBeDisabled()

    await act(async () => {
      resolveLogin(loginResponse('super_admin'))
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'จัดการร้านค้า' })).toBeInTheDocument()
    })
    expect(mockedSwal.close).toHaveBeenCalled()
  })

  it('shows an error swal and clears the remembered username when login fails', async () => {
    localStorage.setItem('pos-grocery:last-username', 'admin')
    mockedApiPost.mockRejectedValueOnce(new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'))

    renderLogin()
    await submitLogin()

    await waitFor(() => {
      expect(mockedSwal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: 'error',
          title: 'เข้าสู่ระบบไม่สำเร็จ',
          text: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
        }),
      )
    })
    expect(localStorage.getItem('pos-grocery:last-username')).toBeNull()
    expect(screen.getByRole('button', { name: /^login$/i })).not.toBeDisabled()
  })
})
