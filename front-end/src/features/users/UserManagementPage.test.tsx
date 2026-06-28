import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { UserManagementPage } from './UserManagementPage'

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
})
