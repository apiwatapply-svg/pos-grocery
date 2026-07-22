import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiDelete, apiDownload, apiGet, apiPatch, apiPost } from './client'
import { readSession, saveSession, sessionStorageKey, type Session } from '../auth/session'

const sweetAlert = vi.hoisted(() => ({
  close: vi.fn(),
  fire: vi.fn(),
  showLoading: vi.fn(),
}))

type SweetAlertFireOptions = {
  didOpen?: () => void
  title?: string
}

vi.mock('sweetalert2', () => ({
  default: sweetAlert,
}))

const session: Session = {
  token: 'expired-token',
  user: {
    id: 'user-1',
    username: 'admin',
    displayName: 'Admin',
    role: 'super_admin',
  },
}

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('api client', () => {
  it('deduplicates identical in-flight GET requests for React development double effects', async () => {
    saveSession(session)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: [{ id: 'product-1' }],
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const [firstResult, secondResult] = await Promise.all([
      apiGet('/products?view=operation'),
      apiGet('/products?view=operation'),
    ])

    expect(firstResult).toEqual([{ id: 'product-1' }])
    expect(secondResult).toEqual([{ id: 'product-1' }])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reuses a very recent GET response to avoid sequential development remount refetches', async () => {
    saveSession(session)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: [{ id: 'receipt-1' }],
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    await apiGet('/sales?page=1&pageSize=10&case=sequential')
    await apiGet('/sales?page=1&pageSize=10&case=sequential')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('clears recent GET responses after a database mutation succeeds', async () => {
    saveSession(session)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [{ id: 'receipt-1' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { id: 'saved-id' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [{ id: 'receipt-2' }],
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    await apiGet('/sales?page=1&pageSize=10&case=mutation')
    await apiPost('/sales/checkout', { barcodeItems: [] })
    await apiGet('/sales?page=1&pageSize=10&case=mutation')

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('clears the local session when the backend rejects an expired token', async () => {
    saveSession(session)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid authentication token.',
          },
        }),
      }),
    )

    await expect(apiGet('/products')).rejects.toThrow('Invalid authentication token.')

    expect(readSession()).toBeNull()
    expect(localStorage.getItem(sessionStorageKey)).toBeNull()
  })

  it('downloads files with the saved bearer token', async () => {
    saveSession(session)
    const click = vi.fn()
    const appendChild = vi.spyOn(document.body, 'appendChild')
    const removeChild = vi.spyOn(document.body, 'removeChild')
    const createElement = vi.spyOn(document, 'createElement')
    const createObjectURL = vi.fn(() => 'blob:inventory')
    const revokeObjectURL = vi.fn()

    createElement.mockImplementation(((tagName: string) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as HTMLAnchorElement
      if (tagName === 'a') {
        element.click = click
      }
      return element
    }) as typeof document.createElement)
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        blob: async () => new Blob(['excel']),
        ok: true,
        status: 200,
      }),
    )

    await apiDownload('/inventory/export.xlsx', 'inventory.xlsx')

    expect(fetch).toHaveBeenCalledWith('http://localhost:8787/api/inventory/export.xlsx', {
      cache: 'no-store',
      headers: expect.any(Headers),
    })
    const headers = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer expired-token')
    expect(headers.has('Content-Type')).toBe(false)
    expect(createObjectURL).toHaveBeenCalled()
    expect(click).toHaveBeenCalled()
    expect(appendChild).toHaveBeenCalled()
    expect(removeChild).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:inventory')
  })

  it.each([
    ['POST', () => apiPost('/products', { name: 'Milk' })],
    ['PATCH', () => apiPatch('/products/product-1', { name: 'Milk' })],
    ['DELETE', () => apiDelete('/products/product-1')],
  ])('shows saving and saved feedback for %s database mutations', async (_, request) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { id: 'saved-id' },
        }),
      }),
    )

    await request()

    expect(sweetAlert.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        allowEscapeKey: false,
        allowOutsideClick: false,
        title: 'กำลังบันทึกข้อมูล',
      }),
    )
    const loadingOptions = sweetAlert.fire.mock.calls.find(
      ([options]) => (options as SweetAlertFireOptions).title === 'กำลังบันทึกข้อมูล',
    )?.[0] as SweetAlertFireOptions | undefined

    expect(loadingOptions?.didOpen).toEqual(expect.any(Function))
    loadingOptions?.didOpen?.()

    expect(sweetAlert.showLoading).toHaveBeenCalled()
    expect(sweetAlert.fire).toHaveBeenLastCalledWith(
      expect.objectContaining({
        icon: 'success',
        showConfirmButton: false,
        timer: 800,
        title: 'บันทึกเรียบร้อย',
      }),
    )
  })

  it('does not show saved feedback when a database mutation fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: {
            message: 'Invalid product',
          },
        }),
      }),
    )

    await expect(apiPost('/products', { name: '' })).rejects.toThrow('Invalid product')

    expect(sweetAlert.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'กำลังบันทึกข้อมูล',
      }),
    )
    expect(sweetAlert.close).toHaveBeenCalled()
    expect(sweetAlert.fire).not.toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'บันทึกเรียบร้อย',
      }),
    )
  })

  it('does not show database save feedback for login requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { token: 'token' },
        }),
      }),
    )

    await apiPost('/auth/login', { username: 'admin', password: 'admin' })

    expect(sweetAlert.fire).not.toHaveBeenCalled()
  })
})
