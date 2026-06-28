import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiGet } from '../../lib/api/client'
import { StoreSettingsPage } from './StoreSettingsPage'

vi.mock('../../lib/api/client', () => ({
  apiGet: vi.fn(),
}))

const mockedApiGet = vi.mocked(apiGet)

beforeEach(() => {
  mockedApiGet.mockResolvedValue({
    id: 'store-sql-1',
    name: 'SQL Grocery Store',
    phone: '0891112222',
    address: 'SQL Road',
    ownerName: 'SQL Owner',
    status: 'active',
  })
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
    expect(await screen.findByText('SQL Grocery Store')).toBeInTheDocument()
    expect(screen.getByText('0891112222')).toBeInTheDocument()
    expect(screen.queryByText('POS Grocery')).not.toBeInTheDocument()
    expect(mockedApiGet).toHaveBeenCalledWith('/stores/current')
  })
})
