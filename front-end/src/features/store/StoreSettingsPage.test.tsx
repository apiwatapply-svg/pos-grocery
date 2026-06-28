import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StoreSettingsPage } from './StoreSettingsPage'

describe('StoreSettingsPage', () => {
  it('renders store name, phone, address, and owner fields', () => {
    render(<StoreSettingsPage />)

    expect(screen.getByText('ชื่อร้าน')).toBeInTheDocument()
    expect(screen.getByText('เบอร์โทร')).toBeInTheDocument()
    expect(screen.getByText('ที่อยู่')).toBeInTheDocument()
    expect(screen.getByText('เจ้าของร้าน')).toBeInTheDocument()
  })
})
