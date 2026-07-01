import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  Reflect.deleteProperty(window, 'getScreenDetails')
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
        cashReceived: 20,
        changeDue: 6,
        lastSale: null,
      }),
    )
  }

  function seedUnderpaidCustomerDisplayPayload() {
    localStorage.setItem(
      customerDisplayPayloadStorageKey,
      JSON.stringify({
        store: { name: 'POS Grocery' },
        cart: [
          {
            productName: 'Canned Sardines',
            quantity: 12,
            unitPrice: 25,
          },
          {
            productName: 'Cooking Oil 1L',
            quantity: 1,
            unitPrice: 59,
          },
        ],
        cartTotal: 359,
        cashReceived: 100,
        changeDue: -259,
        lastSale: { receiptNumber: 'RC20260629-1' },
      }),
    )
  }

  it('opens the customer display on a single screen and keeps localStorage preference', async () => {
    seedCustomerDisplayPayload()
    localStorage.setItem('pos-grocery:customer-display-enabled', 'true')
    setExtendedScreen(false)
    const displayWindow = {
      closed: false,
      document: {
        close: vi.fn(),
        open: vi.fn(),
        write: vi.fn(),
      },
    } as unknown as Window
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(displayWindow)

    render(<CustomerDisplayPage />)

    expect(screen.queryByRole('checkbox', { name: 'เปิดหน้าจอลูกค้า' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ตรวจสอบจอ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'เปิดหน้าต่างจอลูกค้า' })).not.toBeDisabled()
    expect(screen.getByText('สถานะจอ: ยังไม่พบจอที่สอง')).toBeInTheDocument()
    expect(screen.getByText('เปิดได้ทันที และจะย้ายไปจอที่สองอัตโนมัติเมื่อระบบพบจอที่สอง')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'เปิดหน้าต่างจอลูกค้า' }))

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith('', 'pos-grocery-customer-display', 'popup,width=900,height=700')
    })
    expect(localStorage.getItem('pos-grocery:customer-display-enabled')).toBe('true')
    expect(displayWindow.document.write).toHaveBeenCalledWith(expect.stringContaining('Drinking Water'))
    expect(displayWindow.document.write).toHaveBeenCalledWith(
      expect.stringContaining('pos-grocery:customer-display-payload'),
    )
    expect(displayWindow.document.write).toHaveBeenCalledWith(
      expect.stringContaining('setInterval(syncCustomerDisplay'),
    )
  })

  it('keeps the open-display button enabled while checking second-screen status', () => {
    seedCustomerDisplayPayload()
    setExtendedScreen(false)
    render(<CustomerDisplayPage />)

    expect(screen.getByRole('button', { name: 'เปิดหน้าต่างจอลูกค้า' })).not.toBeDisabled()

    setExtendedScreen(true)
    fireEvent.click(screen.getByRole('button', { name: 'ตรวจสอบจอ' }))

    expect(screen.getByText('สถานะจอ: พบจอที่สอง')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'เปิดหน้าต่างจอลูกค้า' })).not.toBeDisabled()
  })

  it('opens the customer display on the second screen at full screen size when screen details are available', async () => {
    seedCustomerDisplayPayload()
    setExtendedScreen(true)
    const displayWindow = {
      closed: false,
      document: {
        close: vi.fn(),
        documentElement: {
          requestFullscreen: vi.fn().mockResolvedValue(undefined),
        },
        open: vi.fn(),
        write: vi.fn(),
      },
      focus: vi.fn(),
    } as unknown as Window
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(displayWindow)
    Object.defineProperty(window, 'getScreenDetails', {
      configurable: true,
      value: vi.fn().mockResolvedValue({
        currentScreen: { isPrimary: true, left: 0, top: 0, width: 1920, height: 1080 },
        screens: [
          { isPrimary: true, left: 0, top: 0, width: 1920, height: 1080 },
          { isPrimary: false, left: 1920, top: 0, width: 1280, height: 720 },
        ],
      }),
    })

    render(<CustomerDisplayPage />)

    fireEvent.click(screen.getByRole('button', { name: 'เปิดหน้าต่างจอลูกค้า' }))

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        '',
        'pos-grocery-customer-display',
        'popup,left=1920,top=0,width=1280,height=720',
      )
    })
    expect(displayWindow.focus).toHaveBeenCalled()
    expect(displayWindow.document.documentElement.requestFullscreen).toHaveBeenCalled()
  })

  it('enables, persists, and previews the customer display when opening a detected second screen', () => {
    seedCustomerDisplayPayload()
    setExtendedScreen(true)
    const displayWindow = {
      closed: false,
      document: {
        close: vi.fn(),
        open: vi.fn(),
        write: vi.fn(),
      },
    } as unknown as Window
    vi.spyOn(window, 'open').mockReturnValue(displayWindow)

    render(<CustomerDisplayPage />)

    expect(screen.queryByRole('checkbox', { name: 'เปิดหน้าจอลูกค้า' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'เปิดหน้าต่างจอลูกค้า' }))

    expect(localStorage.getItem('pos-grocery:customer-display-enabled')).toBe('true')
    expect(screen.getByRole('button', { name: 'เปิดหน้าต่างจอลูกค้า' })).not.toBeDisabled()
    expect(screen.getByRole('columnheader', { name: 'No' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'สินค้า' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '1' })).toBeInTheDocument()
    expect(screen.getByText('Drinking Water')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('7.00 บาท')).toBeInTheDocument()
    expect(screen.getByText('ยอดที่ต้องชำระ 14.00 บาท')).toBeInTheDocument()
    expect(screen.getByText('รับเงิน 20.00 บาท')).toBeInTheDocument()
    expect(screen.getByText('เงินทอน 6.00 บาท')).toBeInTheDocument()
  })

  it('opens and keeps the separate customer display window from the display page while rechecking screens', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'เปิดหน้าต่างจอลูกค้า' }))
    fireEvent.click(screen.getByRole('button', { name: 'ตรวจสอบจอ' }))

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        '',
        'pos-grocery-customer-display',
        'popup,width=900,height=700',
      )
    })
    expect(displayWindow.document.write).toHaveBeenCalledWith(
      expect.stringContaining('<th>No</th>'),
    )
    expect(displayWindow.document.write).toHaveBeenCalledWith(
      expect.stringContaining('ยอดที่ต้องชำระ'),
    )
    expect(displayWindow.document.write).toHaveBeenCalledWith(
      expect.stringContaining('14.00 บาท'),
    )
    expect(displayWindow.document.write).toHaveBeenCalledWith(
      expect.stringContaining('รับเงิน'),
    )
    expect(displayWindow.document.write).toHaveBeenCalledWith(
      expect.stringContaining('20.00 บาท'),
    )
    expect(displayWindow.document.write).toHaveBeenCalledWith(
      expect.stringContaining('เงินทอน'),
    )
    expect(displayWindow.document.write).toHaveBeenCalledWith(
      expect.stringContaining('6.00 บาท'),
    )
    expect(displayWindow.close).not.toHaveBeenCalled()
  })

  it('shows the remaining amount due when customer cash is underpaid', async () => {
    seedUnderpaidCustomerDisplayPayload()
    setExtendedScreen(true)
    const displayWindow = {
      closed: false,
      document: {
        close: vi.fn(),
        open: vi.fn(),
        write: vi.fn(),
      },
    } as unknown as Window
    vi.spyOn(window, 'open').mockReturnValue(displayWindow)

    render(<CustomerDisplayPage />)
    fireEvent.click(screen.getByRole('button', { name: 'เปิดหน้าต่างจอลูกค้า' }))

    expect(screen.getByText('ยอดที่ต้องชำระ 359.00 บาท')).toBeInTheDocument()
    expect(screen.getByText('รับเงิน 100.00 บาท')).toBeInTheDocument()
    expect(screen.getByText('ยังขาดอีก 259.00 บาท')).toBeInTheDocument()
    expect(screen.queryByText('เงินทอน 0.00 บาท')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(displayWindow.document.write).toHaveBeenCalledWith(
        expect.stringContaining('ยังขาดอีก'),
      )
    })
    expect(displayWindow.document.write).toHaveBeenCalledWith(
      expect.stringContaining('259.00 บาท'),
    )
  })
})
