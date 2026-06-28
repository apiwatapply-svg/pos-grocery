import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CustomerDisplayPage } from './CustomerDisplayPage'
import { customerDisplayPayloadStorageKey } from './customerDisplay'

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

describe('CustomerDisplayPage', () => {
  function seedCustomerDisplayPayload() {
    localStorage.setItem(
      customerDisplayPayloadStorageKey,
      JSON.stringify({
        store: { name: 'POS Grocery' },
        cart: [
          {
            productName: 'Drinking Water',
            quantity: 2,
            unitPrice: 7,
          },
        ],
        cartTotal: 14,
        lastSale: null,
      }),
    )
  }

  it('keeps the customer display disabled on a single screen and ignores localStorage', () => {
    localStorage.setItem('pos-grocery:customer-display-enabled', 'true')
    setExtendedScreen(false)

    render(<CustomerDisplayPage />)

    expect(screen.getByRole('checkbox', { name: 'เปิดหน้าจอลูกค้า' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'เปิดหน้าต่างจอลูกค้า' })).toBeDisabled()
    expect(screen.getByText('ใช้ได้เมื่อพบการต่อ 2 จอเท่านั้น')).toBeInTheDocument()
    expect(localStorage.getItem('pos-grocery:customer-display-enabled')).toBeNull()
  })

  it('enables, persists, and previews the customer display when a second screen is detected', () => {
    seedCustomerDisplayPayload()
    setExtendedScreen(true)
    render(<CustomerDisplayPage />)

    const toggle = screen.getByRole('checkbox', { name: 'เปิดหน้าจอลูกค้า' })
    expect(toggle).not.toBeDisabled()

    fireEvent.click(toggle)

    expect(localStorage.getItem('pos-grocery:customer-display-enabled')).toBe('true')
    expect(screen.getByRole('button', { name: 'เปิดหน้าต่างจอลูกค้า' })).not.toBeDisabled()
    expect(screen.getByText('Drinking Water x2')).toBeInTheDocument()
    expect(screen.getByText('ยอดที่ต้องชำระ 14.00 บาท')).toBeInTheDocument()
  })

  it('opens and closes the separate customer display window from the display page', () => {
    seedCustomerDisplayPayload()
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
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(displayWindow)

    render(<CustomerDisplayPage />)

    const toggle = screen.getByRole('checkbox', { name: 'เปิดหน้าจอลูกค้า' })
    fireEvent.click(toggle)
    fireEvent.click(screen.getByRole('button', { name: 'เปิดหน้าต่างจอลูกค้า' }))
    fireEvent.click(toggle)

    expect(openSpy).toHaveBeenCalledWith(
      '',
      'pos-grocery-customer-display',
      'popup,width=900,height=700',
    )
    expect(displayWindow.document.write).toHaveBeenCalledWith(
      expect.stringContaining('ยอดที่ต้องชำระ 14.00 บาท'),
    )
    expect(displayWindow.close).toHaveBeenCalled()
  })
})
