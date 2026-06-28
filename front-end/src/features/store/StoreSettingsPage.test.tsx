import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import Swal from 'sweetalert2'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiGet, apiPatch } from '../../lib/api/client'
import { StoreSettingsPage } from './StoreSettingsPage'

vi.mock('../../lib/api/client', () => ({
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
}))

vi.mock('sweetalert2', () => ({
  default: {
    fire: vi.fn(),
  },
}))

const mockedApiGet = vi.mocked(apiGet)
const mockedApiPatch = vi.mocked(apiPatch)
const mockedSwal = vi.mocked(Swal)

beforeEach(() => {
  mockedApiGet.mockResolvedValue({
    id: 'store-sql-1',
    name: 'SQL Grocery Store',
    phone: '0891112222',
    address: 'SQL Road',
    ownerName: 'SQL Owner',
    status: 'active',
  })
  mockedApiPatch.mockResolvedValue({
    id: 'store-sql-1',
    name: 'Updated SQL Grocery',
    phone: '0899998888',
    address: 'Updated Road',
    ownerName: 'Updated Owner',
    status: 'active',
  })
  mockedSwal.fire.mockResolvedValue({ isConfirmed: true, isDenied: false, isDismissed: false })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('StoreSettingsPage', () => {
  it('loads store name, phone, address, and owner fields from the backend', async () => {
    render(<StoreSettingsPage />)

    expect(screen.getByText('ชื่อร้าน')).toBeInTheDocument()
    expect(screen.getByText('เบอร์โทร')).toBeInTheDocument()
    expect(screen.getByText('ที่อยู่')).toBeInTheDocument()
    expect(screen.getByText('เจ้าของร้าน')).toBeInTheDocument()
    expect(await screen.findByDisplayValue('SQL Grocery Store')).toBeInTheDocument()
    expect(screen.getByDisplayValue('0891112222')).toBeInTheDocument()
    expect(screen.queryByText('POS Grocery')).not.toBeInTheDocument()
    expect(mockedApiGet).toHaveBeenCalledWith('/store/current')
  })

  it('updates store fields through the backend from an edit form', async () => {
    render(<StoreSettingsPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'แก้ไขข้อมูลร้าน' }))
    fireEvent.change(screen.getByLabelText('ชื่อร้าน'), { target: { value: 'Updated SQL Grocery' } })
    fireEvent.change(screen.getByLabelText('เบอร์โทร'), { target: { value: '0899998888' } })
    fireEvent.change(screen.getByLabelText('ที่อยู่'), { target: { value: 'Updated Road' } })
    fireEvent.change(screen.getByLabelText('เจ้าของร้าน'), { target: { value: 'Updated Owner' } })
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกข้อมูลร้าน' }))

    await waitFor(() => {
      expect(mockedApiPatch).toHaveBeenCalledWith('/store/current', {
        name: 'Updated SQL Grocery',
        phone: '0899998888',
        address: 'Updated Road',
        ownerName: 'Updated Owner',
        status: 'active',
      })
    })
    expect(await screen.findByDisplayValue('Updated SQL Grocery')).toBeInTheDocument()
    expect(mockedSwal.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        icon: 'question',
        title: 'ยืนยันบันทึกข้อมูลร้าน',
      }),
    )
  })

  it('deactivates the store after SweetAlert confirmation', async () => {
    mockedApiPatch.mockResolvedValueOnce({
      id: 'store-sql-1',
      name: 'SQL Grocery Store',
      phone: '0891112222',
      address: 'SQL Road',
      ownerName: 'SQL Owner',
      status: 'inactive',
    })

    render(<StoreSettingsPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'ปิดใช้งานร้าน' }))

    await waitFor(() => {
      expect(mockedApiPatch).toHaveBeenCalledWith('/store/current', { status: 'inactive' })
    })
    expect(await screen.findAllByText('inactive')).toHaveLength(2)
    expect(mockedSwal.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        icon: 'warning',
        title: 'ยืนยันปิดใช้งานร้าน',
      }),
    )
  })
})
