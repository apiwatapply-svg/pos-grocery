import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Swal from 'sweetalert2'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiGet, apiPatch, apiPost } from '../../lib/api/client'
import { compressImageFile } from '../../lib/images/imageCompression'
import { StoreSettingsPage } from './StoreSettingsPage'

vi.mock('../../lib/api/client', () => ({
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
}))

vi.mock('sweetalert2', () => ({
  default: {
    fire: vi.fn(),
  },
}))

vi.mock('../../lib/images/imageCompression', async () => {
  const actual = await vi.importActual<typeof import('../../lib/images/imageCompression')>(
    '../../lib/images/imageCompression',
  )

  return {
    ...actual,
    compressImageFile: vi.fn(async (file: File) => ({
      dataUri: `data:image/webp;base64,compressed-${file.name}`,
      fileName: file.name.replace(/\.[^.]+$/, '.webp'),
      height: 512,
      width: 512,
    })),
  }
})

const mockedApiGet = vi.mocked(apiGet)
const mockedApiPatch = vi.mocked(apiPatch)
const mockedApiPost = vi.mocked(apiPost)
const mockedCompressImageFile = vi.mocked(compressImageFile)
const mockedSwal = vi.mocked(Swal)

const sqlStores = [
  {
    id: 'store-sql-1',
    name: 'SQL Grocery Store',
    phone: '0891112222',
    address: 'SQL Road',
    ownerName: 'SQL Owner',
    logoUrl: 'https://example.com/sql-logo.png',
    status: 'active',
  },
  {
    id: 'store-sql-2',
    name: 'Second Branch',
    phone: '0822222222',
    address: 'Branch Road',
    ownerName: 'Branch Owner',
    logoUrl: '',
    status: 'inactive',
  },
] as const

beforeEach(() => {
  mockedApiGet.mockResolvedValue([...sqlStores])
  mockedApiPatch.mockResolvedValue({
    ...sqlStores[0],
    status: 'inactive',
  })
  mockedApiPost.mockResolvedValue({
    id: 'store-sql-3',
    name: 'New Branch',
    phone: '0833333333',
    address: 'New Road',
    ownerName: 'New Owner',
    logoUrl: 'data:image/png;base64,bmV3LWxvZ28=',
    status: 'active',
  })
  mockedSwal.fire.mockResolvedValue({ isConfirmed: true, isDenied: false, isDismissed: false })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('StoreSettingsPage', () => {
  it('loads every store into an admin management table from the backend', async () => {
    render(<StoreSettingsPage />)

    expect(await screen.findByRole('heading', { name: 'จัดการร้านค้า' })).toBeInTheDocument()
    expect(mockedApiGet).toHaveBeenCalledWith('/store')
    for (const column of ['No', 'Logo', 'ชื่อร้าน', 'เบอร์โทร', 'ที่อยู่', 'เจ้าของร้าน', 'สถานะ', 'Store ID', 'จัดการ']) {
      expect(screen.getByRole('columnheader', { name: column })).toBeInTheDocument()
    }
    expect(screen.getByRole('img', { name: 'Logo SQL Grocery Store' })).toHaveAttribute(
      'src',
      'https://example.com/sql-logo.png',
    )
    expect(screen.getByRole('row', { name: /1 Logo SQL Grocery Store SQL Grocery Store 0891112222 SQL Road SQL Owner active/ })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /2 Second Branch 0822222222 Branch Road Branch Owner inactive/ })).toBeInTheDocument()
    const summary = screen.getByRole('region', { name: 'สรุปร้านค้า' })
    expect(summary).toHaveClass('store-admin-summary-full')
    expect(within(summary).getByText('ร้านทั้งหมด')).toBeInTheDocument()
    expect(within(summary).getByText('เปิดใช้งาน')).toBeInTheDocument()
    expect(within(summary).getByText('ปิดใช้งาน')).toBeInTheDocument()
  })

  it('creates a new store through a modal and posts to the backend', async () => {
    render(<StoreSettingsPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'เพิ่มร้านค้า' }))
    const dialog = screen.getByRole('dialog', { name: 'เพิ่มร้านค้าใหม่' })
    expect(within(dialog).getByLabelText('สถานะร้าน')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Logo ร้านค้า')).toBeInTheDocument()
    // Open the custom select to inspect the available status options.
    fireEvent.click(within(dialog).getByLabelText('สถานะร้าน'))
    expect(within(dialog).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'เปิดใช้งาน (active)',
      'ปิดใช้งาน (inactive)',
    ])
    fireEvent.change(within(dialog).getByLabelText('ชื่อร้าน'), { target: { value: 'New Branch' } })
    fireEvent.change(within(dialog).getByLabelText('เบอร์โทร'), { target: { value: '0833333333' } })
    fireEvent.change(within(dialog).getByLabelText('ที่อยู่'), { target: { value: 'New Road' } })
    fireEvent.change(within(dialog).getByLabelText('เจ้าของร้าน'), { target: { value: 'New Owner' } })
    fireEvent.change(within(dialog).getByLabelText('Logo ร้านค้า'), {
      target: { files: [new File(['new-logo'], 'new-logo.png', { type: 'image/png' })] },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึกร้านค้า' }))

    await waitFor(() => {
      expect(mockedApiPost).toHaveBeenCalledWith('/store', {
        name: 'New Branch',
        phone: '0833333333',
        address: 'New Road',
        ownerName: 'New Owner',
        logoUrl: 'data:image/webp;base64,compressed-new-logo.png',
        status: 'active',
      })
    })
    expect(mockedCompressImageFile).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'new-logo.png' }),
      expect.objectContaining({ maxHeight: 512, maxWidth: 512, mimeType: 'image/webp', quality: 0.82 }),
    )
    expect(await screen.findByText('New Branch')).toBeInTheDocument()
    expect(mockedSwal.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        icon: 'question',
        title: 'ยืนยันเพิ่มร้านค้า',
      }),
    )
  })

  it('updates a selected store status after SweetAlert confirmation', async () => {
    render(<StoreSettingsPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'ปิดใช้งาน SQL Grocery Store' }))

    await waitFor(() => {
      expect(mockedApiPatch).toHaveBeenCalledWith('/store/store-sql-1', { status: 'inactive' })
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
