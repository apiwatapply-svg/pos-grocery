import { describe, expect, it } from 'vitest'
import { displayReceiptNumber } from './receiptNumber'

describe('displayReceiptNumber', () => {
  it('keeps second-based receipt numbers unchanged', () => {
    expect(displayReceiptNumber('RC20260629-141855')).toBe('RC20260629-141855')
  })

  it('shortens legacy millisecond timestamp receipt numbers to seconds', () => {
    const timestamp = new Date('2026-06-29T07:18:55.123Z').getTime()

    expect(displayReceiptNumber(`RC20260629-${timestamp}`)).toBe('RC20260629-141855')
  })

  it('keeps R-prefixed Unix timestamp receipt numbers unchanged', () => {
    expect(displayReceiptNumber('R-1712345678')).toBe('R-1712345678')
  })

  it('keeps non-standard receipt numbers unchanged', () => {
    expect(displayReceiptNumber('RC-SQL-001')).toBe('RC-SQL-001')
  })
})
