import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import Swal from 'sweetalert2'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { saveSession, type Session } from '../../lib/auth/session'
import { PosCheckoutPage } from './PosCheckoutPage'
import { customerDisplayPayloadStorageKey } from './customerDisplay'

vi.mock('sweetalert2', () => ({
  default: {
    fire: vi.fn(),
  },
}))

const mockedSwal = vi.mocked(Swal)

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('PosCheckoutPage', () => {
  function sessionForRole(role: Session['user']['role']): Session {
    return {
      token: `${role}-token`,
      user: {
        id: `${role}-user`,
        username: role,
        displayName: role,
        role,
      },
    }
  }

  function createWaterSale() {
    fireEvent.change(screen.getByLabelText('สแกนหรือค้นหาสินค้า'), {
      target: { value: '8850002000010' },
    })
    fireEvent.change(screen.getByLabelText('สแกนหรือค้นหาสินค้า'), {
      target: { value: 'Drinking Water' },
    })
    fireEvent.change(screen.getByLabelText('รับเงินสด'), {
      target: { value: '100' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'ชำระเงิน' }))
  }

  it('adds scanned and selected products immediately, merges duplicates, checks out, and opens a receipt modal', () => {
    render(<PosCheckoutPage />)

    fireEvent.change(screen.getByLabelText('สแกนหรือค้นหาสินค้า'), {
      target: { value: '8850002000010' },
    })
    fireEvent.change(screen.getByLabelText('สแกนหรือค้นหาสินค้า'), {
      target: { value: 'Drinking Water' },
    })
    fireEvent.change(screen.getByLabelText('สแกนหรือค้นหาสินค้า'), {
      target: { value: 'Instant Noodles' },
    })
    fireEvent.change(screen.getByLabelText('รับเงินสด'), {
      target: { value: '100' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'ชำระเงิน' }))

    expect(screen.getByText('ยอดรวม 26.00 บาท')).toBeInTheDocument()
    expect(screen.getByText('คงเหลือ 22')).toBeInTheDocument()
    expect(screen.getByText('คงเหลือ 17')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /ดูรายละเอียดบิล/ }))

    expect(screen.getByRole('dialog', { name: /รายละเอียดบิล/ })).toBeInTheDocument()
    expect(screen.getByText(/Drinking Water x2/)).toBeInTheDocument()
    expect(screen.getByText(/Instant Noodles x1/)).toBeInTheDocument()
    expect(screen.getByText('เงินทอน 74.00 บาท')).toBeInTheDocument()
  })

  it('does not allow a cashier to cancel a receipt', () => {
    saveSession(sessionForRole('cashier'))
    render(<PosCheckoutPage />)

    createWaterSale()
    fireEvent.click(screen.getByRole('button', { name: /ดูรายละเอียดบิล/ }))

    expect(screen.getByRole('dialog', { name: /รายละเอียดบิล/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ยกเลิกบิล' })).not.toBeInTheDocument()
    expect(screen.getByText('คงเหลือ 22')).toBeInTheDocument()
  })

  it('allows an admin to cancel a receipt after SweetAlert2 confirmation and restores stock', async () => {
    mockedSwal.fire.mockResolvedValueOnce({
      isConfirmed: true,
      isDenied: false,
      isDismissed: false,
    })
    saveSession(sessionForRole('admin'))
    render(<PosCheckoutPage />)

    createWaterSale()
    fireEvent.click(screen.getByRole('button', { name: /ดูรายละเอียดบิล/ }))
    fireEvent.click(screen.getByRole('button', { name: 'ยกเลิกบิล' }))

    await waitFor(() => {
      expect(mockedSwal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          confirmButtonText: 'ยืนยันยกเลิก',
          icon: 'warning',
          showCancelButton: true,
          title: 'ยืนยันยกเลิกบิล',
        }),
      )
    })
    expect(screen.getAllByText('ยกเลิกแล้ว')).toHaveLength(2)
    expect(screen.getByText('คงเหลือ 24')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ยกเลิกบิล' })).not.toBeInTheDocument()
  })

  it('keeps the checkout page focused by not rendering customer display controls', () => {
    localStorage.setItem('pos-grocery:customer-display-enabled', 'true')

    render(<PosCheckoutPage />)

    expect(screen.getByRole('heading', { name: 'Checkout' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'เปิดหน้าจอลูกค้า' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'เปิดหน้าต่างจอลูกค้า' })).not.toBeInTheDocument()
    expect(screen.queryByText('ยอดที่ต้องชำระ 0.00 บาท')).not.toBeInTheDocument()
  })

  it('syncs scanned cart lines to customer display storage without rendering controls', async () => {
    render(<PosCheckoutPage />)

    fireEvent.change(screen.getByLabelText('สแกนหรือค้นหาสินค้า'), {
      target: { value: '8850002000010' },
    })
    fireEvent.change(screen.getByLabelText('สแกนหรือค้นหาสินค้า'), {
      target: { value: 'Drinking Water' },
    })

    await waitFor(() => {
      const displayPayload = JSON.parse(
        localStorage.getItem(customerDisplayPayloadStorageKey) ?? '{}',
      )
      expect(displayPayload.cart).toEqual([
        {
          barcode: '8850002000010',
          productId: 'product-water',
          productName: 'Drinking Water',
          quantity: 2,
          unitPrice: 7,
        },
      ])
      expect(displayPayload.cartTotal).toBe(14)
    })

    expect(screen.queryByRole('checkbox', { name: 'เปิดหน้าจอลูกค้า' })).not.toBeInTheDocument()
  })
})
