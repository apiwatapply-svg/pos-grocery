import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('renders every requested POS module in the operations workspace', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'POS Grocery' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ข้อมูลร้านค้า' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ผู้ใช้ระบบ' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'สินค้า' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'รับของเข้า / ตรวจนับ stock' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ขายสินค้า / Scan barcode' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ใบเสร็จ' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'รายงานยอดขาย' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Export inventory Excel' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Export report Excel' })).toBeInTheDocument()
  })

  it('adds scanned barcode items to cart, checks out, deducts stock, and shows receipt', () => {
    render(<App />)

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
})
