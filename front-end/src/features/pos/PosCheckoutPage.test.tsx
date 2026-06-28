import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PosCheckoutPage } from './PosCheckoutPage'
import { customerDisplayPayloadStorageKey } from './customerDisplay'

afterEach(() => {
  localStorage.clear()
})

describe('PosCheckoutPage', () => {
  it('adds scanned barcode items to cart, checks out, deducts stock, and shows receipt', () => {
    render(<PosCheckoutPage />)

    fireEvent.change(screen.getByLabelText('Barcode'), {
      target: { value: '8850002000010' },
    })
    fireEvent.change(screen.getByLabelText('จำนวนขาย'), {
      target: { value: '2' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มลงตะกร้า' }))
    fireEvent.change(screen.getByLabelText('รับเงินสด'), {
      target: { value: '100' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'ชำระเงิน' }))

    expect(screen.getByText('ยอดรวม 14.00 บาท')).toBeInTheDocument()
    expect(screen.getByText('เงินทอน 86.00 บาท')).toBeInTheDocument()
    expect(screen.getByText('คงเหลือ 22')).toBeInTheDocument()
    expect(screen.getByText(/Drinking Water x2/)).toBeInTheDocument()
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

    fireEvent.change(screen.getByLabelText('Barcode'), {
      target: { value: '8850002000010' },
    })
    fireEvent.change(screen.getByLabelText('จำนวนขาย'), {
      target: { value: '2' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มลงตะกร้า' }))

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
