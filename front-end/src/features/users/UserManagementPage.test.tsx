import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Swal from 'sweetalert2'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiDelete, apiGet, apiPost } from '../../lib/api/client'
import { UserManagementPage } from './UserManagementPage'

vi.mock('../../lib/api/client', () => ({
  apiDelete: vi.fn(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))

vi.mock('sweetalert2', () => ({
  default: {
    fire: vi.fn(),
  },
}))

const mockedApiDelete = vi.mocked(apiDelete)
const mockedApiGet = vi.mocked(apiGet)
const mockedApiPost = vi.mocked(apiPost)
const mockedSwal = vi.mocked(Swal)

const sqlUsers = [
  { id: 'sql-owner', username: 'sqladmin', displayName: 'SQL Admin', role: 'owner', status: 'active' },
  { id: 'sql-cashier', username: 'sqlcashier', displayName: 'SQL Cashier', role: 'cashier', status: 'active' },
]

beforeEach(() => {
  mockedApiGet.mockResolvedValue(sqlUsers)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('UserManagementPage', () => {
  it('loads users from the backend instead of rendering hardcoded users', async () => {
    render(<UserManagementPage />)

    expect(await screen.findByRole('cell', { name: 'sqladmin' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'SQL Cashier' })).toBeInTheDocument()
    expect(screen.queryByRole('cell', { name: 'admin' })).not.toBeInTheDocument()
    expect(mockedApiGet).toHaveBeenCalledWith('/users')
  })

  it('creates a user from an add-user modal through the backend', async () => {
    mockedApiPost.mockResolvedValueOnce({
      id: 'sql-stock',
      username: 'stock01',
      displayName: 'Stock Staff',
      role: 'stock',
      status: 'active',
    })
    render(<UserManagementPage />)
    expect(await screen.findByRole('cell', { name: 'sqladmin' })).toBeInTheDocument()

    expect(screen.queryByRole('dialog', { name: 'เพิ่มผู้ใช้' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มผู้ใช้' }))

    const dialog = screen.getByRole('dialog', { name: 'เพิ่มผู้ใช้' })
    fireEvent.change(within(dialog).getByLabelText('username'), {
      target: { value: 'stock01' },
    })
    fireEvent.change(within(dialog).getByLabelText('ชื่อผู้ใช้'), {
      target: { value: 'Stock Staff' },
    })
    fireEvent.change(within(dialog).getByLabelText('password'), {
      target: { value: 'secret123' },
    })
    fireEvent.change(within(dialog).getByLabelText('Role'), {
      target: { value: 'stock' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึกผู้ใช้' }))

    await waitFor(() => {
      expect(mockedApiPost).toHaveBeenCalledWith('/users', {
        username: 'stock01',
        password: 'secret123',
        displayName: 'Stock Staff',
        role: 'stock',
        status: 'active',
      })
      expect(screen.queryByRole('dialog', { name: 'เพิ่มผู้ใช้' })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('cell', { name: 'stock01' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Stock Staff' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'stock' })).toBeInTheDocument()
  })

  it('closes the add-user modal without creating a user', async () => {
    render(<UserManagementPage />)
    expect(await screen.findByRole('cell', { name: 'sqladmin' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มผู้ใช้' }))
    fireEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }))

    expect(screen.queryByRole('dialog', { name: 'เพิ่มผู้ใช้' })).not.toBeInTheDocument()
    expect(screen.queryByRole('cell', { name: 'stock01' })).not.toBeInTheDocument()
  })

  it('requires SweetAlert2 confirmation before deactivating a user', async () => {
    mockedSwal.fire.mockResolvedValueOnce({
      isConfirmed: false,
      isDenied: false,
      isDismissed: true,
    })
    render(<UserManagementPage />)
    expect(await screen.findByRole('cell', { name: 'sqladmin' })).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'ปิดใช้งาน' })[0])

    await waitFor(() => {
      expect(mockedSwal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          confirmButtonText: 'ปิดใช้งาน',
          icon: 'warning',
          showCancelButton: true,
          title: 'ยืนยันปิดใช้งานผู้ใช้',
        }),
      )
    })
    expect(mockedApiDelete).not.toHaveBeenCalled()
    expect(screen.getAllByRole('cell', { name: 'active' })).toHaveLength(2)
  })

  it('deactivates a user after SweetAlert2 confirmation through the backend', async () => {
    mockedSwal.fire.mockResolvedValueOnce({
      isConfirmed: true,
      isDenied: false,
      isDismissed: false,
    })
    mockedApiDelete.mockResolvedValueOnce({ ...sqlUsers[0], status: 'inactive' })
    render(<UserManagementPage />)
    expect(await screen.findByRole('cell', { name: 'sqladmin' })).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'ปิดใช้งาน' })[0])

    await waitFor(() => {
      expect(mockedApiDelete).toHaveBeenCalledWith('/users/sql-owner')
      expect(screen.getByRole('row', { name: /sqladmin SQL Admin owner inactive/ })).toBeInTheDocument()
    })
  })
})
