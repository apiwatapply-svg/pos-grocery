import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

function setExtendedScreen(isExtended: boolean) {
  Object.defineProperty(window.screen, 'isExtended', {
    configurable: true,
    value: isExtended,
  })
}

afterEach(() => {
  localStorage.clear()
  setExtendedScreen(false)
  vi.restoreAllMocks()
})

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

  it('keeps the customer display disabled on a single screen and ignores localStorage', () => {
    localStorage.setItem('pos-grocery:customer-display-enabled', 'true')
    setExtendedScreen(false)

    render(<App />)

    expect(screen.getByRole('checkbox', { name: 'เปิดหน้าจอลูกค้า' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'เปิดหน้าต่างจอลูกค้า' })).toBeDisabled()
    expect(screen.getByText('ใช้ได้เมื่อพบการต่อ 2 จอเท่านั้น')).toBeInTheDocument()
    expect(localStorage.getItem('pos-grocery:customer-display-enabled')).toBeNull()
  })

  it('enables and persists the customer display only when a second screen is detected', () => {
    setExtendedScreen(true)
    render(<App />)

    const toggle = screen.getByRole('checkbox', { name: 'เปิดหน้าจอลูกค้า' })
    expect(toggle).not.toBeDisabled()

    fireEvent.click(toggle)
    expect(localStorage.getItem('pos-grocery:customer-display-enabled')).toBe('true')
    expect(screen.getByRole('button', { name: 'เปิดหน้าต่างจอลูกค้า' })).not.toBeDisabled()

    fireEvent.change(screen.getByLabelText('Barcode'), {
      target: { value: '8850002000010' },
    })
    fireEvent.change(screen.getByLabelText('จำนวนขาย'), {
      target: { value: '2' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มลงตะกร้า' }))

    expect(screen.getByRole('heading', { name: 'จอลูกค้า' })).toBeInTheDocument()
    expect(screen.getByText('Drinking Water x2')).toBeInTheDocument()
    expect(screen.getByText('ยอดที่ต้องชำระ 14.00 บาท')).toBeInTheDocument()
  })

  it('opens a separate customer display window after the customer display is enabled', () => {
    setExtendedScreen(true)
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)

    render(<App />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'เปิดหน้าจอลูกค้า' }))
    fireEvent.click(screen.getByRole('button', { name: 'เปิดหน้าต่างจอลูกค้า' }))

    expect(openSpy).toHaveBeenCalledWith(
      '',
      'pos-grocery-customer-display',
      'popup,width=900,height=700',
    )
  })

  it('closes the separate customer display window when the display is turned off', () => {
    setExtendedScreen(true)
    const displayWindow = {
      closed: false,
      close: vi.fn(),
      document: {
        close: vi.fn(),
        open: vi.fn(),
        write: vi.fn(),
      },
    } as unknown as Window
    vi.spyOn(window, 'open').mockReturnValue(displayWindow)

    render(<App />)

    const toggle = screen.getByRole('checkbox', { name: 'เปิดหน้าจอลูกค้า' })
    fireEvent.click(toggle)
    fireEvent.click(screen.getByRole('button', { name: 'เปิดหน้าต่างจอลูกค้า' }))
    fireEvent.click(toggle)

    expect(displayWindow.close).toHaveBeenCalled()
  })
})
