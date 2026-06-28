import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Swal from 'sweetalert2'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserManagementPage } from './UserManagementPage'

vi.mock('sweetalert2', () => ({
  default: {
    fire: vi.fn(),
  },
}))

const mockedSwal = vi.mocked(Swal)

afterEach(() => {
  vi.clearAllMocks()
})

describe('UserManagementPage', () => {
  it('creates a user from an add-user modal', () => {
    render(<UserManagementPage />)

    expect(screen.queryByRole('dialog', { name: 'เพิ่มผู้ใช้' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มผู้ใช้' }))

    const dialog = screen.getByRole('dialog', { name: 'เพิ่มผู้ใช้' })
    fireEvent.change(within(dialog).getByLabelText('username'), {
      target: { value: 'stock01' },
    })
    fireEvent.change(within(dialog).getByLabelText('ชื่อผู้ใช้'), {
      target: { value: 'Stock Staff' },
    })
    fireEvent.change(within(dialog).getByLabelText('Role'), {
      target: { value: 'stock' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึกผู้ใช้' }))

    expect(screen.queryByRole('dialog', { name: 'เพิ่มผู้ใช้' })).not.toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'stock01' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Stock Staff' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'stock' })).toBeInTheDocument()
  })

  it('closes the add-user modal without creating a user', () => {
    render(<UserManagementPage />)

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
    expect(screen.getAllByRole('cell', { name: 'active' })).toHaveLength(2)
  })

  it('deactivates a user after SweetAlert2 confirmation', async () => {
    mockedSwal.fire.mockResolvedValueOnce({
      isConfirmed: true,
      isDenied: false,
      isDismissed: false,
    })
    render(<UserManagementPage />)

    fireEvent.click(screen.getAllByRole('button', { name: 'ปิดใช้งาน' })[0])

    await waitFor(() => {
      expect(screen.getByRole('row', { name: /admin Admin owner inactive/ })).toBeInTheDocument()
    })
  })
})
