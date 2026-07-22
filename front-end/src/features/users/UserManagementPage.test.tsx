import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Swal from 'sweetalert2'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api/client'
import { UserManagementPage } from './UserManagementPage'

vi.mock('../../lib/api/client', () => ({
  apiDelete: vi.fn(),
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
}))

vi.mock('sweetalert2', () => ({
  default: {
    fire: vi.fn(),
  },
}))

const mockedApiDelete = vi.mocked(apiDelete)
const mockedApiGet = vi.mocked(apiGet)
const mockedApiPatch = vi.mocked(apiPatch)
const mockedApiPost = vi.mocked(apiPost)
const mockedSwal = vi.mocked(Swal)

const sqlUsers = [
  {
    id: 'sql-super-admin',
    storeId: 'store-main',
    username: 'sqladmin',
    displayName: 'SQL Admin',
    role: 'super_admin',
    status: 'active',
  },
  {
    id: 'sql-cashier',
    storeId: 'store-branch',
    username: 'sqlcashier',
    displayName: 'SQL Cashier',
    role: 'cashier',
    status: 'active',
  },
]

const stores = [
  { id: 'store-main', name: 'Main Store', phone: '0800000000', address: 'Bangkok', ownerName: 'Owner', status: 'active' },
  { id: 'store-branch', name: 'Branch Store', phone: '0811111111', address: 'Chiang Mai', ownerName: 'Branch', status: 'active' },
]

const manySqlUsers = Array.from({ length: 12 }, (_, index) => ({
  id: `sql-user-${index + 1}`,
  username: `sqluser${index + 1}`,
  displayName: `SQL User ${index + 1}`,
  role: 'cashier',
  status: 'active',
}))

beforeEach(() => {
  mockedApiGet.mockImplementation((path) => {
    if (path === '/users') {
      return Promise.resolve(sqlUsers)
    }

    if (path === '/store') {
      return Promise.resolve(stores)
    }

    return Promise.reject(new Error(`Unexpected path ${path}`))
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('UserManagementPage', () => {
  it('loads users from the backend instead of rendering hardcoded users', async () => {
    render(<UserManagementPage />)

    expect(await screen.findByRole('columnheader', { name: 'No' })).toBeInTheDocument()
    expect(await screen.findByRole('cell', { name: 'sqladmin' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'SQL Cashier' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Main Store' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Branch Store' })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /1 Main Store sqladmin SQL Admin super_admin active/ })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /2 Branch Store sqlcashier SQL Cashier cashier active/ })).toBeInTheDocument()
    expect(screen.queryByRole('cell', { name: 'admin' })).not.toBeInTheDocument()
    expect(mockedApiGet).toHaveBeenCalledWith('/users')
    expect(mockedApiGet).toHaveBeenCalledWith('/store')
  })

  it('creates a user from an add-user modal through the backend', async () => {
    mockedApiPost.mockResolvedValueOnce({
      id: 'sql-stock',
      username: 'stock01',
      displayName: 'Stock Staff',
      role: 'stock',
      status: 'active',
      storeId: 'store-branch',
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
    const roleSelect = within(dialog).getByLabelText('สิทธิ์การใช้งาน')
    expect(roleSelect).toBeInTheDocument()
    // The custom select renders its value inside the button label.
    expect(within(dialog).getByLabelText('ร้านค้า')).toHaveTextContent('Main Store')
    fireEvent.click(roleSelect)
    const roleOptions = within(dialog).getAllByRole('option')
    expect(roleOptions.map((option) => [option.getAttribute('data-option-index'), option.textContent])).toEqual([
      ['0', 'Super Admin (super_admin)'],
      ['1', 'ผู้ดูแลร้าน (store_admin)'],
      ['2', 'แคชเชียร์ (cashier)'],
      ['3', 'สต็อก/คลังสินค้า (stock)'],
    ])

    fireEvent.mouseDown(within(dialog).getByRole('option', { name: 'สต็อก/คลังสินค้า (stock)' }))
    fireEvent.click(within(dialog).getByLabelText('ร้านค้า'))
    fireEvent.mouseDown(within(dialog).getByRole('option', { name: 'Branch Store' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึกผู้ใช้' }))

    await waitFor(() => {
      expect(mockedApiPost).toHaveBeenCalledWith('/users', {
        username: 'stock01',
        password: 'secret123',
        displayName: 'Stock Staff',
        role: 'stock',
        storeId: 'store-branch',
        status: 'active',
      })
      expect(screen.queryByRole('dialog', { name: 'เพิ่มผู้ใช้' })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('cell', { name: 'stock01' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Stock Staff' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'stock' })).toBeInTheDocument()
  })

  it('edits a user from an edit modal with existing values through the backend', async () => {
    mockedApiPatch.mockResolvedValueOnce({
      id: 'sql-super-admin',
      username: 'sqladmin2',
      displayName: 'SQL Admin 2',
      role: 'store_admin',
      status: 'inactive',
      storeId: 'store-branch',
    })
    render(<UserManagementPage />)
    expect(await screen.findByRole('cell', { name: 'sqladmin' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'แก้ไข SQL Admin' }))

    const dialog = screen.getByRole('dialog', { name: 'แก้ไขผู้ใช้ SQL Admin' })
    expect(within(dialog).getByDisplayValue('sqladmin')).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('SQL Admin')).toBeInTheDocument()
    // Custom select renders the current value as the button label.
    expect(within(dialog).getByLabelText('สิทธิ์การใช้งาน')).toHaveTextContent('super_admin')
    expect(within(dialog).getByLabelText('ร้านค้า')).toHaveTextContent('Main Store')
    expect(within(dialog).getByLabelText('สถานะผู้ใช้')).toHaveTextContent('active')
    expect(within(dialog).getByLabelText('password ใหม่')).toHaveValue('')

    fireEvent.change(within(dialog).getByLabelText('username'), {
      target: { value: 'sqladmin2' },
    })
    fireEvent.change(within(dialog).getByLabelText('ชื่อผู้ใช้'), {
      target: { value: 'SQL Admin 2' },
    })
    // Open each custom select and pick a different option.
    fireEvent.click(within(dialog).getByLabelText('สิทธิ์การใช้งาน'))
    fireEvent.mouseDown(
      within(dialog).getByRole('option', { name: 'ผู้ดูแลร้าน (store_admin)' }),
    )
    fireEvent.click(within(dialog).getByLabelText('สถานะผู้ใช้'))
    fireEvent.mouseDown(within(dialog).getByRole('option', { name: 'inactive' }))
    fireEvent.click(within(dialog).getByLabelText('ร้านค้า'))
    fireEvent.mouseDown(within(dialog).getByRole('option', { name: 'Branch Store' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึกการแก้ไข' }))

    await waitFor(() => {
      expect(mockedApiPatch).toHaveBeenCalledWith('/users/sql-super-admin', {
        username: 'sqladmin2',
        displayName: 'SQL Admin 2',
        role: 'store_admin',
        storeId: 'store-branch',
        status: 'inactive',
      })
      expect(screen.queryByRole('dialog', { name: 'แก้ไขผู้ใช้ SQL Admin' })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('cell', { name: 'sqladmin2' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'SQL Admin 2' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'store_admin' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'inactive' })).toBeInTheDocument()
  })

  it('closes the add-user modal without creating a user', async () => {
    render(<UserManagementPage />)
    expect(await screen.findByRole('cell', { name: 'sqladmin' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มผู้ใช้' }))
    fireEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }))

    expect(screen.queryByRole('dialog', { name: 'เพิ่มผู้ใช้' })).not.toBeInTheDocument()
    expect(screen.queryByRole('cell', { name: 'stock01' })).not.toBeInTheDocument()
  })

  it('paginates long user tables', async () => {
    mockedApiGet.mockResolvedValueOnce(manySqlUsers)
    render(<UserManagementPage />)

    expect(await screen.findByRole('cell', { name: 'sqluser10' })).toBeInTheDocument()
    expect(screen.queryByRole('cell', { name: 'sqluser11' })).not.toBeInTheDocument()
    expect(screen.getByText('แสดง 1-10 จาก 12 รายการ')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'หน้าถัดไป' }))

    expect(screen.getByRole('cell', { name: 'sqluser11' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'sqluser12' })).toBeInTheDocument()
    expect(screen.queryByRole('cell', { name: 'sqluser1' })).not.toBeInTheDocument()
    expect(screen.getByText('แสดง 11-12 จาก 12 รายการ')).toBeInTheDocument()
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
      expect(mockedApiDelete).toHaveBeenCalledWith('/users/sql-super-admin')
      expect(screen.getByRole('row', { name: /sqladmin SQL Admin super_admin inactive/ })).toBeInTheDocument()
    })
  })
})
